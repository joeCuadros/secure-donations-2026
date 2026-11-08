export type ProjectStatus = "BORRADOR" | "PUBLICADO";

export interface Project {
  projectId: string;
  title: string;
  description: string;
  purpose: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: "PEN";
  status: ProjectStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

export interface ProjectSummary {
  projectId: string;
  title: string;
  purpose: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: "PEN";
  status: ProjectStatus;
  createdAt: string;
}

export interface CreateProjectRequest {
  title: string;
  description: string;
  purpose: string;
  goalAmountCents: number;
}

export interface PublishProjectResponse {
  projectId: string;
  status: ProjectStatus;
  publishedAt: string;
  updatedAt: string;
}

export interface ProjectListResponse {
  items: ProjectSummary[];
  nextToken: string | null;
}

export interface ProjectStatsResponse {
  projectId: string;
  goalAmountCents: number;
  confirmedAmountCents: number;
  currency: "PEN";
  progress: number;
}

export type ListProjectsParams = {
  nextToken?: string;
  limit?: number;
};
