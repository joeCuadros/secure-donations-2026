import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { listDraftProjectsHandler } from '../../src/projects/api.js';
import { listProjectsService } from '../../src/projects/services/list-projects.service.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { authorizeActionService } from '../../src/authz/services/avp.service.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import { env } from '../../src/shared/config/env.js';
import { expectOnlyAuditWrites } from '../helpers/audit-calls.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

vi.mock('../../src/authz/services/avp.service.js', () => ({
  authorizeActionService: vi.fn().mockResolvedValue(undefined),
}));

type Command = { constructor: { name: string }; input: Record<string, any> };

const MANAGER_SUB = 'sub-del-gestor-secreto';

const commands = (): Command[] => vi.mocked(docClient.send).mock.calls.map(([command]) => command as unknown as Command);
const auditItems = () =>
  commands()
    .filter((c) => c.constructor.name === 'PutCommand' && c.input['TableName'] === env.AUDIT_TABLE)
    .map((c) => c.input['Item'] as Record<string, unknown>);

const buildEvent = (
  claims: Record<string, unknown> | undefined,
  queryStringParameters?: Record<string, string>
): APIGatewayProxyEventV2 =>
  ({
    requestContext: { requestId: 'req_drafts_1', authorizer: claims ? { jwt: { claims } } : undefined },
    queryStringParameters,
  }) as unknown as APIGatewayProxyEventV2;

const gestor = { sub: MANAGER_SUB, 'cognito:groups': '[GESTOR]', scope: 'openid api/projects.write' };
const donante = { sub: 'sub-donante', 'cognito:groups': '[DONANTE]', scope: 'openid api/donations.write api/donations.read' };

const storedDraft = (projectId: string) => ({
  projectId,
  title: `Borrador ${projectId}`,
  description: 'Descripción interna del borrador',
  purpose: 'Alimentación',
  goalAmountCents: 250000,
  confirmedAmountCents: 0,
  currency: 'PEN',
  status: 'BORRADOR',
  createdBy: MANAGER_SUB,
  createdAt: '2026-11-10T12:00:00.000Z',
  updatedAt: '2026-11-10T12:00:00.000Z',
});

const run = async (event: APIGatewayProxyEventV2) =>
  (await listDraftProjectsHandler(event)) as APIGatewayProxyStructuredResultV2;

