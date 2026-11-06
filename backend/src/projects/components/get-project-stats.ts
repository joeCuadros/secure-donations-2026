import { projectRepository } from './project.repository.js';
import type { ProjectStatsDTO } from './project.types.js';
import { AppError } from '../../shared/errors/app-error.js';

export const getProjectStats = async (projectId: string): Promise<ProjectStatsDTO> => {
  const project = await projectRepository.getById(projectId);

  if (!project || project.status !== 'PUBLICADO') {
    throw AppError.notFound('El proyecto no existe o no se encuentra publicado.');
  }

  const progress = Math.min(
    100,
    Math.round((project.confirmedAmountCents / project.goalAmountCents) * 100)
  );

  return {
    projectId: project.projectId,
    goalAmountCents: project.goalAmountCents,
    confirmedAmountCents: project.confirmedAmountCents,
    currency: project.currency,
    progress,
  };
};