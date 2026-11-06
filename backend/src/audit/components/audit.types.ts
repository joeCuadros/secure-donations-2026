export type AuditOutcome = 'SUCCESS' | 'FAILURE';

export interface AuditEventItem {
  eventType: string;
  timestampEventId: string; // SK: ISO_TIMESTAMP#EVENT_ID
  timestamp: string;
  eventId: string;
  requestId: string;
  actorRef: string; // Sub seudonimizado o hashed
  action: string;
  resourceRef: string;
  outcome: AuditOutcome;
}

export interface CreateAuditInput {
  eventType: string;
  requestId: string;
  actorSub: string;
  action: string;
  resourceRef: string;
  outcome: AuditOutcome;
}

export interface QueryAuditInput {
  eventType?: string;
  from?: string;
  to?: string;
  limit?: number;
  nextToken?: string;
}