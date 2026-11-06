import { GetCommand, QueryCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type {
  DonationItem,
  IdempotencyRecordItem,
  DonationStatus,
} from './donation.types.js';
import { encodeNextToken, decodeNextToken } from '../../shared/utils/pagination.js';
import { createHash } from 'node:crypto';

export class DonationRepository {
  private donationsTable = env.DONATIONS_TABLE;
  private idempotencyTable = env.IDEMPOTENCY_TABLE;
  private projectsTable = env.PROJECTS_TABLE;

  public computePayloadHash(payload: unknown): string {
    const normalizedJson = JSON.stringify(payload);
    return createHash('sha256').update(normalizedJson).digest('hex');
  }

  public async getIdempotencyRecord(pk: string): Promise<IdempotencyRecordItem | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.idempotencyTable,
        Key: { pk },
        ConsistentRead: true,
      })
    );
    return (result.Item as IdempotencyRecordItem) || null;
  }

  public async createDonationWithIdempotency(
    donation: DonationItem,
    idempotencyKey: string,
    payloadHash: string,
    responseBodyObj: unknown
  ): Promise<void> {
    const pk = `${donation.donorSub}#createDonation#${idempotencyKey}`;
    const expiresAt = Math.floor(Date.now() / 1000) + 86400; // 24 horas TTL

    const idempotencyItem: IdempotencyRecordItem = {
      pk,
      recordId: idempotencyKey,
      payloadHash,
      donationId: donation.donationId,
      responseStatus: 201,
      responseBody: JSON.stringify(responseBodyObj),
      expiresAt,
    };

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: this.idempotencyTable,
              Item: idempotencyItem,
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Put: {
              TableName: this.donationsTable,
              Item: donation,
              ConditionExpression: 'attribute_not_exists(donationId)',
            },
          },
        ],
      })
    );
  }

  public async getById(donationId: string): Promise<DonationItem | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.donationsTable,
        Key: { donationId },
        ConsistentRead: true,
      })
    );
    return (result.Item as DonationItem) || null;
  }

  public async listByDonor(
    donorSub: string,
    limit: number = 20,
    nextToken?: string
  ): Promise<{ items: DonationItem[]; nextToken: string | null }> {
    const exclusiveStartKey = decodeNextToken(nextToken);

    const result = await docClient.send(
      new QueryCommand({
        TableName: this.donationsTable,
        IndexName: 'donorSub-createdAt',
        KeyConditionExpression: 'donorSub = :subVal',
        ExpressionAttributeValues: {
          ':subVal': donorSub,
        },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false, // Orden cronológico descendente
      })
    );

    return {
      items: (result.Items as DonationItem[]) || [],
      nextToken: encodeNextToken(result.LastEvaluatedKey),
    };
  }

  public async executeSimulationTransaction(
    donation: DonationItem,
    targetStatus: DonationStatus,
    nowIso: string
  ): Promise<void> {
    const transactItems: any[] = [
      {
        Update: {
          TableName: this.donationsTable,
          Key: { donationId: donation.donationId },
          UpdateExpression: 'SET #status = :targetStatus, updatedAt = :now',
          ConditionExpression: '#status = :pendingStatus AND donorSub = :donorSubVal',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':targetStatus': targetStatus,
            ':pendingStatus': 'PENDIENTE_SIMULACION',
            ':donorSubVal': donation.donorSub,
            ':now': nowIso,
          },
        },
      },
    ];

    // Si la simulación es confirmada, incrementar acumulado del proyecto atómicamente
    if (targetStatus === 'CONFIRMADA_SIMULADA') {
      transactItems.push({
        Update: {
          TableName: this.projectsTable,
          Key: { projectId: donation.projectId },
          UpdateExpression: 'ADD confirmedAmountCents :amountVal SET updatedAt = :now',
          ConditionExpression: 'attribute_exists(projectId)',
          ExpressionAttributeValues: {
            ':amountVal': donation.amountCents,
            ':now': nowIso,
          },
        },
      });
    }

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: transactItems,
      })
    );
  }
}

export const donationRepository = new DonationRepository();