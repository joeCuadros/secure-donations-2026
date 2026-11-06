import { projectRepository } from './project.repository.js';
import type { CreateProjectInput, ProjectItem, ProjectResponseDTO } from './project.types.js';
import { randomUUID } from 'node:crypto';

export const createProject = async (
  input: CreateProjectInput,
  createdBySub: string
): Promise<ProjectResponseDTO> => {
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

  await projectRepository.create(item);

  return {
    projectId: item.projectId,
    title: item.title,
    description: item.description,
    purpose: item.purpose,
    goalAmountCents: item.goalAmountCents,
    confirmedAmountCents: item.confirmedAmountCents,
    currency: item.currency,
    status: item.status,
    createdAt: item.createdAt,
  };
};