import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { ProjectItem } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';

// Lectura interna sin filtrar por estado: los llamadores deciden cómo tratar un BORRADOR.
export const findProjectService = async (projectId: string): Promise<ProjectItem | undefined> => {
  const result = await docClient.send(
    new GetCommand({
      TableName: env.PROJECTS_TABLE,
      Key: { projectId },
      ConsistentRead: true,
    })
  );

  return result.Item as ProjectItem | undefined;
};

// Vista pública: un BORRADOR es indistinguible de un proyecto inexistente (404, CA-02.2).
export const getProjectService = async (projectId: string): Promise<ProjectItem> => {
  const project = await findProjectService(projectId);
  if (!project || project.status !== 'PUBLICADO') {
    throw AppError.notFound('El proyecto no existe o no se encuentra publicado.');
  }

  return project;
};
