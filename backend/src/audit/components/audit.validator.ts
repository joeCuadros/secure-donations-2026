import { z } from 'zod';
import { isoDateSchema, paginationQuerySchema } from '../../shared/schemas/common.schema.js';

export const queryAuditSchema = paginationQuerySchema.extend({
  eventType: z.string().optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type QueryAuditDTO = z.infer<typeof queryAuditSchema>;

export const validateQueryAudit = (params: Record<string, string | undefined>): QueryAuditDTO => {
  return queryAuditSchema.parse(params);
};