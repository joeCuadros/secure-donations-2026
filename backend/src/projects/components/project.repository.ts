import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { ProjectItem } from './project.types.js';
import { encodeNextToken, decodeNextToken } from '../../shared/utils/pagination.js';

export class ProjectRepository {
  private tableName = env.PROJECTS_TABLE;

  public async create(project: ProjectItem): Promise<ProjectItem> {
    await docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: project,
      })
    );
    return project;
  }

  public async getById(projectId: string): Promise<ProjectItem | null> {
    const result = await docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { projectId },
        ConsistentRead: true,
      })
    );
    return (result.Item as ProjectItem) || null;
  }

  public async listPublished(
    limit: number = 20,
    nextToken?: string
  ): Promise<{ items: ProjectItem[]; nextToken: string | null }> {
    const exclusiveStartKey = decodeNextToken(nextToken);

    const result = await docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'status-createdAt',
        KeyConditionExpression: '#status = :statusVal',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':statusVal': 'PUBLICADO',
        },
        Limit: limit,
        ExclusiveStartKey: exclusiveStartKey,
        ScanIndexForward: false, // Más recientes primero
      })
    );

    return {
      items: (result.Items as ProjectItem[]) || [],
      nextToken: encodeNextToken(result.LastEvaluatedKey),
    };
  }

  public async publish(projectId: string, nowIso: string): Promise<ProjectItem | null> {
    try {
      const result = await docClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: { projectId },
          UpdateExpression: 'SET #status = :publishedStatus, publishedAt = :now, updatedAt = :now',
          ConditionExpression: '#status = :draftStatus',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':publishedStatus': 'PUBLICADO',
            ':draftStatus': 'BORRADOR',
            ':now': nowIso,
          },
          ReturnValues: 'ALL_NEW',
        })
      );
      return (result.Attributes as ProjectItem) || null;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'name' in error &&
        error.name === 'ConditionalCheckFailedException'
      ) {
        return null; // O lanzará conflicto en el hook
      }
      throw error;
    }
  }
}

export const projectRepository = new ProjectRepository();