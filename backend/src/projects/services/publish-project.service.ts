import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { CreateProjectDTO, ProjectItem } from '../types.js';
import { authorizeActionService } from '../../authz/services/avp.service.js';
import type { AuthenticatedUser } from '../../authz/types.js';
import { randomUUID } from 'node:crypto';

export const createProjectService = async (
  input: CreateProjectDTO,
  user: AuthenticatedUser
): Promise<ProjectItem> => {
  // Aserción de autorización externa (Cedar): Valida permiso base para GESTOR
  await authorizeActionService(user, 'CreateProject');

  const now = new Date().toISOString();
  const projectId = `prj_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

  const item: ProjectItem = {
    projectId,
    title: input.title,
    description: input.description,
    purpose: input.purpose,
    goalAmountCents: input.goalAmountCents,
    confirmedAmountCents: 0,
    currency: 'PEN',
    status: 'BORRADOR',
    createdBy: user.sub,
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: env.PROJECTS_TABLE,
      Item: item,
    })
  );

  return item;
};