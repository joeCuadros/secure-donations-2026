// Valor constante de `gsi1pk`: agrupa todos los eventos en una sola partición del índice
// AllAuditLogsIndex para listarlos sin filtrar por tipo (HU-10).
export const AUDIT_GSI_PARTITION = 'AUDIT';

// SUCCESS: operación completada. DENIED: autorización o identidad rechazada (401/403).
// FAILURE: rechazo de negocio o validación (400, 404, 409). ERROR: fallo inesperado (5xx).
export type AuditOutcome = 'SUCCESS' | 'FAILURE' | 'DENIED' | 'ERROR';

// Seudónimo constante cuando no hay una identidad verificada en la solicitud (por ejemplo, un 401 en Lambda).
export const UNKNOWN_ACTOR_REF = 'actor_unknown';

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
  outcome: AuditOutcome;
}

export interface CreateAuditInput {
  eventType: string;
  requestId: string;
  // Sin `actorSub` (identidad no verificada) el actor se registra como `actor_unknown`.
  actorSub?: string | undefined;
  action: string;
  resourceRef: string;
  outcome: AuditOutcome;
}
