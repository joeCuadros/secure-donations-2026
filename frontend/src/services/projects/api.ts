import { apiClient } from "../apiClient";
import type { 
  Project, 
  CreateProjectRequest, 
  ProjectListResponse, 
  ProjectStatsResponse,
  ListProjectsParams 
} from "./types";

export const projectsApi = {
  list: (params?: ListProjectsParams) => 
    apiClient<ProjectListResponse>("/v1/projects", { params }),
  
  get: (projectId: string) => 
    apiClient<Project>(`/v1/projects/${projectId}`),
  
  getStats: (projectId: string) => 
    apiClient<ProjectStatsResponse>(`/v1/projects/${projectId}/stats`),
  
  create: (data: CreateProjectRequest) =>
    apiClient<Project>("/v1/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
    
  publish: (projectId: string) =>
    apiClient<Project>(`/v1/projects/${projectId}/publish`, {
      method: "PATCH",
    }),
};