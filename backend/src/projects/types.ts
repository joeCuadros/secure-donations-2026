export type ProjectStatus = 'BORRADOR' | 'PUBLICADO';

export interface ProjectItem {
  projectId: string;
  title: string;
  description: string;
  purpose: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: 'PEN';
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface CreateProjectDTO {
  title: string;
  description: string;
  purpose: string;
  goalAmountCents: number;
}