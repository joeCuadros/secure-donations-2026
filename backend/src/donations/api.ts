import { z } from 'zod';
import { extractAndVerifyContext } from '../authz/api.js';
import { buildSuccessResponse, parseJsonBody } from '../shared/utils/index.js';
import { withAccessLog } from '../shared/logger/access-log.js';
import {
  DEFAULT_PAGE_SIZE,
  amountCentsSchema,
  paginationQuerySchema,
  uuidSchema,
} from '../shared/schemas/common.schema.js';
import { createDonationService } from './services/create-donation.service.js';
import { simulateDonationService } from './services/simulate-donation.service.js';
import { listMyDonationsService } from './services/list-donations.service.js';
import { createAuditLogService } from '../audit/services/create-audit.service.js';

const createDonationSchema = z.object({
  projectId: z.string().min(1),
  amountCents: amountCentsSchema,
});

const simulateSchema = z.object({
  result: z.enum(['CONFIRMADA_SIMULADA', 'RECHAZADA_SIMULADA']),
});

export const createDonationHandler = withAccessLog('createDonation', async (event) => {
  const requestId = event.requestContext.requestId;
  const user = extractAndVerifyContext(event, 'api/donations.write');
  const rawHeader = event.headers?.['idempotency-key'] || event.headers?.['Idempotency-Key'];
  const idempotencyKey = uuidSchema.parse(rawHeader);
  const body = createDonationSchema.parse(parseJsonBody(event));

  const res = await createDonationService(body.projectId, body.amountCents, idempotencyKey, user);

  await createAuditLogService({
    eventType: 'DONATION_EVENT',
    requestId,
    actorSub: user.sub,
    action: 'CREATE_DONATION_INTENT',
    resourceRef: res.data.donationId,
    outcome: 'SUCCESS',
  });

  return buildSuccessResponse(res.statusCode, res.data);
});

export const simulateDonationHandler = withAccessLog('simulateDonation', async (event) => {
  const requestId = event.requestContext.requestId;
  const user = extractAndVerifyContext(event, 'api/donations.write');
  const donationId = event.pathParameters?.donationId!;
  const body = simulateSchema.parse(parseJsonBody(event));

  const result = await simulateDonationService(donationId, body.result, user);

  await createAuditLogService({
    eventType: 'DONATION_EVENT',
    requestId,
    actorSub: user.sub,
    action: 'SIMULATE_DONATION',
    resourceRef: donationId,
    outcome: 'SUCCESS',
  });

  return buildSuccessResponse(200, result);
});

export const listMyDonationsHandler = withAccessLog('listMyDonations', async (event) => {
  const user = extractAndVerifyContext(event, 'api/donations.read');
  const { limit = DEFAULT_PAGE_SIZE, nextToken } = paginationQuerySchema.parse(event.queryStringParameters ?? {});

  const result = await listMyDonationsService(user, limit, nextToken);
  return buildSuccessResponse(200, result);
});
