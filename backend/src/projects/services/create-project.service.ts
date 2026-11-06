import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { CreateProjectDTO, ProjectItem } from '../types.js';
import { randomUUID } from 'node:crypto';

export const createProjectService = async (
  input: CreateProjectDTO,
  createdBySub: string
): Promise<ProjectItem> => {
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
    createdBy: createdBySub,
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