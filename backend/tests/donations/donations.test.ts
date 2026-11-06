import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createDonationService } from '../../src/donations/services/create-donation.service.js';
import { simulateDonationService } from '../../src/donations/services/simulate-donation.service.js';
import { listMyDonationsService } from '../../src/donations/services/list-donations.service.js';
import {
  createDonationHandler,
  simulateDonationHandler,
  listMyDonationsHandler,
} from '../../src/donations/api.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { env } from '../../src/shared/config/env.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

describe('Dominio Donations - Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockDonorEvent = (body?: unknown, pathParams?: any, headers?: Record<string, string>): APIGatewayProxyEventV2 =>
    ({
      version: '2.0',
      routeKey: 'POST /v1/donations',
      rawPath: '/v1/donations',
      rawQueryString: '',
      headers: headers || { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
      isBase64Encoded: false,
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'id.execute-api.us-east-1.amazonaws.com',
        domainPrefix: 'id',
        http: {
          method: 'POST',
          path: '/v1/donations',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'CustomAgent',
        },
        requestId: 'req_don_999',
        routeKey: 'POST /v1/donations',
        stage: 'academic',
        time: '05/Nov/2026:10:00:00 +0000',
        timeEpoch: 1793872800000,
        authorizer: {
          jwt: {
            claims: {
              sub: 'sub_donor_777',
              'cognito:groups': 'DONANTE',
              scope: 'api/donations.write api/donations.read',
            },
            scopes: [],
          },
        },
      },
      body: body ? JSON.stringify(body) : undefined,
      pathParameters: pathParams,
    }) as unknown as APIGatewayProxyEventV2;

  describe('createDonationService & Idempotencia', () => {
    it('debe registrar intención de donación por primera vez y retornar 201', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never)
        .mockResolvedValueOnce({} as never);

      const res = await createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', 'sub_donor_777');

      expect(res.statusCode).toBe(201);
      expect(res.data.amountCents).toBe(2500);
      expect(res.data.status).toBe('PENDIENTE_SIMULACION');
    });

    it('debe retornar la respuesta almacenada si reingresa la misma idempotency-key con igual payload', async () => {
      const mockSavedResponse = {
        donationId: 'don_existing_123',
        projectId: 'prj_01',
        amountCents: 2500,
        currency: 'PEN',
        status: 'PENDIENTE_SIMULACION',
      };

      const crypto = await import('node:crypto');
      const expectedHash = crypto.createHash('sha256').update(JSON.stringify({ projectId: 'prj_01', amountCents: 2500 })).digest('hex');

      vi.mocked(docClient.send).mockResolvedValueOnce({
        Item: {
          pk: 'sub_donor_777#createDonation#550e8400-e29b-41d4-a716-446655440000',
          payloadHash: expectedHash,
          responseStatus: 201,
          responseBody: JSON.stringify(mockSavedResponse),
        },
      } as never);

      const res = await createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', 'sub_donor_777');

      expect(res.statusCode).toBe(201);
      expect(res.data.donationId).toBe('don_existing_123');
    });

    it('debe lanzar 409 Conflict si el proyecto no está publicado', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'BORRADOR' } } as never);

      await expect(
        createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', 'sub_donor_777')
      ).rejects.toThrow();
    });
  });

  describe('simulateDonationService & Reglas de Negocio', () => {
    it('debe denegar simulación si el STAGE no es academic', async () => {
      const originalStage = env.STAGE;
      (env as any).STAGE = 'prod';

      await expect(
        simulateDonationService('don_100', 'CONFIRMADA_SIMULADA', 'sub_donor_777')
      ).rejects.toThrow();

      (env as any).STAGE = originalStage;
    });

    it('debe lanzar 404 si la donación no existe', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);

      await expect(
        simulateDonationService('don_not_found', 'CONFIRMADA_SIMULADA', 'sub_donor_777')
      ).rejects.toThrow();
    });

    it('debe confirmar donación e incrementar acumulado de proyecto', async () => {
      const mockDonation = {
        donationId: 'don_100',
        projectId: 'prj_01',
        donorSub: 'sub_donor_777',
        amountCents: 3000,
        status: 'PENDIENTE_SIMULACION',
      };

      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: mockDonation } as never)
        .mockResolvedValueOnce({} as never);

      const res = await simulateDonationService('don_100', 'CONFIRMADA_SIMULADA', 'sub_donor_777');

      expect(res.status).toBe('CONFIRMADA_SIMULADA');
      expect(res.donationId).toBe('don_100');
    });
  });

  describe('API Handlers de Donaciones (Errores)', () => {
    it('createDonationHandler debe responder 400 si el JSON del body es inválido', async () => {
      const event = mockDonorEvent('invalid_json');
      const res = (await createDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
    });

    it('simulateDonationHandler debe responder 400 si result no es válido', async () => {
      const event = mockDonorEvent({ result: 'ESTADO_INVALIDO' }, { donationId: 'don_100' });
      const res = (await simulateDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
    });

    it('listMyDonationsHandler debe responder 500 si falla la consulta', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('DynamoFail'));

      const event = mockDonorEvent();
      const res = (await listMyDonationsHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(500);
    });
  });
});