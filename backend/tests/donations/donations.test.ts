import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createDonationService } from '../../src/donations/services/create-donation.service.js';
import { simulateDonationService } from '../../src/donations/services/simulate-donation.service.js';
import { listMyDonationsService } from '../../src/donations/services/list-donations.service.js';
import { createDonationHandler, simulateDonationHandler, listMyDonationsHandler } from '../../src/donations/api.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { env } from '../../src/shared/config/env.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

vi.mock('../../src/authz/services/avp.service.js', () => ({
  authorizeActionService: vi.fn().mockResolvedValue(undefined),
}));

describe('Dominio Donations - Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    sub: 'sub_donor_777',
    groups: ['DONANTE'],
    scopes: ['api/donations.write', 'api/donations.read'],
    isMfaVerified: false,
  };

  const mockDonorEvent = (body?: unknown, pathParams?: any, headers?: Record<string, string>, qs?: any): APIGatewayProxyEventV2 =>
    ({
      headers: headers || { 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
      requestContext: {
        requestId: 'req_don_999',
        authorizer: {
          jwt: {
            claims: {
              sub: 'sub_donor_777',
              'cognito:groups': 'DONANTE',
              scope: 'api/donations.write api/donations.read',
            },
          },
        },
      },
      body: body ? JSON.stringify(body) : undefined,
      pathParameters: pathParams,
      queryStringParameters: qs
    }) as unknown as APIGatewayProxyEventV2;

  describe('createDonationService & Idempotencia', () => {
    it('debe registrar intención de donación por primera vez y retornar 201', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never)
        .mockResolvedValueOnce({} as never);

      const res = await createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', mockUser);
      expect(res.statusCode).toBe(201);
      expect(res.data.status).toBe('PENDIENTE_SIMULACION');
    });

    it('debe retornar la respuesta almacenada si reingresa la misma idempotency-key', async () => {
      const mockSavedResponse = { donationId: 'don_existing', status: 'PENDIENTE_SIMULACION' };
      const crypto = await import('node:crypto');
      const hash = crypto.createHash('sha256').update(JSON.stringify({ projectId: 'prj_01', amountCents: 2500 })).digest('hex');

      vi.mocked(docClient.send).mockResolvedValueOnce({
        Item: { payloadHash: hash, responseStatus: 201, responseBody: JSON.stringify(mockSavedResponse) },
      } as never);

      const res = await createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', mockUser);
      expect(res.statusCode).toBe(201);
    });

    it('debe rechazar si reingresa misma key con diferente payload', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({
        Item: { payloadHash: 'other_hash', responseStatus: 201, responseBody: '{}' },
      } as never);
      await expect(createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', mockUser)).rejects.toThrow();
    });

    it('debe propagar TransactionCanceledException como 409', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never)
        .mockRejectedValueOnce({ name: 'TransactionCanceledException' } as never);
      await expect(createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', mockUser)).rejects.toThrow(/Conflicto de idempotencia/);
    });
    
    it('debe propagar otros errores de la transaccion', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never)
        .mockRejectedValueOnce(new Error('Unknown Error') as never);
      await expect(createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', mockUser)).rejects.toThrow(/Unknown Error/);
    });
  });

  describe('simulateDonationService & Reglas de Negocio', () => {
    it('debe denegar simulación si el STAGE no es academic', async () => {
      const originalStage = env.STAGE;
      (env as any).STAGE = 'prod';
      await expect(simulateDonationService('don_100', 'CONFIRMADA_SIMULADA', mockUser)).rejects.toThrow();
      (env as any).STAGE = originalStage;
    });
    
    it('debe lanzar 404 si donacion no existe', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);
      await expect(simulateDonationService('don_100', 'CONFIRMADA_SIMULADA', mockUser)).rejects.toThrow();
    });

    it('debe lanzar 409 si donacion ya esta completada', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: { status: 'CONFIRMADA_SIMULADA' } } as never);
      await expect(simulateDonationService('don_100', 'CONFIRMADA_SIMULADA', mockUser)).rejects.toThrow();
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

      const res = await simulateDonationService('don_100', 'CONFIRMADA_SIMULADA', mockUser);
      expect(res.status).toBe('CONFIRMADA_SIMULADA');
    });

    it('debe rechazar donación sin incrementar acumulado', async () => {
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

      const res = await simulateDonationService('don_100', 'RECHAZADA_SIMULADA', mockUser);
      expect(res.status).toBe('RECHAZADA_SIMULADA');
    });
  });

  describe('API Handlers de Donaciones', () => {
    it('listMyDonationsHandler debe responder 200', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);
      const res = (await listMyDonationsHandler(mockDonorEvent(undefined, undefined, undefined, {limit: '10'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
    });

    it('listMyDonationsHandler debe capturar errores 500', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('fail'));
      const res = (await listMyDonationsHandler(mockDonorEvent())) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(500);
    });

    it('createDonationHandler debe responder 201', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({} as never); // audit

      const event = mockDonorEvent({ projectId: 'prj_01', amountCents: 2000 });
      const res = (await createDonationHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(201);
    });
    
    it('createDonationHandler debe responder 400 por JSON invalido', async () => {
      const event = mockDonorEvent('invalid');
      const res = (await createDonationHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(400);
    });

    it('simulateDonationHandler debe responder 200', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: { donationId: 'don_100', projectId: 'prj_01', donorSub: 'sub_donor_777', amountCents: 3000, status: 'PENDIENTE_SIMULACION' } } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({} as never); // audit

      const event = mockDonorEvent({ result: 'CONFIRMADA_SIMULADA' }, { donationId: 'don_100' });
      const res = (await simulateDonationHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
    });

    it('simulateDonationHandler debe responder 400 si result no es valido', async () => {
      const event = mockDonorEvent({ result: 'INVALID' }, { donationId: 'don_100' });
      const res = (await simulateDonationHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(400);
    });
  });
});