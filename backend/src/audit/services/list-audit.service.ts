import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import { AUDIT_GSI_PARTITION, type AuditEventItem } from '../types.js';
import { encodeNextToken, decodeNextToken } from '../../shared/utils/pagination.js';

export const AUDIT_ALL_EVENTS_INDEX = 'AllAuditLogsIndex';

export const listAuditLogsService = async (
  eventType?: string,
  from?: string,
  to?: string,
  limit: number = 20,
  nextToken?: string
) => {
  // Con filtro por tipo se consulta la tabla (PK eventType); sin filtro, el índice global (PK gsi1pk).
  let keyCondition = eventType ? 'eventType = :et' : 'gsi1pk = :pk';
  const exprValues: Record<string, unknown> = eventType
    ? { ':et': eventType }
    : { ':pk': AUDIT_GSI_PARTITION };

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
      ...(eventType ? {} : { IndexName: AUDIT_ALL_EVENTS_INDEX }),
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: exprValues,
      Limit: limit,
      ExclusiveStartKey: decodeNextToken(nextToken),
      ScanIndexForward: false,
    })
  );

  const items = (result.Items as AuditEventItem[] | undefined) ?? [];
  return {
    // `gsi1pk` es un detalle interno de indexación y no forma parte del contrato de la API.
    items: items.map(({ gsi1pk: _gsi1pk, ...event }) => event),
    nextToken: encodeNextToken(result.LastEvaluatedKey),
  };
};
