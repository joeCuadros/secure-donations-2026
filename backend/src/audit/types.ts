// Valor constante de `gsi1pk`: agrupa todos los eventos en una sola partición del índice
// AllAuditLogsIndex para listarlos sin filtrar por tipo (HU-10).
export const AUDIT_GSI_PARTITION = 'AUDIT';

export interface AuditEventItem {
  eventType: string;
  gsi1pk: typeof AUDIT_GSI_PARTITION;
  timestampEventId: string;
  timestamp: string;
  eventId: string;
  requestId: string;
  actorRef: string;
  action: string;
  resourceRef: string;
  outcome: 'SUCCESS' | 'FAILURE';
}

export interface CreateAuditInput {
  eventType: string;
  requestId: string;
  actorSub: string;
  action: string;
  resourceRef: string;
  outcome: 'SUCCESS' | 'FAILURE';
}
