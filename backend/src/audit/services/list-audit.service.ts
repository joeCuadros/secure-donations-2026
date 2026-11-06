import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { AuditEventItem } from '../types.js';
import { encodeNextToken, decodeNextToken } from '../../shared/utils/pagination.js';

export const listAuditLogsService = async (
  eventType?: string,
  from?: string,
  to?: string,
  limit: number = 20,
  nextToken?: string
) => {
  const targetType = eventType || 'DONATION_EVENT';
  let keyCondition = 'eventType = :et';
  const exprValues: Record<string, unknown> = { ':et': targetType };

  if (from && to) {
    keyCondition += ' AND timestampEventId BETWEEN :fKey AND :tKey';
    exprValues[':fKey'] = `${from}#`;
    exprValues[':tKey'] = `${to}#~`;
  } else if (from) {
    keyCondition += ' AND timestampEventId >= :fKey';
    exprValues[':fKey'] = `${from}#`;
  } else if (to) {
    keyCondition += ' AND timestampEventId <= :tKey';
    exprValues[':tKey'] = `${to}#~`;
  }

  const result = await docClient.send(
    new QueryCommand({
      TableName: env.AUDIT_TABLE,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: exprValues,
      Limit: limit,
      ExclusiveStartKey: decodeNextToken(nextToken),
      ScanIndexForward: false,
    })
  );

  return {
    items: (result.Items as AuditEventItem[]) || [],
    nextToken: encodeNextToken(result.LastEvaluatedKey),
  };
};