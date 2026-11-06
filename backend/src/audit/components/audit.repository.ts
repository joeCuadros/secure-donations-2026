import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { AuditEventItem, CreateAuditInput, QueryAuditInput } from './audit.types.js';
import { encodeNextToken, decodeNextToken } from '../../shared/utils/pagination.js';
import { createHash, randomUUID } from 'node:crypto';

export class AuditRepository {
  private tableName = env.AUDIT_TABLE;

  private pseudonymizeActor(sub: string): string {
    const hash = createHash('sha256').update(sub).digest('hex').substring(0, 8);
    return `actor_${hash}`;
  }

  public async createLog(input: CreateAuditInput): Promise<AuditEventItem> {
    const eventId = randomUUID();
    const timestamp = new Date().toISOString();
    const timestampEventId = `${timestamp}#${eventId}`;
    const actorRef = this.pseudonymizeActor(input.actorSub);

    const item: AuditEventItem = {
      eventType: input.eventType,
      timestampEventId,
      timestamp,
      eventId,
      requestId: input.requestId,
      actorRef,
      action: input.action,
      resourceRef: input.resourceRef,
      outcome: input.outcome,
    };

    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      })
    );

    return item;
  }

  public async listLogs(
    query: QueryAuditInput
  ): Promise<{ items: AuditEventItem[]; nextToken: string | null }> {
    const limit = query.limit || 20;
    const exclusiveStartKey = decodeNextToken(query.nextToken);

    if (query.eventType) {
      let keyCondition = 'eventType = :et';
      const expressionAttributeValues: Record<string, unknown> = {
        ':et': query.eventType,
      };

      if (query.from && query.to) {
        keyCondition += ' AND timestampEventId BETWEEN :fromKey AND :toKey';
        expressionAttributeValues[':fromKey'] = `${query.from}#`;
        expressionAttributeValues[':toKey'] = `${query.to}#~`;
      } else if (query.from) {
        keyCondition += ' AND timestampEventId >= :fromKey';
        expressionAttributeValues[':fromKey'] = `${query.from}#`;
      } else if (query.to) {
        keyCondition += ' AND timestampEventId <= :toKey';
        expressionAttributeValues[':toKey'] = `${query.to}#~`;
      }

      const result = await docClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: keyCondition,
          ExpressionAttributeValues: expressionAttributeValues,
          Limit: limit,
          ExclusiveStartKey: exclusiveStartKey,
          ScanIndexForward: false, // Inverso cronológico
        })
      );

      return {
        items: (result.Items as AuditEventItem[]) || [],
        nextToken: encodeNextToken(result.LastEvaluatedKey),
      };
    }

    // Consulta por defecto para tipo 'GENERAL'
    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'eventType = :et',
        ExpressionAttributeValues: {
          ':et': 'SYSTEM_EVENT',
        },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false,
      })
    );

    return {
      items: (result.Items as AuditEventItem[]) || [],
      nextToken: encodeNextToken(result.LastEvaluatedKey),
    };
  }
}

export const auditRepository = new AuditRepository();