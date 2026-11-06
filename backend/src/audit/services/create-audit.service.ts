import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient } from '../../shared/aws/dynamodb.client.js';
import { env } from '../../shared/config/env.js';
import type { CreateAuditInput, AuditEventItem } from '../types.js';
import { createHash, randomUUID } from 'node:crypto';
import { logger } from '../../shared/logger/logger.js';

export const createAuditLogService = async (input: CreateAuditInput): Promise<AuditEventItem | null> => {
  try {
    const eventId = randomUUID();
    const timestamp = new Date().toISOString();
    const actorRef = `actor_${createHash('sha256').update(input.actorSub).digest('hex').substring(0, 8)}`;

    const item: AuditEventItem = {
      eventType: input.eventType,
      timestampEventId: `${timestamp}#${eventId}`,
      timestamp,
      eventId,
      requestId: input.requestId,
      actorRef,
      action: input.action,
      resourceRef: input.resourceRef,
      outcome: input.outcome,
    };

    await docClient.send(new PutCommand({ TableName: env.AUDIT_TABLE, Item: item }));
    return item;
  } catch (err) {
    logger.error('Error no bloqueante en auditoría', { error: String(err) });
    return null;
  }
};