import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { createProjectService } from '../../src/projects/services/create-project.service.js';
import { getProjectService } from '../../src/projects/services/get-project.service.js';
import { getProjectStatsService } from '../../src/projects/services/stats-project.service.js';
import { publishProjectService } from '../../src/projects/services/publish-project.service.js';
import { listProjectsService } from '../../src/projects/services/list-projects.service.js';
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

vi.mock('../../src/authz/services/avp.service.js', () => ({
  authorizeActionService: vi.fn().mockResolvedValue(undefined),
}));

describe('Dominio Projects - Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockUser = {
    sub: 'sub_gestor_01',
    groups: ['GESTOR'],
    scopes: ['api/projects.write'],
    isMfaVerified: true,
  };

  const mockGestorEvent = (body?: unknown, pathParameters?: any, qs?: any): APIGatewayProxyEventV2 =>
    ({
      requestContext: {
        requestId: 'req_proj_123',
        authorizer: {
          jwt: {
            claims: {
              sub: 'sub_gestor_01',
              'cognito:groups': 'GESTOR',
              scope: 'api/projects.write',
              amr: ['mfa'],
            },
          },
        },
      },
      body: body ? JSON.stringify(body) : undefined,
      pathParameters,
      queryStringParameters: qs
    }) as unknown as APIGatewayProxyEventV2;

  describe('Casos de uso (Servicios)', () => {
    it('createProjectService debe persistir un proyecto en estado BORRADOR delegando AVP', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({} as never);
      const input = {
        title: 'Tech Reforestation',
        description: 'Proyecto.',
        purpose: 'Sostenibilidad',
        goalAmountCents: 100000,
      };

      const result = await createProjectService(input, mockUser);
      expect(result.status).toBe('BORRADOR');
    });

    it('publishProjectService debe publicar un proyecto validando AVP', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'BORRADOR' } } as never)
        .mockResolvedValueOnce({} as never);

      const published = await publishProjectService('prj_01', mockUser);
      expect(published.status).toBe('PUBLICADO');
    });

    it('publishProjectService debe fallar si ya esta publicado', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never);

      await expect(publishProjectService('prj_01', mockUser)).rejects.toThrow(/El proyecto ya se encuentra publicado/);
    });

    it('publishProjectService debe fallar si no existe', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);
      await expect(publishProjectService('prj_01', mockUser)).rejects.toThrow(/Proyecto no encontrado/);
    });

    it('listProjectsService debe listar proyectos', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [{ projectId: 'prj_01' }] } as never);
      const res = await listProjectsService(10);
      expect(res.items.length).toBe(1);
    });

    it('getProjectStatsService debe calcular progresos', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: { projectId: 'prj_01', goalAmountCents: 1000, confirmedAmountCents: 500, status: 'PUBLICADO' } } as never);
      const res = await getProjectStatsService('prj_01');
      expect(res.progress).toBe(50);
    });
  });

  describe('API Handlers', () => {
    it('createProjectHandler debe responder 201 Created al crear proyecto', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({} as never).mockResolvedValueOnce({} as never);
      const event = mockGestorEvent({
        title: 'Parque Ecológico',
        description: 'Creación de área verde comunal.',
        purpose: 'Ecología',
        goalAmountCents: 200000,
      });

      const res = (await createProjectHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(201);
    });

    it('createProjectHandler debe capturar errores 500', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('fail'));
      const event = mockGestorEvent({
        title: 'Parque Ecológico',
        description: 'Creación de área verde comunal.',
        purpose: 'Ecología',
        goalAmountCents: 200000,
      });

      const res = (await createProjectHandler(event)) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(500);
    });

    it('publishProjectHandler debe responder 200 al publicar', async () => {
      vi.mocked(docClient.send)
        .mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'BORRADOR' } } as never)
        .mockResolvedValueOnce({} as never)
        .mockResolvedValueOnce({} as never);
      
      const res = (await publishProjectHandler(mockGestorEvent(undefined, {projectId: 'prj_01'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
    });

    it('publishProjectHandler debe capturar error si no encuentra proyecto', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: undefined } as never);
      const res = (await publishProjectHandler(mockGestorEvent(undefined, {projectId: 'prj_01'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(404);
    });

    it('listProjectsHandler debe responder 200', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Items: [] } as never);
      const res = (await listProjectsHandler(mockGestorEvent(undefined, undefined, {limit: '10'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
    });

    it('listProjectsHandler debe capturar errores', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('fail'));
      const res = (await listProjectsHandler(mockGestorEvent())) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(500);
    });

    it('getProjectHandler debe responder 200', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: { projectId: 'prj_01', status: 'PUBLICADO' } } as never);
      const res = (await getProjectHandler(mockGestorEvent(undefined, {projectId: 'prj_01'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
    });

    it('getProjectHandler debe capturar error', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('fail'));
      const res = (await getProjectHandler(mockGestorEvent(undefined, {projectId: 'prj_01'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(500);
    });

    it('getProjectStatsHandler debe responder 200', async () => {
      vi.mocked(docClient.send).mockResolvedValueOnce({ Item: { projectId: 'prj_01', goalAmountCents: 1000, confirmedAmountCents: 500, status: 'PUBLICADO' } } as never);
      const res = (await getProjectStatsHandler(mockGestorEvent(undefined, {projectId: 'prj_01'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
    });

    it('getProjectStatsHandler debe capturar error', async () => {
      vi.mocked(docClient.send).mockRejectedValueOnce(new Error('fail'));
      const res = (await getProjectStatsHandler(mockGestorEvent(undefined, {projectId: 'prj_01'}))) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(500);
    });
  });
});