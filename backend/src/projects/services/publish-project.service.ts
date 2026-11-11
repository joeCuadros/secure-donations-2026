import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { ProjectItem } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { authorizeActionService } from '../../authz/services/avp.service.js';
import type { AuthenticatedUser } from '../../authz/types.js';

export const publishProjectService = async (projectId: string, user: AuthenticatedUser) => {
  await authorizeActionService(user, 'PublishProject', 'Project', projectId);

  const getRes = await docClient.send(
    new GetCommand({ TableName: env.PROJECTS_TABLE, Key: { projectId } })
  );
  const project = getRes.Item as ProjectItem | undefined;

  if (!project) throw AppError.notFound('Proyecto no encontrado.');
  if (project.status === 'PUBLICADO') throw AppError.conflict('El proyecto ya se encuentra publicado.');

  const now = new Date().toISOString();
  await docClient.send(
    new UpdateCommand({
      TableName: env.PROJECTS_TABLE,
      Key: { projectId },
      UpdateExpression: 'SET #s = :pubStatus, publishedAt = :now, updatedAt = :now',
      ConditionExpression: '#s = :draftStatus',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':pubStatus': 'PUBLICADO',
        ':draftStatus': 'BORRADOR',
        ':now': now,
      },
    })
  );

  return {
    projectId,
    status: 'PUBLICADO',
    publishedAt: now,
    updatedAt: now,
  };
};