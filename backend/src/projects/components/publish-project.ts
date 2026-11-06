import { projectRepository } from './project.repository.js';
import { AppError } from '../../shared/errors/app-error.js';

export const publishProject = async (
  projectId: string
): Promise<{ projectId: string; status: 'PUBLICADO'; publishedAt: string; updatedAt: string }> => {
  const project = await projectRepository.getById(projectId);

  if (!project) {
    throw AppError.notFound('Proyecto no encontrado.');
  }

  if (project.status === 'PUBLICADO') {
    throw AppError.conflict('El proyecto ya se encuentra publicado.');
  }

  const nowIso = new Date().toISOString();
  const updated = await projectRepository.publish(projectId, nowIso);

  if (!updated) {
    throw AppError.conflict('No se pudo publicar el proyecto. Verifique el estado inicial.');
  }

  return {
    projectId: updated.projectId,
    status: 'PUBLICADO',
    publishedAt: updated.publishedAt || nowIso,
    updatedAt: updated.updatedAt,
  };
};