describe('HU-08 / CA-08.2: GET /v1/projects/drafts (borradores para el GESTOR)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authorizeActionService).mockReset().mockResolvedValue(undefined);
    vi.mocked(docClient.send).mockReset().mockResolvedValue({ Items: [] } as never);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('Respuesta correcta', () => {
    it('HU-08 / CA-08.2: responde 200 al GESTOR con solo proyectos BORRADOR y sin createdBy ni identificadores de usuario', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({
        Items: [storedDraft('prj_a'), storedDraft('prj_b')],
        LastEvaluatedKey: { projectId: 'prj_b', status: 'BORRADOR', createdAt: '2026-11-10T12:00:00.000Z' },
      } as never);

      const res = await run(buildEvent(gestor));

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.items.map((p: { projectId: string }) => p.projectId)).toEqual(['prj_a', 'prj_b']);
      expect(body.items.every((p: { status: string }) => p.status === 'BORRADOR')).toBe(true);
      expect(body.items[0]).toEqual({
        projectId: 'prj_a',
        title: 'Borrador prj_a',
        purpose: 'Alimentación',
        goalAmountCents: 250000,
        confirmedAmountCents: 0,
        currency: 'PEN',
        status: 'BORRADOR',
        createdAt: '2026-11-10T12:00:00.000Z',
      });
      expect(JSON.stringify(body)).not.toContain('createdBy');
      expect(res.body).not.toContain(MANAGER_SUB);
      expect(typeof body.nextToken).toBe('string');
    });

    it('HU-08: la respuesta conserva el sobre { items, nextToken } de la lista pública (nextToken null en la última página)', async () => {
      const res = await run(buildEvent(gestor));

      expect(JSON.parse(res.body as string)).toEqual({ items: [], nextToken: null });
    });

    it('CA-08.2: la consulta es un Query sobre el índice status-createdAt con status BORRADOR, nunca un Scan', async () => {
      await run(buildEvent(gestor));

      const sent = commands();
      expect(sent).toHaveLength(1); // los éxitos de lectura no se auditan
      expect(sent.map((c) => c.constructor.name)).not.toContain('ScanCommand');
      expect(sent[0]!.constructor.name).toBe('QueryCommand');
      expect(sent[0]!.input).toMatchObject({
        TableName: env.PROJECTS_TABLE,
        IndexName: 'status-createdAt',
        KeyConditionExpression: '#s = :statusVal',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':statusVal': 'BORRADOR' },
        Limit: 20,
        ScanIndexForward: false,
      });
    });

    it('CA-NF05: acepta limit y nextToken como la lista pública y reanuda desde la clave decodificada', async () => {
      const startKey = { projectId: 'prj_a', status: 'BORRADOR', createdAt: '2026-11-10T12:00:00.000Z' };
      const nextToken = Buffer.from(JSON.stringify(startKey)).toString('base64');

      await run(buildEvent(gestor, { limit: '100', nextToken }));

      expect(commands()[0]!.input).toMatchObject({ Limit: 100, ExclusiveStartKey: startKey });
    });

    it('CA-08.2: el GESTOR es autorizado por Verified Permissions con la acción ListDraftProjects', async () => {
      await run(buildEvent(gestor));

      expect(authorizeActionService).toHaveBeenCalledTimes(1);
      expect(authorizeActionService).toHaveBeenCalledWith(
        expect.objectContaining({ sub: MANAGER_SUB, groups: ['GESTOR'] }),
        'ListDraftProjects'
      );
    });
  });

  describe('Rechazos', () => {
    it('CA-04.1: responde 403 cuando Verified Permissions deniega (p. ej. DONANTE) y no lee ningún proyecto', async () => {
      vi.mocked(authorizeActionService).mockRejectedValueOnce(AppError.forbidden('Acceso denegado'));

      const res = await run(buildEvent({ ...donante, scope: 'openid api/projects.write' }));

      expect(res.statusCode).toBe(403);
      expect(JSON.parse(res.body as string)).toMatchObject({ code: 'FORBIDDEN', requestId: 'req_drafts_1' });
      expectOnlyAuditWrites(); // solo el evento DENIED; ninguna lectura de Projects
    });

    it('CA-NF02.1: sin el scope api/projects.write responde 403 sin consultar al motor ni a Projects', async () => {
      const res = await run(buildEvent({ ...gestor, scope: 'openid api/donations.read' }));

      expect(res.statusCode).toBe(403);
      expect(authorizeActionService).not.toHaveBeenCalled();
      expectOnlyAuditWrites();
    });

    it('CA-03.2: sin claims verificados responde 401 y no consulta nada salvo la auditoría', async () => {
      const res = await run(buildEvent(undefined));

      expect(res.statusCode).toBe(401);
      expect(authorizeActionService).not.toHaveBeenCalled();
      expectOnlyAuditWrites();
      expect(auditItems()[0]).toMatchObject({ outcome: 'DENIED' });
    });

    it.each(['0', '101', 'abc', '1.5', '-1', ''])(
      'CA-NF05: responde 400 si limit=%j no es un entero entre 1 y 100, sin consultar Projects',
      async (limit) => {
        const res = await run(buildEvent(gestor, { limit }));

        expect(res.statusCode).toBe(400);
        expect(JSON.parse(res.body as string).code).toBe('VALIDATION_ERROR');
        expectOnlyAuditWrites(); // solo el evento FAILURE
      }
    );

    it('CA-NF02.2: un GESTOR con un limit inválido no obtiene un 400 antes que la decisión de autorización', async () => {
      vi.mocked(authorizeActionService).mockRejectedValueOnce(AppError.forbidden('Acceso denegado'));

      const res = await run(buildEvent(gestor, { limit: 'abc' }));

      expect(res.statusCode).toBe(403);
    });
  });

  describe('Auditoría (CA-08.3, CA-10.2)', () => {
    it('CA-08.3: un rechazo de Verified Permissions queda registrado como DENIED en AuditEvents', async () => {
      vi.mocked(authorizeActionService).mockRejectedValueOnce(AppError.forbidden('Acceso denegado'));

      await run(buildEvent({ ...donante, scope: 'openid api/projects.write' }));

      expect(auditItems()).toHaveLength(1);
      expect(auditItems()[0]).toMatchObject({
        eventType: 'PROJECT_EVENT',
        gsi1pk: 'AUDIT',
        requestId: 'req_drafts_1',
        action: 'LIST_DRAFT_PROJECTS',
        resourceRef: 'n/a',
        outcome: 'DENIED',
      });
      expect(auditItems()[0]!['actorRef']).toMatch(/^actor_[0-9a-f]{8}$/);
    });

    it('CA-08.3: un scope insuficiente registra DENIED y un limit inválido registra FAILURE', async () => {
      await run(buildEvent({ ...gestor, scope: 'openid' }));
      await run(buildEvent(gestor, { limit: '0' }));

      expect(auditItems().map((item) => item['outcome'])).toEqual(['DENIED', 'FAILURE']);
    });

    it('CA-10.2: la consulta exitosa no genera evento de auditoría y los eventos no contienen sub ni datos de proyectos', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [storedDraft('prj_a')] } as never);
      const ok = await run(buildEvent(gestor));
      expect(ok.statusCode).toBe(200);
      expect(auditItems()).toHaveLength(0);

      vi.mocked(authorizeActionService).mockRejectedValueOnce(AppError.forbidden('Acceso denegado'));
      await run(buildEvent(gestor));
      const serialized = JSON.stringify(auditItems());
      expect(serialized).not.toContain(MANAGER_SUB);
      expect(serialized).not.toContain('Borrador');
    });

    it('CA-08.3: un fallo inesperado de DynamoDB responde 500 y queda registrado como ERROR', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('fallo interno'));

      const res = await run(buildEvent(gestor));

      expect(res.statusCode).toBe(500);
      expect(auditItems().map((item) => item['outcome'])).toEqual(['ERROR']);
    });
  });

  describe('Las rutas públicas no cambian (CA-01.2)', () => {
    it('CA-01.2: el catálogo público sigue consultando únicamente PUBLICADO', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);

      await listProjectsService(10);

      const [command] = commands();
      expect(command!.constructor.name).toBe('QueryCommand');
      expect(command!.input).toMatchObject({
        IndexName: 'status-createdAt',
        ExpressionAttributeValues: { ':statusVal': 'PUBLICADO' },
      });
    });
  });
});
