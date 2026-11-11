import type { ProjectItem } from '../types.js';

// Lista blanca de campos para las listas de proyectos: nunca incluye `description` ni `createdBy` (identificador del gestor).
export const toProjectSummary = (p: ProjectItem) => ({
  projectId: p.projectId,
  title: p.title,
  purpose: p.purpose,
  goalAmountCents: p.goalAmountCents,
  confirmedAmountCents: p.confirmedAmountCents,
  currency: p.currency,
  status: p.status,
  createdAt: p.createdAt,
});
