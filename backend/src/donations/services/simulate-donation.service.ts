import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { DonationItem } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authorizeActionService } from '../../authz/services/avp.service.js';
import type { AuthenticatedUser } from '../../authz/types.js';

export const simulateDonationService = async (
  donationId: string,
  result: 'CONFIRMADA_SIMULADA' | 'RECHAZADA_SIMULADA',
  user: AuthenticatedUser
) => {
  if (env.STAGE !== 'academic') {
    throw AppError.forbidden('Endpoint disponible únicamente en el stage academic.');
  }

  const getRes = await docClient.send(
    new GetCommand({ TableName: env.DONATIONS_TABLE, Key: { donationId }, ConsistentRead: true })
  );
  const donation = getRes.Item as DonationItem | undefined;

  if (!donation) {
    throw AppError.notFound('Donación no encontrada.');
  }

  // Aserción de autorización externa (Cedar) - Reemplaza aserción de propiedad local
  await authorizeActionService(user, 'SimulateDonation', 'Donation', donationId, {
    donorSub: donation.donorSub,
    status: donation.status
  });

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
          ':sub': user.sub,
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