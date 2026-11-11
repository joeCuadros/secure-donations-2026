import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createProjectHandler, publishProjectHandler, listProjectsHandler, getProjectHandler } from '../../src/projects/api.js';
import {
  createDonationHandler,
  simulateDonationHandler,
  listMyDonationsHandler,
} from '../../src/donations/api.js';
import { listAuditLogsHandler } from '../../src/audit/api.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { authorizeActionService } from '../../src/authz/services/avp.service.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import { env } from '../../src/shared/config/env.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

vi.mock('../../src/authz/services/avp.service.js', () => ({
  authorizeActionService: vi.fn().mockResolvedValue(undefined),
}));

type Command = { constructor: { name: string }; input: Record<string, any> };

const SECRET_TOKEN = 'eyJ.SECRET_TOKEN.sig';
const RAW_SUB = 'sub_raw_identity_4242';
const IDEMPOTENCY_KEY = '550e8400-e29b-41d4-a716-446655440000';

const commands = (): Command[] => vi.mocked(docClient.send).mock.calls.map(([command]) => command as unknown as Command);
const auditPuts = () =>
  commands().filter((c) => c.constructor.name === 'PutCommand' && c.input['TableName'] === env.AUDIT_TABLE);
const auditItems = () => auditPuts().map((c) => c.input['Item'] as Record<string, unknown>);

type Handler = (event: APIGatewayProxyEventV2) => Promise<unknown>;

const buildEvent = (
  claims: Record<string, unknown> | undefined,
  overrides: Record<string, unknown> = {}
): APIGatewayProxyEventV2 =>
  ({
    headers: { authorization: `Bearer ${SECRET_TOKEN}`, 'idempotency-key': IDEMPOTENCY_KEY },
    requestContext: { requestId: 'req_audit_rej_1', authorizer: claims ? { jwt: { claims } } : undefined },
    ...overrides,
  }) as unknown as APIGatewayProxyEventV2;

const gestor = { sub: RAW_SUB, 'cognito:groups': '[GESTOR]', scope: 'openid api/projects.write' };
const donante = { sub: RAW_SUB, 'cognito:groups': '[DONANTE]', scope: 'openid api/donations.write api/donations.read' };
const auditor = { sub: RAW_SUB, 'cognito:groups': '[AUDITOR]', scope: 'openid api/audit.read' };

const validProjectBody = JSON.stringify({
  title: 'TITULO_PRIVADO_XYZ',
  description: 'Descripcion suficientemente larga',
  purpose: 'Proposito del proyecto',
  goalAmountCents: 777777,
});

const run = async (handler: Handler, event: APIGatewayProxyEventV2) =>
  (await handler(event)) as APIGatewayProxyStructuredResultV2;

