import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { DonationItem, IdempotencyRecordItem } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { getProjectService } from '../../projects/services/get-project.service.js';
import { createHash, randomUUID } from 'node:crypto';

export const createDonationService = async (
  projectId: string,
  amountCents: number,
  idempotencyKey: string,
  donorSub: string
) => {
  const pk = `${donorSub}#createDonation#${idempotencyKey}`;
  const payloadHash = createHash('sha256')
    .update(JSON.stringify({ projectId, amountCents }))
    .digest('hex');

  // Check idempotencia
  const existingRes = await docClient.send(
    new GetCommand({ TableName: env.IDEMPOTENCY_TABLE, Key: { pk }, ConsistentRead: true })
  );
  const existing = existingRes.Item as IdempotencyRecordItem | undefined;

  if (existing) {
    if (existing.payloadHash === payloadHash) {
      return { statusCode: existing.responseStatus, data: JSON.parse(existing.responseBody) };
    }
    throw AppError.conflict('La clave de idempotencia ya fue utilizada con otro payload.');
  }

  // Verificar proyecto publicado
  const project = await getProjectService(projectId);
  if (project.status !== 'PUBLICADO') {
    throw AppError.conflict('El proyecto no se encuentra publicado.');
  }

  const now = new Date().toISOString();
  const donationId = `don_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

  const donationItem: DonationItem = {
    donationId,
    projectId,
    donorSub,
    amountCents,
    currency: 'PEN',
    status: 'PENDIENTE_SIMULACION',
    createdAt: now,
    updatedAt: now,
  };

  const responseDTO = {
    donationId: donationItem.donationId,
    projectId: donationItem.projectId,
    amountCents: donationItem.amountCents,
    currency: donationItem.currency,
    status: donationItem.status,
    createdAt: donationItem.createdAt,
  };

  const expiresAt = Math.floor(Date.now() / 1000) + 86400;

  try {
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: env.IDEMPOTENCY_TABLE,
              Item: {
                pk,
                recordId: idempotencyKey,
                payloadHash,
                donationId,
                responseStatus: 201,
                responseBody: JSON.stringify(responseDTO),
                expiresAt,
              },
              ConditionExpression: 'attribute_not_exists(pk)',
            },
          },
          {
            Put: {
              TableName: env.DONATIONS_TABLE,
              Item: donationItem,
              ConditionExpression: 'attribute_not_exists(donationId)',
            },
          },
        ],
      })
    );
  } catch (error: any) {
    if (error?.name === 'TransactionCanceledException') {
      throw AppError.conflict('Conflicto de idempotencia al procesar la solicitud.');
    }
    throw error;
  }

  return { statusCode: 201, data: responseDTO };
};