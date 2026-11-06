import { auditRepository } from './audit.repository.js';
import type { QueryAuditInput, AuditEventItem } from './audit.types.js';

export const listAuditLogs = async (
  query: QueryAuditInput
): Promise<{ items: AuditEventItem[]; nextToken: string | null }> => {
  return auditRepository.listLogs(query);
};