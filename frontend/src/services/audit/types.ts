export interface AuditEvent {
  eventType: string;
  timestampEventId: string;
  payload: Record<string, unknown>;
  actorSub: string;
}

export interface AuditListResponse {
  items: AuditEvent[];
  nextToken: string | null;
}

export type ListAuditParams = {
  nextToken?: string;
  limit?: number;
};