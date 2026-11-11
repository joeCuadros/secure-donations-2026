// DENIED: acceso denegado; FAILURE: rechazo por validación o regla de negocio; ERROR: fallo inesperado.
export type AuditOutcome = "SUCCESS" | "FAILURE" | "DENIED" | "ERROR";

export interface AuditEvent {
  eventType: string;
  timestampEventId: string;
  timestamp: string;
  eventId: string;
  requestId: string;
  actorRef: string;
  action: string;
  resourceRef: string;
  outcome: AuditOutcome;
}

export interface AuditListResponse {
  items: AuditEvent[];
  nextToken: string | null;
}

export type ListAuditParams = {
  eventType?: string;
  from?: string;
  to?: string;
  nextToken?: string;
  limit?: number;
};
