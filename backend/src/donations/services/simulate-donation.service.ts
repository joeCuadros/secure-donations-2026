import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { DonationItem, DonationStatus } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';

export const simulateDonationService = async (
  donationId: string,
  result: 'CONFIRMADA_SIMULADA' | 'RECHAZADA_SIMULADA',
  donorSub: string
) => {
  if (env.STAGE !== 'academic') {
    throw AppError.forbidden('Endpoint disponible únicamente en el stage academic.');
  }

  const getRes = await docClient.send(
    new GetCommand({ TableName: env.DONATIONS_TABLE, Key: { donationId }, ConsistentRead: true })
  );
  const donation = getRes.Item as DonationItem | undefined;

  if (!donation || donation.donorSub !== donorSub) {
    throw AppError.notFound('Donación no encontrada.');
  }

  if (donation.status !== 'PENDIENTE_SIMULACION') {
    throw AppError.conflict('La donación ya se encuentra en un estado terminal.');
  }

  const now = new Date().toISOString();
  const transactItems: any[] = [
    {
      Update: {
        TableName: env.DONATIONS_TABLE,
        Key: { donationId },
        UpdateExpression: 'SET #s = :targetStatus, updatedAt = :now',
        ConditionExpression: '#s = :pending AND donorSub = :sub',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':targetStatus': result,
          ':pending': 'PENDIENTE_SIMULACION',
          ':sub': donorSub,
          ':now': now,
        },
      },
    },
  ];

  if (result === 'CONFIRMADA_SIMULADA') {
    transactItems.push({
      Update: {
        TableName: env.PROJECTS_TABLE,
        Key: { projectId: donation.projectId },
        UpdateExpression: 'ADD confirmedAmountCents :amt SET updatedAt = :now',
        ConditionExpression: 'attribute_exists(projectId)',
        ExpressionAttributeValues: {
          ':amt': donation.amountCents,
          ':now': now,
        },
      },
    });
  }

  await docClient.send(new TransactWriteCommand({ TransactItems: transactItems }));

  return {
    donationId,
    status: result,
    updatedAt: now,
  };
};