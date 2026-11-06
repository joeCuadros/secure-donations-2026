import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { DonationItem } from '../types.js';
import { encodeNextToken, decodeNextToken } from '../../shared/utils/pagination.js';

export const listMyDonationsService = async (donorSub: string, limit: number = 20, nextToken?: string) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: env.DONATIONS_TABLE,
      IndexName: 'donorSub-createdAt',
      KeyConditionExpression: 'donorSub = :subVal',
      ExpressionAttributeValues: { ':subVal': donorSub },
      Limit: limit,
      ExclusiveStartKey: decodeNextToken(nextToken),
      ScanIndexForward: false,
    })
  );

  const items = (result.Items as DonationItem[]) || [];
  return {
    items: items.map((d) => ({
      donationId: d.donationId,
      projectId: d.projectId,
      amountCents: d.amountCents,
      currency: d.currency,
      status: d.status,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    })),
    nextToken: encodeNextToken(result.LastEvaluatedKey),
  };
};