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

export interface CreateProjectInput {
  title: string;
  description: string;
  purpose: string;
  goalAmountCents: number;
}

export interface ProjectResponseDTO {
  projectId: string;
  title: string;
  description?: string;
  purpose: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: 'PEN';
  status: ProjectStatus;
  createdAt: string;
  updatedAt?: string;
  publishedAt?: string;
}

export interface ProjectStatsDTO {
  projectId: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: 'PEN';
  progress: number;
}