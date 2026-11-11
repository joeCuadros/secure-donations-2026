import { apiClient } from "../apiClient";
import type {
  CreateProjectRequest,
  ListProjectsParams,
  Project,
  ProjectListResponse,
  ProjectStatsResponse,
  PublishProjectResponse,
} from "./types";

export const projectsApi = {
  list: (params?: ListProjectsParams) =>
    apiClient<ProjectListResponse>("/v1/projects", { params }),

  // Solo GESTOR (api/projects.write): el backend decide; el borrador no aparece en el catálogo público.
  listDrafts: (params?: ListProjectsParams) =>
    apiClient<ProjectListResponse>("/v1/projects/drafts", { params }),

  get: (projectId: string) =>
    apiClient<Project>(`/v1/projects/${encodeURIComponent(projectId)}`),

  getStats: (projectId: string) =>
    apiClient<ProjectStatsResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}/stats`
    ),

  create: (data: CreateProjectRequest) =>
    apiClient<Project>("/v1/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  publish: (projectId: string) =>
    apiClient<PublishProjectResponse>(
      `/v1/projects/${encodeURIComponent(projectId)}/publish`,
      { method: "PATCH" }
    ),
};
