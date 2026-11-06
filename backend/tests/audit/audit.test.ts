import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createAuditLogService } from '../../src/audit/services/create-audit.service.js';
import { listAuditLogsService } from '../../src/audit/services/list-audit.service.js';
import { listAuditLogsHandler } from '../../src/audit/api.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

describe('Dominio Audit - Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockAuditorEvent = (queryParams?: any): APIGatewayProxyEventV2 =>
    ({
      version: '2.0',
      routeKey: 'GET /v1/audit',
      rawPath: '/v1/audit',
      rawQueryString: '',
      headers: {},
      isBase64Encoded: false,
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'id.execute-api.us-east-1.amazonaws.com',
        domainPrefix: 'id',
        http: {
          method: 'GET',
          path: '/v1/audit',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'CustomAgent',
        },
        requestId: 'req_audit_555',
        routeKey: 'GET /v1/audit',
        stage: 'academic',
        time: '05/Nov/2026:10:00:00 +0000',
        timeEpoch: 1793872800000,
        authorizer: {
          jwt: {
            claims: {
              sub: 'sub_auditor_001',
              'cognito:groups': 'AUDITOR',
              scope: 'api/audit.read',
            },
            scopes: [],
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
      expect(log?.actorRef).toMatch(/^actor_[a-f0-9]{8}$/);
      expect(log?.actorRef).not.toContain('sub_sensible_usuario_123');
      expect(log?.requestId).toBe('req_xyz');
    });

    it('debe retornar null en lugar de romper el flujo si la persistencia de auditoría falla', async () => {
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

      expect(docClient.send).toHaveBeenCalledTimes(2);
    });

    it('listAuditLogsHandler debe retornar 200 OK para usuarios con rol AUDITOR', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      const event = mockAuditorEvent({ eventType: 'DONATION_EVENT' });
      const res = (await listAuditLogsHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.items).toBeDefined();
    });

    it('listAuditLogsHandler debe retornar 500 si la consulta en base de datos falla', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('AuditDBFail'));

      const event = mockAuditorEvent();
      const res = (await listAuditLogsHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(500);
    });
  });
});