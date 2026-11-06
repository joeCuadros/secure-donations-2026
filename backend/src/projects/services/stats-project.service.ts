import { getProjectService } from './get-project.service.js';

export const getProjectStatsService = async (projectId: string) => {
  const project = await getProjectService(projectId);
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