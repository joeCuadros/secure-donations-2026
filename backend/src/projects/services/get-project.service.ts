import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { ProjectItem } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';

export const getProjectService = async (projectId: string): Promise<ProjectItem> => {
  const result = await docClient.send(
    new GetCommand({
      TableName: env.PROJECTS_TABLE,
      Key: { projectId },
      ConsistentRead: true,
    })
  );

  const project = result.Item as ProjectItem | undefined;
  if (!project || project.status !== 'PUBLICADO') {
    throw AppError.notFound('El proyecto no existe o no se encuentra publicado.');
  }

  return project;
};