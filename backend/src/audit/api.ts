import { z } from 'zod';
import { extractAndVerifyContext } from '../authz/api.js';
import { authorizeActionService } from '../authz/services/avp.service.js';
import { buildSuccessResponse } from '../shared/utils/response.js';
import { withAccessLog } from '../shared/logger/access-log.js';
import { DEFAULT_PAGE_SIZE, isoDateSchema, paginationQuerySchema } from '../shared/schemas/common.schema.js';
import { listAuditLogsService } from './services/list-audit.service.js';

const auditQuerySchema = paginationQuerySchema
  .extend({
    eventType: z.string().min(1).max(64).optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from no puede ser posterior a to',
    path: ['from'],
  });

export const listAuditLogsHandler = withAccessLog('listAuditLogs', async (event) => {
  const user = extractAndVerifyContext(event, 'api/audit.read');
  await authorizeActionService(user, 'ReadAuditLogs');

  const { eventType, from, to, limit = DEFAULT_PAGE_SIZE, nextToken } = auditQuerySchema.parse(
    event.queryStringParameters ?? {}
  );

  const result = await listAuditLogsService(eventType, from, to, limit, nextToken);
  return buildSuccessResponse(200, result);
});
