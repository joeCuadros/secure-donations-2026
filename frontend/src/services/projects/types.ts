export interface Project {
  projectId: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  status: "DRAFT" | "PUBLISHED" | "CLOSED";
  createdAt: string;
}

export interface CreateProjectRequest {
  title: string;
  description: string;
  targetAmount: number;
}

export interface ProjectListResponse {
  items: Project[];
  nextToken: string | null;
}

export interface ProjectStatsResponse {
  totalDonations: number;
  donorsCount: number;
}

export type ListProjectsParams = {
  nextToken?: string;
  status?: "DRAFT" | "PUBLISHED" | "CLOSED";
  limit?: number;
}