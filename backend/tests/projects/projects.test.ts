import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createProjectService } from '../../src/projects/services/create-project.service.js';
import { getProjectService } from '../../src/projects/services/get-project.service.js';
import { getProjectStatsService } from '../../src/projects/services/stats-project.service.js';
import { publishProjectService } from '../../src/projects/services/publish-project.service.js';
import {
  listProjectsHandler,
  getProjectHandler,
  getProjectStatsHandler,
  createProjectHandler,
  publishProjectHandler,
} from '../../src/projects/api.js';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';

vi.mock('../../src/shared/aws/dynamodb.client.js', () => ({
  docClient: { send: vi.fn() },
}));

describe('Dominio Projects - Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGestorEvent = (body?: unknown, pathParameters?: any, queryParams?: any): APIGatewayProxyEventV2 =>
    ({
      version: '2.0',
      routeKey: 'POST /v1/projects',
      rawPath: '/v1/projects',
      rawQueryString: '',
      headers: {},
      isBase64Encoded: false,
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'id.execute-api.us-east-1.amazonaws.com',
        domainPrefix: 'id',
        http: {
          method: 'POST',
          path: '/v1/projects',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'CustomAgent',
        },
        requestId: 'req_proj_123',
        routeKey: 'POST /v1/projects',
        stage: 'academic',
        time: '05/Nov/2026:10:00:00 +0000',
        timeEpoch: 1793872800000,
        authorizer: {
          jwt: {
            claims: {
              sub: 'sub_gestor_01',
              'cognito:groups': 'GESTOR',
              scope: 'api/projects.write',
            },
            scopes: [],
          },
        },
      },
      body: body ? JSON.stringify(body) : undefined,
      pathParameters,
      queryStringParameters: queryParams,
    }) as unknown as APIGatewayProxyEventV2;

  describe('Casos de uso (Servicios)', () => {
    it('createProjectService debe persistir un proyecto en estado BORRADOR', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({} as never);

      const input = {
        title: 'Tech Reforestation',
        description: 'Proyecto de siembra tecnológica de árboles.',
        purpose: 'Sostenibilidad',
        goalAmountCents: 100000,
      };

      const result = await createProjectService(input, 'sub_gestor_01');

      expect(result.projectId).toMatch(/^prj_[a-f0-9]{12}$/);
      expect(result.status).toBe('BORRADOR');
      expect(result.confirmedAmountCents).toBe(0);
      expect(result.createdBy).toBe('sub_gestor_01');
    });

    it('getProjectService debe retornar proyecto si está PUBLICADO', async () => {
      const mockProject = {
        projectId: 'prj_01',
        title: 'Biblioteca',
        status: 'PUBLICADO',
      };
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: mockProject } as never);

      const res = await getProjectService('prj_01');
      expect(res.projectId).toBe('prj_01');
    });

    it('getProjectStatsService debe calcular el porcentaje exacto de avance', async () => {
      const mockProject = {
        projectId: 'prj_01',
        goalAmountCents: 500000,
        confirmedAmountCents: 125000,
        currency: 'PEN',
        status: 'PUBLICADO',
      };
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: mockProject } as never);

      const stats = await getProjectStatsService('prj_01');
      expect(stats.progress).toBe(25);
      expect(stats.confirmedAmountCents).toBe(125000);
    });

    it('publishProjectService debe publicar un proyecto en estado BORRADOR', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'BORRADOR' } } as never)
        .mockResolvedValueOnce({} as never);

      const published = await publishProjectService('prj_01');
      expect(published.status).toBe('PUBLICADO');
      expect(published.publishedAt).toBeDefined();
    });
  });

  describe('API Handlers (Entrada/Salida HTTP y Errores)', () => {
    it('listProjectsHandler debe listar proyectos públicos con status 200', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({
        Items: [{ projectId: 'prj_01', title: 'Comedor', status: 'PUBLICADO' }],
      } as never);

      const event = {
        requestContext: { requestId: 'req_1' },
        queryStringParameters: { limit: '10' },
      } as unknown as APIGatewayProxyEventV2;

      const res = (await listProjectsHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.items).toHaveLength(1);
    });

    it('listProjectsHandler debe capturar errores y retornar 500 si falla DynamoDB', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('DynamoError'));
      const event = { requestContext: { requestId: 'req_err' } } as unknown as APIGatewayProxyEventV2;

      const res = (await listProjectsHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(500);
    });

    it('getProjectHandler debe retornar 200 OK con el detalle del proyecto', async () => {
      const mockProject = { projectId: 'prj_01', title: 'Biblioteca', status: 'PUBLICADO' };
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: mockProject } as never);

      const event = mockGestorEvent(undefined, { projectId: 'prj_01' });
      const res = (await getProjectHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.projectId).toBe('prj_01');
    });

    it('getProjectHandler debe retornar 404 si el proyecto no existe', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);

      const event = mockGestorEvent(undefined, { projectId: 'prj_not_exists' });
      const res = (await getProjectHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(404);
    });

    it('getProjectStatsHandler debe retornar 200 OK con las estadísticas', async () => {
      const mockProject = {
        projectId: 'prj_01',
        goalAmountCents: 500000,
        confirmedAmountCents: 250000,
        currency: 'PEN',
        status: 'PUBLICADO',
      };
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: mockProject } as never);

      const event = mockGestorEvent(undefined, { projectId: 'prj_01' });
      const res = (await getProjectStatsHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.progress).toBe(50);
    });

    it('getProjectStatsHandler debe retornar 404 si el proyecto no existe', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);

      const event = mockGestorEvent(undefined, { projectId: 'prj_not_exists' });
      const res = (await getProjectStatsHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(404);
    });

    it('createProjectHandler debe responder 201 Created al crear proyecto', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({} as never);
      vi.mocked(docClient.send).mockResolvedValueOnce({} as never);

      const event = mockGestorEvent({
        title: 'Parque Ecológico',
        description: 'Creación de área verde comunal.',
        purpose: 'Ecología',
        goalAmountCents: 200000,
      });

      const res = (await createProjectHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body as string);
      expect(body.title).toBe('Parque Ecológico');
    });

    it('publishProjectHandler debe responder 200 al publicar proyecto exitosamente', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'BORRADOR' } } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({} as never);

      const event = mockGestorEvent(undefined, { projectId: 'prj_01' });
      const res = (await publishProjectHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body as string);
      expect(body.status).toBe('PUBLICADO');
    });

    it('publishProjectHandler debe retornar 409 o 404 en fallos de publicación', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);

      const event = mockGestorEvent(undefined, { projectId: 'prj_invalid' });
      const res = (await publishProjectHandler(event)) as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(404);
    });
  });
});