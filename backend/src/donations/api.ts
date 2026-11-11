import { z } from 'zod';
import { extractAndVerifyContext } from '../authz/api.js';
import { buildSuccessResponse, parseJsonBody } from '../shared/utils/index.js';
import {
  DEFAULT_PAGE_SIZE,
  amountCentsSchema,
  paginationQuerySchema,
  uuidSchema,
} from '../shared/schemas/common.schema.js';
import { createDonationService } from './services/create-donation.service.js';
import { simulateDonationService } from './services/simulate-donation.service.js';
import { listMyDonationsService } from './services/list-donations.service.js';
import { withAuditedAccessLog } from '../audit/audited-handler.js';

const createDonationSchema = z.object({
  projectId: z.string().min(1),
  amountCents: amountCentsSchema,
});

const simulateSchema = z.object({
  result: z.enum(['CONFIRMADA_SIMULADA', 'RECHAZADA_SIMULADA']),
});

export const createDonationHandler = withAuditedAccessLog(
  'createDonation',
  { eventType: 'DONATION_EVENT', action: 'CREATE_DONATION_INTENT', recordSuccess: true },
  async (event, audit) => {
    const user = extractAndVerifyContext(event, 'api/donations.write');
    const rawHeader = event.headers?.['idempotency-key'] || event.headers?.['Idempotency-Key'];
    const idempotencyKey = uuidSchema.parse(rawHeader);
    const body = createDonationSchema.parse(parseJsonBody(event));

    const res = await createDonationService(body.projectId, body.amountCents, idempotencyKey, user);

    audit.resourceRef = res.data.donationId;
    return buildSuccessResponse(res.statusCode, res.data);
  }
);

export const simulateDonationHandler = withAuditedAccessLog(
  'simulateDonation',
  { eventType: 'DONATION_EVENT', action: 'SIMULATE_DONATION', recordSuccess: true, pathParam: 'donationId' },
  async (event) => {
    const user = extractAndVerifyContext(event, 'api/donations.write');
    const donationId = event.pathParameters?.donationId!;
    const body = simulateSchema.parse(parseJsonBody(event));

    const result = await simulateDonationService(donationId, body.result, user);

    return buildSuccessResponse(200, result);
  }
);

// Las consultas exitosas del historial propio no se auditan; solo los rechazos (NIST SP 800-207, tenet 7).
export const listMyDonationsHandler = withAuditedAccessLog(
  'listMyDonations',
  { eventType: 'DONATION_EVENT', action: 'LIST_MY_DONATIONS', recordSuccess: false },
  async (event) => {
    const user = extractAndVerifyContext(event, 'api/donations.read');
    const { limit = DEFAULT_PAGE_SIZE, nextToken } = paginationQuerySchema.parse(event.queryStringParameters ?? {});

    const result = await listMyDonationsService(user, limit, nextToken);
    return buildSuccessResponse(200, result);
  }
);
