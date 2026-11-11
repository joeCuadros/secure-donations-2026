import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createAuditLogService } from '../../src/audit/services/create-audit.service.js';
import { listAuditLogsService } from '../../src/audit/services/list-audit.service.js';
import { listAuditLogsHandler } from '../../src/audit/api.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { expectOnlyAuditWrites } from '../helpers/audit-calls.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

vi.mock('../../src/authz/services/avp.service.js', () => ({
  authorizeActionService: vi.fn().mockResolvedValue(undefined),
}));

describe('Dominio Audit - Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuditorEvent = (queryParams?: any): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        requestId: 'req_audit_555',
        authorizer: {
          jwt: {
            claims: {
              sub: 'sub_auditor_001',
              'cognito:groups': 'AUDITOR',
              scope: 'api/audit.read',
            },
          },
        },
      },
      queryStringParameters: queryParams,
    }) as unknown as APIGatewayProxyEventV2;

  describe('createAuditLogService', () => {
    it('debe registrar un evento seudonimizando actorSub con hash SHA-256 parcial', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({} as never);
      const log = await createAuditLogService({
        eventType: 'PROJECT_EVENT',
        requestId: 'req_xyz',
        actorSub: 'sub_sensible_usuario_123',
        action: 'CREATE_PROJECT',
        resourceRef: 'prj_01',
        outcome: 'SUCCESS',
      });
      expect(log).not.toBeNull();
      expect(log?.actorRef).not.toContain('sub_sensible_usuario_123');
    });

    it('debe retornar null en lugar de romper el flujo si la persistencia falla', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('DynamoDB Error'));
      const log = await createAuditLogService({
        eventType: 'DONATION_EVENT',
        requestId: 'req_abc',
        actorSub: 'sub_000',
        action: 'SIMULATE_DONATION',
        resourceRef: 'don_01',
        outcome: 'FAILURE',
      });
      expect(log).toBeNull();
    });
  });

  describe('listAuditLogsService & Handlers', () => {
    it('debe construir filtro solo con "from" y solo con "to"', async () => {
      vi.mocked(docClient.send).mockResolvedValue({ Items: [] } as never);

      await listAuditLogsService('DONATION_EVENT', '2026-11-01T00:00:00.000Z', undefined, 10);
      await listAuditLogsService('DONATION_EVENT', undefined, '2026-11-05T23:59:59.000Z', 10);
      await listAuditLogsService(undefined, '2026-11-01T00:00:00.000Z', '2026-11-05T23:59:59.000Z', 10);

      expect(docClient.send).toHaveBeenCalledTimes(3);
    });

    it('listAuditLogsHandler debe retornar 200 OK y ejecutar autorización delegada a AVP', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);
      const event = mockAuditorEvent({ eventType: 'DONATION_EVENT', limit: '10', nextToken: 'token' });
      const res = (await listAuditLogsHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
    });

    it('listAuditLogsHandler debe retornar 500 si falla el servicio', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('AuditDBFail'));
      const event = mockAuditorEvent();
      const res = (await listAuditLogsHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(500);
    });
  });

  describe('Índice global AllAuditLogsIndex (CA-10.1, CA-10.2)', () => {
    const sentInput = (index = 0) =>
      (vi.mocked(docClient.send).mock.calls[index]![0] as unknown as { input: Record<string, any> }).input;

    it('CA-10.2: cada evento de auditoría escribe gsi1pk con la partición constante del índice global', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({} as never);

      await createAuditLogService({
        eventType: 'PROJECT_EVENT',
        requestId: 'req_xyz',
        actorSub: 'sub_gestor_01',
        action: 'CREATE_PROJECT',
        resourceRef: 'prj_01',
        outcome: 'SUCCESS',
      });

      expect(sentInput().Item.gsi1pk).toBe('AUDIT');
      expect(sentInput().Item.eventType).toBe('PROJECT_EVENT');
    });

    it('CA-10.1: sin eventType se listan todos los tipos mediante el índice AllAuditLogsIndex', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listAuditLogsService(undefined, undefined, undefined, 10);

      const input = sentInput();
      expect(input.IndexName).toBe('AllAuditLogsIndex');
      expect(input.KeyConditionExpression).toBe('gsi1pk = :pk');
      expect(input.ExpressionAttributeValues).toEqual({ ':pk': 'AUDIT' });
      expect(input.ScanIndexForward).toBe(false);
    });

    it('CA-10.1: con eventType se consulta la tabla por su clave primaria, sin índice', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listAuditLogsService('PROJECT_EVENT', undefined, undefined, 10);

      const input = sentInput();
      expect(input.IndexName).toBeUndefined();
      expect(input.KeyConditionExpression).toBe('eventType = :et');
      expect(input.ExpressionAttributeValues).toEqual({ ':et': 'PROJECT_EVENT' });
    });

    it('CA-10.1: el filtro de fechas aplica al índice global cuando no hay eventType', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listAuditLogsService(undefined, '2026-11-01T00:00:00.000Z', '2026-11-05T23:59:59.000Z', 10);

      const input = sentInput();
      expect(input.KeyConditionExpression).toBe('gsi1pk = :pk AND timestampEventId BETWEEN :fKey AND :tKey');
      expect(input.ExpressionAttributeValues).toEqual({
        ':pk': 'AUDIT',
        ':fKey': '2026-11-01T00:00:00.000Z#',
        ':tKey': '2026-11-05T23:59:59.000Z#~',
      });
    });

    it('CA-10.2: la respuesta no expone el atributo interno gsi1pk', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({
        Items: [{ eventType: 'PROJECT_EVENT', gsi1pk: 'AUDIT', timestampEventId: 't#e', timestamp: 't', eventId: 'e', requestId: 'r', actorRef: 'actor_1', action: 'CREATE_PROJECT', resourceRef: 'prj_01', outcome: 'SUCCESS' }],
      } as never);

      const res = await listAuditLogsService(undefined, undefined, undefined, 10);

      expect(res.items[0]).not.toHaveProperty('gsi1pk');
      expect(res.items[0]).toMatchObject({ action: 'CREATE_PROJECT', requestId: 'r' });
    });
  });

  describe('Validación de parámetros de consulta (CA-10.1)', () => {
    it('listAuditLogsHandler usa 20 como límite por defecto y consulta el índice global', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listAuditLogsHandler(mockAuditorEvent());

      const input = (vi.mocked(docClient.send).mock.calls[0]![0] as unknown as { input: Record<string, any> }).input;
      expect(input.Limit).toBe(20);
      expect(input.IndexName).toBe('AllAuditLogsIndex');
    });

    it.each(['0', '101', 'abc', '1.5', '-3'])('listAuditLogsHandler responde 400 si limit=%j no es un entero entre 1 y 100', async (limit) => {
      const res = (await listAuditLogsHandler(mockAuditorEvent({ limit }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body as string)).toEqual({
        code: 'VALIDATION_ERROR',
        message: expect.any(String),
        requestId: 'req_audit_555',
      });
      expectOnlyAuditWrites();
    });

    it.each([
      ['from', 'ayer'],
      ['to', '2026-13-45T00:00:00Z'],
      ['from', '2026-11-01'],
    ])('listAuditLogsHandler responde 400 si %s=%j no es una fecha ISO 8601 con hora', async (field, value) => {
      const res = (await listAuditLogsHandler(mockAuditorEvent({ [field]: value }))) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
      expectOnlyAuditWrites();
    });

    it('listAuditLogsHandler responde 400 si from es posterior a to', async () => {
      const res = (await listAuditLogsHandler(
        mockAuditorEvent({ from: '2026-11-05T00:00:00Z', to: '2026-11-01T00:00:00Z' })
      )) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(400);
    });

    it('listAuditLogsHandler normaliza from/to a milisegundos UTC para que la comparación de claves sea correcta', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listAuditLogsHandler(
        mockAuditorEvent({ from: '2026-11-01T00:00:00Z', to: '2026-11-01T05:00:00-05:00' })
      );

      const input = (vi.mocked(docClient.send).mock.calls[0]![0] as unknown as { input: Record<string, any> }).input;
      expect(input.ExpressionAttributeValues[':fKey']).toBe('2026-11-01T00:00:00.000Z#');
      expect(input.ExpressionAttributeValues[':tKey']).toBe('2026-11-01T10:00:00.000Z#~');
    });
  });
});