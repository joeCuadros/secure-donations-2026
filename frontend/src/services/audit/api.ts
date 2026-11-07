import { apiClient } from "../apiClient";
import type { AuditListResponse, ListAuditParams } from "./types";

export const auditApi = {
  list: (params?: ListAuditParams) => 
    apiClient<AuditListResponse>("/v1/audit", { params }),
};