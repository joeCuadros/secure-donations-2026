import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createDonationService } from '../../src/donations/services/create-donation.service.js';
import { simulateDonationService } from '../../src/donations/services/simulate-donation.service.js';
import { listMyDonationsService } from '../../src/donations/services/list-donations.service.js';
import { createDonationHandler, simulateDonationHandler, listMyDonationsHandler } from '../../src/donations/api.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { env } from '../../src/shared/config/env.js';
import { authorizeActionService } from '../../src/authz/services/avp.service.js';
import { expectOnlyAuditWrites } from '../helpers/audit-calls.js';

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

  describe('Validación de entrada (T04, CA-05.2)', () => {
    it.each([0, 99, 100001, 12.5, -5, '2500'])('T04 / CA-05.2: amountCents=%j responde 400 y no escribe', async (amountCents) => {
      const res = (await createDonationHandler(mockDonorEvent({ projectId: 'prj_01', amountCents }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
      expectOnlyAuditWrites(); // solo el evento FAILURE de auditoría
    });

    it('CA-05.2: la ausencia de Idempotency-Key responde 400', async () => {
      const event = mockDonorEvent({ projectId: 'prj_01', amountCents: 2500 }, undefined, {});
      const res = (await createDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
      expectOnlyAuditWrites(); // solo el evento FAILURE de auditoría
    });

    it('CA-05.2: un Idempotency-Key que no es UUID responde 400', async () => {
      const event = mockDonorEvent({ projectId: 'prj_01', amountCents: 2500 }, undefined, { 'idempotency-key': 'no-es-uuid' });
      const res = (await createDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
    });

    it('CA-05.2: createDonationHandler responde 400 uniforme ante un JSON malformado (no 500)', async () => {
      const event = { ...mockDonorEvent(), body: '{"projectId": "prj_01", "amountCents":' } as APIGatewayProxyEventV2;

      const res = (await createDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body as string)).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        requestId: 'req_don_999',
      });
      expectOnlyAuditWrites(); // solo el evento FAILURE de auditoría
    });

    it('CA-06.1: simulateDonationHandler responde 400 uniforme ante un JSON malformado (no 500)', async () => {
      const event = { ...mockDonorEvent(undefined, { donationId: 'don_100' }), body: 'result=CONFIRMADA_SIMULADA' } as APIGatewayProxyEventV2;

      const res = (await simulateDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body as string).code).toBe('VALIDATION_ERROR');
      expectOnlyAuditWrites(); // solo el evento FAILURE de auditoría
    });

    it('CA-05.2: un cuerpo con base64 (isBase64Encoded) se decodifica antes de interpretarlo', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({} as never);
      const body = Buffer.from(JSON.stringify({ projectId: 'prj_01', amountCents: 2000 })).toString('base64');
      const event = { ...mockDonorEvent(), body, isBase64Encoded: true } as APIGatewayProxyEventV2;

      const res = (await createDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(201);
    });

    it('CA-05.3: el donorSub proviene del token y nunca del cuerpo de la solicitud', async () => {
      vi.mocked(docClient.send).mockResolvedValue({} as never);
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never);

      await createDonationHandler(mockDonorEvent({ projectId: 'prj_01', amountCents: 2000, donorSub: 'sub_intruso' }));

      const transaction = vi.mocked(docClient.send).mock.calls
        .map(([command]) => command as { constructor: { name: string }; input: any })
        .find((command) => command.constructor.name === 'TransactWriteCommand');
      const donationPut = transaction?.input.TransactItems.find((item: any) => item.Put.TableName === env.DONATIONS_TABLE);
      expect(donationPut?.Put.Item.donorSub).toBe('sub_donor_777');
    });

    it.each(['0', '101', 'abc', '2.5'])('listMyDonationsHandler responde 400 si limit=%j no es un entero entre 1 y 100', async (limit) => {
      const res = (await listMyDonationsHandler(mockDonorEvent(undefined, undefined, undefined, { limit }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
      expectOnlyAuditWrites(); // solo el evento FAILURE de auditoría
    });

    it('listMyDonationsHandler usa 20 como límite por defecto', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listMyDonationsHandler(mockDonorEvent());

      const query = vi.mocked(docClient.send).mock.calls[0]![0] as unknown as { input: { Limit: number } };
      expect(query.input.Limit).toBe(20);
    });
  });

  describe('Proyecto inexistente o en BORRADOR al donar (CA-05.2)', () => {
    it('CA-05.2: un proyecto inexistente responde 404 y no escribe donación ni clave de idempotencia', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never) // idempotencia
        .mockResolvedValueOnce({ Item: undefined } as never); // proyecto

      const res = (await createDonationHandler(mockDonorEvent({ projectId: 'prj_missing', amountCents: 2500 }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(404);
      expect(docClient.send).toHaveBeenCalledTimes(3); // idempotencia, proyecto y evento FAILURE
    });

    it('CA-05.2: un proyecto existente en BORRADOR responde 409 y no escribe donación ni clave de idempotencia', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never) // idempotencia
        .mockResolvedValueOnce({ Item: { projectId: 'prj_draft', status: 'BORRADOR' } } as never); // proyecto

      const res = (await createDonationHandler(mockDonorEvent({ projectId: 'prj_draft', amountCents: 2500 }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body as string).code).toBe('CONFLICT');
      expect(docClient.send).toHaveBeenCalledTimes(3); // idempotencia, proyecto y evento FAILURE
    });

    it('CA-05.2: createDonationService distingue 404 de 409 con el mismo estado de proyecto que oculta la API pública', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_draft', status: 'BORRADOR' } } as never);

      await expect(createDonationService('prj_draft', 2500, '550e8400-e29b-41d4-a716-446655440000', mockUser)).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('Concurrencia en la simulación (T08, CA-06.2, CA-NF04.1)', () => {
    const pendingDonation = {
      donationId: 'don_100',
      projectId: 'prj_01',
      donorSub: 'sub_donor_777',
      amountCents: 3000,
      status: 'PENDIENTE_SIMULACION',
    };

    const commandName = (command: unknown): string => (command as { constructor: { name: string } }).constructor.name;

    it('T08 / CA-06.2 / CA-NF04.1: 10 confirmaciones concurrentes dan un único 200 y nueve 409, sin 500', async () => {
      let transactions = 0;
      vi.mocked(docClient.send).mockImplementation((async (command: unknown) => {
        const name = commandName(command);
        if (name === 'GetCommand') return { Item: pendingDonation };
        if (name === 'TransactWriteCommand') {
          transactions += 1;
          if (transactions > 1) {
            throw Object.assign(new Error('Transaction cancelled'), { name: 'TransactionCanceledException' });
          }
        }
        return {};
      }) as never);

      const event = mockDonorEvent({ result: 'CONFIRMADA_SIMULADA' }, { donationId: 'don_100' });
      const responses = (await Promise.all(
        Array.from({ length: 10 }, () => simulateDonationHandler(event))
      )) as APIGatewayProxyStructuredResultV2[];

      const statusCodes = responses.map((r) => r.statusCode).sort();
      expect(statusCodes).toEqual([200, 409, 409, 409, 409, 409, 409, 409, 409, 409]);

      const sent = vi.mocked(docClient.send).mock.calls.map(([command]) => commandName(command));
      expect(sent.filter((n) => n === 'TransactWriteCommand')).toHaveLength(10);
      // Un evento de auditoría por solicitud: un SUCCESS (el único incremento) y nueve FAILURE (409).
      const outcomes = vi.mocked(docClient.send).mock.calls
        .map(([command]) => command as unknown as { constructor: { name: string }; input: { Item?: { outcome?: string } } })
        .filter((command) => command.constructor.name === 'PutCommand')
        .map((command) => command.input.Item?.outcome)
        .sort();
      expect(outcomes).toEqual(['FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'FAILURE', 'SUCCESS']);
    });

    it('CA-06.2: TransactionConflictException (transacción en curso sobre el mismo ítem) también responde 409', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: pendingDonation } as never)
        .mockRejectedValueOnce(Object.assign(new Error('conflict'), { name: 'TransactionConflictException' }) as never);

      const res = (await simulateDonationHandler(mockDonorEvent({ result: 'CONFIRMADA_SIMULADA' }, { donationId: 'don_100' }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(409);
      expect(JSON.parse(res.body as string).code).toBe('CONFLICT');
    });

    it('CA-06.2: un fallo de condición en simulateDonationService se traduce a conflicto de negocio', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: pendingDonation } as never)
        .mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }) as never);

      await expect(simulateDonationService('don_100', 'RECHAZADA_SIMULADA', mockUser)).rejects.toMatchObject({ statusCode: 409 });
    });

    it('CA-06.2: errores distintos al conflicto siguen propagándose como 500', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: pendingDonation } as never)
        .mockRejectedValueOnce(new Error('ProvisionedThroughputExceeded') as never);

      const res = (await simulateDonationHandler(mockDonorEvent({ result: 'CONFIRMADA_SIMULADA' }, { donationId: 'don_100' }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(500);
    });

    it('CA-05.4: TransactionConflictException al crear la donación también responde 409', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never)
        .mockRejectedValueOnce(Object.assign(new Error('conflict'), { name: 'TransactionConflictException' }) as never);

      await expect(createDonationService('prj_01', 2500, '550e8400-e29b-41d4-a716-446655440000', mockUser)).rejects.toMatchObject({ statusCode: 409 });
    });
  });
  describe('Propiedad del historial y de la simulación (CA-07.1, CA-07.2, CA-04.3)', () => {
    type QueryInput = { IndexName: string; KeyConditionExpression: string; ExpressionAttributeValues: Record<string, unknown> };
    const queryInputs = (): QueryInput[] =>
      vi.mocked(docClient.send).mock.calls
        .map(([command]) => command as unknown as { constructor: { name: string }; input: QueryInput })
        .filter((command) => command.constructor.name === 'QueryCommand')
        .map((command) => command.input);

    it('CA-07.1: el historial consulta el índice donorSub-createdAt con el sub del token como única clave de partición', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      const res = (await listMyDonationsHandler(mockDonorEvent(undefined, undefined, undefined, { limit: '5' }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(200);
      expect(queryInputs()).toHaveLength(1);
      expect(queryInputs()[0]).toMatchObject({
        IndexName: 'donorSub-createdAt',
        KeyConditionExpression: 'donorSub = :subVal',
        ExpressionAttributeValues: { ':subVal': 'sub_donor_777' },
      });
    });

    it('CA-07.2 / CA-04.3: un donorSub o sub enviado en la query string o en el cuerpo se ignora', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);
      const event = {
        ...mockDonorEvent(
          { donorSub: 'sub_intruso', sub: 'sub_intruso' },
          undefined,
          undefined,
          { limit: '5', donorSub: 'sub_intruso', sub: 'sub_intruso' }
        ),
      } as APIGatewayProxyEventV2;

      const res = (await listMyDonationsHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(200);
      expect(queryInputs()[0]!.ExpressionAttributeValues).toEqual({ ':subVal': 'sub_donor_777' });
      expect(JSON.stringify(vi.mocked(docClient.send).mock.calls.map(([c]) => (c as { input: unknown }).input))).not.toContain('sub_intruso');
    });

    it('HU-12 / CA-07.1: la autorización del historial no fabrica atributos de recurso (la propiedad es estructural)', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listMyDonationsService(mockUser);

      const call = vi.mocked(authorizeActionService).mock.calls[0]!;
      expect(call[1]).toBe('ReadMyDonations');
      expect(call.slice(2)).toEqual([]);
    });

    it('CA-07.2 / HU-12: la simulación envía a Verified Permissions el donorSub de la donación almacenada, no el de la solicitud', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({
          Item: { donationId: 'don_100', projectId: 'prj_01', donorSub: 'sub_owner_stored', amountCents: 3000, status: 'PENDIENTE_SIMULACION' },
        } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({} as never);
      const event = mockDonorEvent(
        { result: 'CONFIRMADA_SIMULADA', donorSub: 'sub_donor_777' },
        { donationId: 'don_100' },
        undefined,
        { donorSub: 'sub_donor_777' }
      );

      await simulateDonationHandler(event);

      expect(authorizeActionService).toHaveBeenCalledWith(
        expect.objectContaining({ sub: 'sub_donor_777' }),
        'SimulateDonation',
        'Donation',
        'don_100',
        { donorSub: 'sub_owner_stored', status: 'PENDIENTE_SIMULACION' }
      );
    });
  });
});