import { projectRepository } from './project.repository.js';
import type { ProjectResponseDTO } from './project.types.js';

export const listProjects = async (
  limit: number = 20,
  nextToken?: string
): Promise<{ items: ProjectResponseDTO[]; nextToken: string | null }> => {
  const { items, nextToken: newNextToken } = await projectRepository.listPublished(limit, nextToken);

  const formattedItems: ProjectResponseDTO[] = items.map((p) => ({
    projectId: p.projectId,
    title: p.title,
    purpose: p.purpose,
    goalAmountCents: p.goalAmountCents,
    confirmedAmountCents: p.confirmedAmountCents,
    currency: p.currency,
    status: p.status,
    createdAt: p.createdAt,
  }));

  return {
    items: formattedItems,
    nextToken: newNextToken,
  };
};