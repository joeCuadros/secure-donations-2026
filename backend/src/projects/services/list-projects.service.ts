import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { ProjectItem } from '../types.js';
import { encodeNextToken, decodeNextToken } from '../../shared/utils/pagination.js';
import { toProjectSummary } from './project-summary.js';

export const listProjectsService = async (limit: number = 20, nextToken?: string) => {
  const result = await docClient.send(
    new QueryCommand({
      TableName: env.PROJECTS_TABLE,
      IndexName: 'status-createdAt',
      KeyConditionExpression: '#s = :statusVal',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':statusVal': 'PUBLICADO' },
      Limit: limit,
      ExclusiveStartKey: decodeNextToken(nextToken),
      ScanIndexForward: false,
    })
  );

  const items = (result.Items as ProjectItem[]) || [];
  return {
    items: items.map(toProjectSummary),
    nextToken: encodeNextToken(result.LastEvaluatedKey),
  };
};