describe('CA-08.3 / CA-10.2 / NIST 7: auditoría de operaciones rechazadas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeActionService).mockReset().mockResolvedValue(undefined);
    vi.mocked(docClient.send).mockReset().mockResolvedValue({} as never);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('Resultado DENIED (403)', () => {
    it('CA-08.3: createProject con scope insuficiente registra DENIED con la forma habitual del evento', async () => {
      const res = await run(createProjectHandler, buildEvent({ ...donante }, { body: validProjectBody }));

      expect(res.statusCode).toBe(403);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({
        eventType: 'PROJECT_EVENT',
        gsi1pk: 'AUDIT',
        requestId: 'req_audit_rej_1',
        action: 'CREATE_PROJECT',
        resourceRef: 'n/a',
        outcome: 'DENIED',
      });
      const item = auditItems()[0]!;
      expect(item['actorRef']).toMatch(/^actor_[0-9a-f]{8}$/);
      expect(item['timestamp']).toEqual(expect.any(String));
      expect(item['eventId']).toEqual(expect.any(String));
      expect(item['timestampEventId']).toBe(`${item['timestamp']}#${item['eventId']}`);
    });

    it('CA-08.3: una denegación de Verified Permissions en publishProject registra DENIED con el proyecto del path', async () => {
      vi.mocked(authorizeActionService).mockRejectedValueOnce(AppError.forbidden('Acceso denegado'));

      const res = await run(
        publishProjectHandler,
        buildEvent({ ...gestor, 'cognito:groups': '[DONANTE]' }, { pathParameters: { projectId: 'prj_01' } })
      );

      expect(res.statusCode).toBe(403);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ eventType: 'PROJECT_EVENT', action: 'PUBLISH_PROJECT', resourceRef: 'prj_01', outcome: 'DENIED' });
    });

    it('CA-10.2: un donante que intenta simular una donación ajena queda registrado como DENIED', async () => {
      vi.mocked(docClient.send).mockImplementation((async (command: Command) =>
        command.constructor.name === 'GetCommand'
          ? { Item: { donationId: 'don_9', projectId: 'prj_1', donorSub: 'otro', amountCents: 500, status: 'PENDIENTE_SIMULACION' } }
          : {}) as never);
      vi.mocked(authorizeActionService).mockRejectedValueOnce(AppError.forbidden('Acceso denegado'));

      const res = await run(
        simulateDonationHandler,
        buildEvent(donante, { body: JSON.stringify({ result: 'CONFIRMADA_SIMULADA' }), pathParameters: { donationId: 'don_9' } })
      );

      expect(res.statusCode).toBe(403);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ eventType: 'DONATION_EVENT', action: 'SIMULATE_DONATION', resourceRef: 'don_9', outcome: 'DENIED' });
    });

    it('NIST 7: listMyDonations sin el scope exigido registra DENIED', async () => {
      const res = await run(listMyDonationsHandler, buildEvent({ ...gestor }));

      expect(res.statusCode).toBe(403);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ eventType: 'DONATION_EVENT', action: 'LIST_MY_DONATIONS', outcome: 'DENIED' });
    });

    it('CA-10.1: una consulta de auditoría de un usuario que no es AUDITOR registra DENIED', async () => {
      vi.mocked(authorizeActionService).mockRejectedValueOnce(AppError.forbidden('Acceso denegado'));

      const res = await run(listAuditLogsHandler, buildEvent(auditor));

      expect(res.statusCode).toBe(403);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ eventType: 'AUDIT_EVENT', action: 'LIST_AUDIT_LOGS', outcome: 'DENIED' });
    });

    it('CA-NF02.2: sin identidad verificada (401 en Lambda) el actor es la constante actor_unknown', async () => {
      const res = await run(createProjectHandler, buildEvent(undefined, { body: validProjectBody }));

      expect(res.statusCode).toBe(401);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ actorRef: 'actor_unknown', outcome: 'DENIED', action: 'CREATE_PROJECT' });
    });
  });

  describe('Resultado FAILURE (400, 404, 409)', () => {
    it('CA-08.1: createProject con cuerpo inválido (400) registra FAILURE', async () => {
      const res = await run(createProjectHandler, buildEvent(gestor, { body: '{"title":"x"}' }));

      expect(res.statusCode).toBe(400);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ action: 'CREATE_PROJECT', outcome: 'FAILURE' });
      expect(commands().some((c) => c.input['TableName'] === env.PROJECTS_TABLE)).toBe(false);
    });

    it('CA-08.2: publishProject de un proyecto inexistente (404) y ya publicado (409) registran FAILURE', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_02', status: 'PUBLICADO' } } as never)
        .mockResolvedValueOnce({} as never);

      const notFound = await run(publishProjectHandler, buildEvent(gestor, { pathParameters: { projectId: 'prj_01' } }));
      const conflict = await run(publishProjectHandler, buildEvent(gestor, { pathParameters: { projectId: 'prj_02' } }));

      expect([notFound.statusCode, conflict.statusCode]).toEqual([404, 409]);
      expect(auditItems().map((i) => [i['resourceRef'], i['outcome']])).toEqual([
        ['prj_01', 'FAILURE'],
        ['prj_02', 'FAILURE'],
      ]);
    });

    it('CA-05.2: createDonation sin Idempotency-Key (400) registra FAILURE sin tocar las tablas de negocio', async () => {
      const res = await run(
        createDonationHandler,
        buildEvent(donante, { headers: {}, body: JSON.stringify({ projectId: 'prj_01', amountCents: 2500 }) })
      );

      expect(res.statusCode).toBe(400);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ eventType: 'DONATION_EVENT', action: 'CREATE_DONATION_INTENT', outcome: 'FAILURE' });
      expect(commands()).toHaveLength(1);
    });

    it('CA-05.4: createDonation con clave reutilizada y otra carga (409) registra FAILURE', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: { payloadHash: 'otro', responseStatus: 201, responseBody: '{}' } } as never);

      const res = await run(
        createDonationHandler,
        buildEvent(donante, { body: JSON.stringify({ projectId: 'prj_01', amountCents: 2500 }) })
      );

      expect(res.statusCode).toBe(409);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ action: 'CREATE_DONATION_INTENT', outcome: 'FAILURE' });
    });

    it('CA-06.2: simulateDonation de una donación inexistente (404) y en estado terminal (409) registran FAILURE', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({ Item: { donationId: 'don_2', donorSub: RAW_SUB, projectId: 'prj_1', amountCents: 100, status: 'CONFIRMADA_SIMULADA' } } as never)
        .mockResolvedValueOnce({} as never);
      const body = JSON.stringify({ result: 'CONFIRMADA_SIMULADA' });

      const notFound = await run(simulateDonationHandler, buildEvent(donante, { body, pathParameters: { donationId: 'don_1' } }));
      const terminal = await run(simulateDonationHandler, buildEvent(donante, { body, pathParameters: { donationId: 'don_2' } }));

      expect([notFound.statusCode, terminal.statusCode]).toEqual([404, 409]);
      expect(auditItems().map((i) => [i['action'], i['resourceRef'], i['outcome']])).toEqual([
        ['SIMULATE_DONATION', 'don_1', 'FAILURE'],
        ['SIMULATE_DONATION', 'don_2', 'FAILURE'],
      ]);
    });

    it('CA-NF05: listMyDonations con limit inválido (400) y listAuditLogs con fechas inválidas (400) registran FAILURE', async () => {
      const donations = await run(listMyDonationsHandler, buildEvent(donante, { queryStringParameters: { limit: '500' } }));
      const audit = await run(listAuditLogsHandler, buildEvent(auditor, { queryStringParameters: { from: 'ayer' } }));

      expect([donations.statusCode, audit.statusCode]).toEqual([400, 400]);
      expect(auditItems().map((i) => [i['action'], i['outcome']])).toEqual([
        ['LIST_MY_DONATIONS', 'FAILURE'],
        ['LIST_AUDIT_LOGS', 'FAILURE'],
      ]);
    });
  });

  describe('Resultado ERROR (500)', () => {
    it('un fallo inesperado después de autenticar registra ERROR y no cambia la respuesta genérica', async () => {
      vi.mocked(docClient.send).mockImplementation((async (command: Command) => {
        if (command.constructor.name === 'GetCommand') throw new Error('ProvisionedThroughputExceeded');
        return {};
      }) as never);

      const res = await run(publishProjectHandler, buildEvent(gestor, { pathParameters: { projectId: 'prj_01' } }));

      expect(res.statusCode).toBe(500);
      expect(res.body).not.toContain('ProvisionedThroughputExceeded');
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ action: 'PUBLISH_PROJECT', resourceRef: 'prj_01', outcome: 'ERROR' });
    });
  });

  describe('Un solo evento por solicitud y sin cambiar la respuesta', () => {
    it('CA-08.3: la creación exitosa de un proyecto escribe exactamente un evento SUCCESS con el id creado', async () => {
      const res = await run(createProjectHandler, buildEvent(gestor, { body: validProjectBody }));

      expect(res.statusCode).toBe(201);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({
        eventType: 'PROJECT_EVENT',
        action: 'CREATE_PROJECT',
        outcome: 'SUCCESS',
        resourceRef: JSON.parse(res.body as string).projectId,
      });
    });

    it('CA-08.3: la publicación exitosa escribe un único evento SUCCESS', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'BORRADOR' } } as never);

      const res = await run(publishProjectHandler, buildEvent(gestor, { pathParameters: { projectId: 'prj_01' } }));

      expect(res.statusCode).toBe(200);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ action: 'PUBLISH_PROJECT', resourceRef: 'prj_01', outcome: 'SUCCESS' });
    });

    it('CA-05.1: la intención de donación exitosa escribe un único evento SUCCESS con el id de la donación', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: undefined } as never)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never);

      const res = await run(
        createDonationHandler,
        buildEvent(donante, { body: JSON.stringify({ projectId: 'prj_01', amountCents: 2500 }) })
      );

      expect(res.statusCode).toBe(201);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({
        action: 'CREATE_DONATION_INTENT',
        outcome: 'SUCCESS',
        resourceRef: JSON.parse(res.body as string).donationId,
      });
    });

    it('CA-06.2: la simulación exitosa escribe un único evento SUCCESS', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({
        Item: { donationId: 'don_1', projectId: 'prj_1', donorSub: RAW_SUB, amountCents: 3000, status: 'PENDIENTE_SIMULACION' },
      } as never);

      const res = await run(
        simulateDonationHandler,
        buildEvent(donante, { body: JSON.stringify({ result: 'CONFIRMADA_SIMULADA' }), pathParameters: { donationId: 'don_1' } })
      );

      expect(res.statusCode).toBe(200);
      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({ action: 'SIMULATE_DONATION', resourceRef: 'don_1', outcome: 'SUCCESS' });
    });

    it('las consultas exitosas (historial propio y auditoría) no generan eventos de auditoría', async () => {
      vi.mocked(docClient.send).mockResolvedValue({ Items: [] } as never);

      const donations = await run(listMyDonationsHandler, buildEvent(donante));
      const audit = await run(listAuditLogsHandler, buildEvent(auditor));

      expect([donations.statusCode, audit.statusCode]).toEqual([200, 200]);
      expect(auditPuts()).toHaveLength(0);
    });

    it('CA-NF07.1: si falla la escritura del evento, la respuesta rechazada no cambia', async () => {
      const failAuditWrite = (async (command: Command) => {
        if (command.constructor.name === 'PutCommand' && command.input['TableName'] === env.AUDIT_TABLE) {
          throw new Error('AuditTableUnavailable');
        }
        return {};
      }) as never;
      const event = buildEvent({ ...donante }, { body: validProjectBody });

      vi.mocked(docClient.send).mockResolvedValue({} as never);
      const baseline = await run(createProjectHandler, event);
      vi.mocked(docClient.send).mockImplementation(failAuditWrite);
      const withFailure = await run(createProjectHandler, event);

      expect(withFailure.statusCode).toBe(403);
      expect(withFailure.statusCode).toBe(baseline.statusCode);
      expect(withFailure.body).toBe(baseline.body);
    });

    it('CA-NF07.1: si falla la escritura del evento, la operación exitosa sigue respondiendo 201', async () => {
      vi.mocked(docClient.send).mockImplementation((async (command: Command) => {
        if (command.input['TableName'] === env.AUDIT_TABLE) throw new Error('AuditTableUnavailable');
        return {};
      }) as never);

      const res = await run(createProjectHandler, buildEvent(gestor, { body: validProjectBody }));

      expect(res.statusCode).toBe(201);
    });
  });

  describe('Contenido del evento y alcance', () => {
    it('CA-10.2: el evento nunca contiene token, cabeceras, cuerpo, monto, clave de idempotencia ni el sub sin seudonimizar', async () => {
      await run(createProjectHandler, buildEvent({ ...donante }, { body: validProjectBody }));
      await run(
        createDonationHandler,
        buildEvent(donante, { headers: {}, body: JSON.stringify({ projectId: 'prj_01', amountCents: 123456 }) })
      );

      const serialized = JSON.stringify(auditItems());
      expect(auditItems()).toHaveLength(2);
      for (const forbidden of [SECRET_TOKEN, 'Bearer', RAW_SUB, 'TITULO_PRIVADO_XYZ', '777777', '123456', IDEMPOTENCY_KEY, 'authorization']) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(Object.keys(auditItems()[0]!).sort()).toEqual(
        ['action', 'actorRef', 'eventId', 'eventType', 'gsi1pk', 'outcome', 'requestId', 'resourceRef', 'timestamp', 'timestampEventId']
      );
    });

    it('un identificador del path con caracteres inesperados no se almacena tal cual en resourceRef', async () => {
      const res = await run(
        publishProjectHandler,
        buildEvent(donante, { pathParameters: { projectId: 'prj_01"; DROP <script>'.padEnd(200, 'x') } })
      );

      expect(res.statusCode).toBe(403);
      expect(auditItems()[0]!['resourceRef']).toBe('invalid');
    });

    it('los handlers públicos no escriben eventos de auditoría ni siquiera cuando fallan', async () => {
      vi.mocked(docClient.send).mockRejectedValue(new Error('fail') as never);

      const list = await run(listProjectsHandler, buildEvent(undefined));
      const detail = await run(getProjectHandler, buildEvent(undefined, { pathParameters: { projectId: 'prj_01' } }));

      expect([list.statusCode, detail.statusCode]).toEqual([500, 500]);
      expect(auditPuts()).toHaveLength(0);
    });
  });
});
