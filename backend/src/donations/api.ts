import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { extractAndVerifyContext } from '../authz/api.js';
import { buildSuccessResponse } from '../shared/utils/response.js';
import { handleError } from '../shared/errors/error-handler.js';
import { uuidSchema, amountCentsSchema } from '../shared/schemas/common.schema.js';
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

export const createDonationHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const user = extractAndVerifyContext(event, 'api/donations.write');
    const rawHeader = event.headers?.['idempotency-key'] || event.headers?.['Idempotency-Key'];
    const idempotencyKey = uuidSchema.parse(rawHeader);
    const body = createDonationSchema.parse(JSON.parse(event.body || '{}'));

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
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const simulateDonationHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const user = extractAndVerifyContext(event, 'api/donations.write');
    const donationId = event.pathParameters?.donationId!;
    const body = simulateSchema.parse(JSON.parse(event.body || '{}'));

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
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const listMyDonationsHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const user = extractAndVerifyContext(event, 'api/donations.read');
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit, 10) : 20;
    const nextToken = event.queryStringParameters?.nextToken;

    const result = await listMyDonationsService(user, limit, nextToken);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};