export interface AuditEventItem {
  eventType: string;
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