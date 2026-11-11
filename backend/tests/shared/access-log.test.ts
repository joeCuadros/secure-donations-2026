import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { withAccessLog } from '../../src/shared/logger/access-log.js';
import { logger } from '../../src/shared/logger/logger.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import { listProjectsHandler, createProjectHandler } from '../../src/projects/api.js';
import { listAuditLogsHandler } from '../../src/audit/api.js';
import { simulateDonationHandler } from '../../src/donations/api.js';
import { buildSuccessResponse } from '../../src/shared/utils/response.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { env } from '../../src/shared/config/env.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

vi.mock('../../src/authz/services/avp.service.js', () => ({
  authorizeActionService: vi.fn().mockResolvedValue(undefined),
}));

type LogLine = Record<string, unknown>;

describe('CA-NF07.1 - Access log JSON por invocación', () => {
  let lines: LogLine[];

  beforeEach(() => {
    lines = [];
    const capture = (...args: unknown[]) => {
      lines.push(JSON.parse(String(args[0])) as LogLine);
    };
    vi.spyOn(console, 'log').mockImplementation(capture);
    vi.spyOn(console, 'warn').mockImplementation(capture);
    vi.spyOn(console, 'error').mockImplementation(capture);
  });

  afterEach(() => {
    env.LOG_LEVEL = 'info';
  });

  const accessLines = () => lines.filter((line) => line['message'] === 'access');

  const buildEvent = (overrides: Record<string, unknown> = {}, claims?: Record<string, unknown>): APIGatewayProxyEventV2 =>
    ({
      headers: { authorization: 'Bearer eyJ.SECRET_TOKEN.sig', 'idempotency-key': '550e8400-e29b-41d4-a716-446655440000' },
      requestContext: {
        requestId: 'req_log_001',
        authorizer: claims ? { jwt: { claims } } : undefined,
      },
      ...overrides,
    }) as unknown as APIGatewayProxyEventV2;

  const gestorClaims = { sub: 'sub_gestor_01', 'cognito:groups': '[GESTOR]', scope: 'openid api/projects.write' };

  it('éxito: emite exactamente una línea JSON con requestId, action, outcome, statusCode y durationMs', async () => {
    vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

    const res = (await listProjectsHandler(buildEvent())) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(200);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'info',
      message: 'access',
      requestId: 'req_log_001',
      action: 'listProjects',
      outcome: 'SUCCESS',
      statusCode: 200,
    });
    expect(typeof lines[0]!['durationMs']).toBe('number');
    expect(lines[0]!['durationMs'] as number).toBeGreaterThanOrEqual(0);
    expect(typeof lines[0]!['timestamp']).toBe('string');
  });

  it('401 sin contexto del authorizer: una línea access con statusCode 401 y outcome FAILURE', async () => {
    const res = (await createProjectHandler(buildEvent())) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(401);
    expect(accessLines()).toHaveLength(1);
    expect(accessLines()[0]).toMatchObject({ requestId: 'req_log_001', action: 'createProject', outcome: 'FAILURE', statusCode: 401, errorCode: 'UNAUTHORIZED', level: 'warn' });
  });

  it('403 por scope insuficiente: una línea access con statusCode 403', async () => {
    const event = buildEvent({ body: '{}' }, { sub: 'sub_donor', 'cognito:groups': '[DONANTE]', scope: 'openid api/donations.read' });

    const res = (await createProjectHandler(event)) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(403);
    expect(accessLines()).toHaveLength(1);
    expect(accessLines()[0]).toMatchObject({ action: 'createProject', outcome: 'FAILURE', statusCode: 403, errorCode: 'FORBIDDEN' });
  });

  it('409: una línea access con statusCode 409', async () => {
    vi.mocked(docClient.send)
      .mockResolvedValueOnce({ Item: { donationId: 'don_1', donorSub: 'sub_donor', projectId: 'prj_1', amountCents: 100, status: 'PENDIENTE_SIMULACION' } } as never)
      .mockRejectedValueOnce(Object.assign(new Error('cancelled'), { name: 'TransactionCanceledException' }) as never);
    const event = buildEvent(
      { body: JSON.stringify({ result: 'CONFIRMADA_SIMULADA' }), pathParameters: { donationId: 'don_1' } },
      { sub: 'sub_donor', 'cognito:groups': '[DONANTE]', scope: 'api/donations.write' }
    );

    const res = (await simulateDonationHandler(event)) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(409);
    expect(accessLines()).toHaveLength(1);
    expect(accessLines()[0]).toMatchObject({ action: 'simulateDonation', statusCode: 409, errorCode: 'CONFLICT', outcome: 'FAILURE' });
  });

  it('500: una línea access con statusCode 500 y level error; el detalle del fallo queda aparte, sin pasar a la respuesta', async () => {
    vi.mocked(docClient.send).mockRejectedValueOnce(new Error('ProvisionedThroughputExceeded'));

    const res = (await listProjectsHandler(buildEvent())) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(500);
    expect(res.body).not.toContain('ProvisionedThroughputExceeded');
    expect(accessLines()).toHaveLength(1);
    expect(accessLines()[0]).toMatchObject({ action: 'listProjects', outcome: 'FAILURE', statusCode: 500, errorCode: 'INTERNAL_ERROR', level: 'error' });
  });

  it('400 de validación (límite inválido): se registra con su código HTTP', async () => {
    const event = buildEvent(
      { queryStringParameters: { limit: '500' } },
      { sub: 'sub_auditor', 'cognito:groups': '[AUDITOR]', scope: 'api/audit.read' }
    );

    const res = (await listAuditLogsHandler(event)) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(400);
    expect(accessLines()).toHaveLength(1);
    expect(accessLines()[0]).toMatchObject({ action: 'listAuditLogs', statusCode: 400, errorCode: 'VALIDATION_ERROR' });
  });

  it('CA-NF01.2: nunca registra cabeceras, tokens, cuerpo ni el evento crudo', async () => {
    const event = buildEvent({
      body: JSON.stringify({ title: 'TITULO_PRIVADO_XYZ', description: 'descripcion', purpose: 'proposito', goalAmountCents: 1000 }),
      queryStringParameters: { nextToken: 'TOKEN_PAGINACION_ABC' },
    }, { sub: 'sub_gestor_01', 'cognito:groups': '[GESTOR]', scope: 'api/projects.write' });
    vi.mocked(docClient.send).mockResolvedValue({} as never);

    await createProjectHandler(event);

    const serialized = JSON.stringify(lines);
    expect(serialized).not.toContain('SECRET_TOKEN');
    expect(serialized).not.toContain('Bearer');
    expect(serialized).not.toContain('TITULO_PRIVADO_XYZ');
    expect(serialized).not.toContain('550e8400-e29b-41d4-a716-446655440000');
    expect(serialized).not.toContain('sub_gestor_01');
  });

  it('withAccessLog convierte una excepción en respuesta de error uniforme con el requestId', async () => {
    const handler = withAccessLog('demo', async () => {
      throw AppError.conflict('Conflicto de prueba');
    });

    const res = (await handler(buildEvent())) as APIGatewayProxyStructuredResultV2;

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body as string)).toEqual({ code: 'CONFLICT', message: 'Conflicto de prueba', requestId: 'req_log_001' });
  });

  it('withAccessLog registra el código de estado devuelto por el manejador en respuestas exitosas no 200', async () => {
    const handler = withAccessLog('demoCreate', async () => buildSuccessResponse(201, { ok: true }));

    await handler(buildEvent());

    expect(accessLines()[0]).toMatchObject({ action: 'demoCreate', statusCode: 201, outcome: 'SUCCESS' });
  });

  describe('LOG_LEVEL', () => {
    it('el logger omite los niveles inferiores al configurado', () => {
      env.LOG_LEVEL = 'warn';

      logger.debug('d');
      logger.info('i');
      logger.warn('w');
      logger.error('e');

      expect(lines.map((l) => l['message'])).toEqual(['w', 'e']);
    });

    it('con LOG_LEVEL=debug se emiten todos los niveles', () => {
      env.LOG_LEVEL = 'debug';

      logger.debug('d');
      logger.info('i');

      expect(lines.map((l) => l['message'])).toEqual(['d', 'i']);
    });

    it('la línea access es obligatoria (CA-NF07.1) y se emite aunque LOG_LEVEL sea error', async () => {
      env.LOG_LEVEL = 'error';
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listProjectsHandler(buildEvent());

      expect(accessLines()).toHaveLength(1);
    });
  });
});
