import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { authzHook } from '../authz/hook.js';
import {
  validateCreateDonation,
  validateIdempotencyKeyHeader,
  validateSimulateDonation,
  validateDonationIdParam,
  createDonation,
  simulateDonation,
  listDonationsByDonor,
} from './components/index.js';
import { createAuditLog } from '../audit/components/create-audit-log.js';
import { AppError } from '../shared/errors/app-error.js';

export class DonationsHook {
  public async handleCreateDonation(event: APIGatewayProxyEventV2) {
    // Exige rol DONANTE y scope api/donations.write
    const user = authzHook.requireRoleAndScope(event, 'DONANTE', 'api/donations.write');

    // Validar cabecera Idempotency-Key
    const idempotencyKey = validateIdempotencyKeyHeader(event.headers || {});

    if (!event.body) {
      throw AppError.badRequest('El cuerpo de la solicitud es requerido');
    }

    const payload = JSON.parse(event.body);
    const validatedInput = validateCreateDonation(payload);

    const result = await createDonation(
      {
        projectId: validatedInput.projectId,
        amountCents: validatedInput.amountCents,
        idempotencyKey,
      },
      user.sub
    );

    // Auditoría
    await createAuditLog({
      eventType: 'DONATION_EVENT',
      requestId: event.requestContext.requestId,
      actorSub: user.sub,
      action: 'CREATE_DONATION_INTENT',
      resourceRef: result.data.donationId,
      outcome: 'SUCCESS',
    });

    return result;
  }

  public async handleSimulateDonation(event: APIGatewayProxyEventV2) {
    const user = authzHook.requireRoleAndScope(event, 'DONANTE', 'api/donations.write');
    const donationId = validateDonationIdParam(event.pathParameters || null);

    if (!event.body) {
      throw AppError.badRequest('El cuerpo de la solicitud es requerido');
    }

    const payload = JSON.parse(event.body);
    const validatedInput = validateSimulateDonation(payload);

    const result = await simulateDonation(
      {
        donationId,
        result: validatedInput.result,
      },
      user.sub
    );

    // Auditoría
    await createAuditLog({
      eventType: 'DONATION_EVENT',
      requestId: event.requestContext.requestId,
      actorSub: user.sub,
      action: 'SIMULATE_DONATION',
      resourceRef: donationId,
      outcome: 'SUCCESS',
    });

    return result;
  }

  public async handleListMyDonations(event: APIGatewayProxyEventV2) {
    const user = authzHook.requireRoleAndScope(event, 'DONANTE', 'api/donations.read');
    const limitParam = event.queryStringParameters?.['limit'];
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const nextToken = event.queryStringParameters?.['nextToken'];

    return await listDonationsByDonor(user.sub, limit, nextToken);
  }
}

export const donationsHook = new DonationsHook();