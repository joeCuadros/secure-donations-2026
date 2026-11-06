import { projectRepository } from './project.repository.js';
import type { ProjectResponseDTO } from './project.types.js';
import { AppError } from '../../shared/errors/app-error.js';

export const getProject = async (
  projectId: string
): Promise<ProjectResponseDTO> => {
  const project = await projectRepository.getById(projectId);

  if (!project || project.status !== 'PUBLICADO') {
    throw AppError.notFound('El proyecto no existe o no se encuentra publicado.');
  }

  return {
    projectId: project.projectId,
    title: project.title,
    description: project.description,
    purpose: project.purpose,
    goalAmountCents: project.goalAmountCents,
    confirmedAmountCents: project.confirmedAmountCents,
    currency: project.currency,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    ...(project.publishedAt !== undefined
      ? { publishedAt: project.publishedAt }
      : {}),
  };
};