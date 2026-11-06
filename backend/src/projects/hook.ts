import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { authzHook } from '../authz/hook.js';
import {
  validateCreateProject,
  validateProjectIdParam,
  createProject,
  getProject,
  getProjectStats,
  listProjects,
  publishProject,
} from './components/index.js';
import { createAuditLog } from '../audit/components/create-audit-log.js';

export class ProjectsHook {
  public async handleListProjects(event: APIGatewayProxyEventV2) {
    const limitParam = event.queryStringParameters?.['limit'];
    const limit = limitParam ? parseInt(limitParam, 10) : 20;
    const nextToken = event.queryStringParameters?.['nextToken'];
    return await listProjects(limit, nextToken);
  }

  public async handleGetProject(event: APIGatewayProxyEventV2) {
    const projectId = validateProjectIdParam(event.pathParameters || null);
    return await getProject(projectId);
  }

  public async handleGetProjectStats(event: APIGatewayProxyEventV2) {
    const projectId = validateProjectIdParam(event.pathParameters || null);
    return await getProjectStats(projectId);
  }

  public async handleCreateProject(event: APIGatewayProxyEventV2) {
    // Exige grupo GESTOR y scope api/projects.write
    const user = authzHook.requireRoleAndScope(event, 'GESTOR', 'api/projects.write');

    if (!event.body) {
      throw new Error('El cuerpo de la solicitud no puede estar vacío');
    }

    const payload = JSON.parse(event.body);
    const validatedInput = validateCreateProject(payload);

    const result = await createProject(validatedInput, user.sub);

    // Auditoría
    await createAuditLog({
      eventType: 'PROJECT_EVENT',
      requestId: event.requestContext.requestId,
      actorSub: user.sub,
      action: 'CREATE_PROJECT',
      resourceRef: result.projectId,
      outcome: 'SUCCESS',
    });

    return result;
  }

  public async handlePublishProject(event: APIGatewayProxyEventV2) {
    const user = authzHook.requireRoleAndScope(event, 'GESTOR', 'api/projects.write');
    const projectId = validateProjectIdParam(event.pathParameters || null);

    const result = await publishProject(projectId);

    // Auditoría
    await createAuditLog({
      eventType: 'PROJECT_EVENT',
      requestId: event.requestContext.requestId,
      actorSub: user.sub,
      action: 'PUBLISH_PROJECT',
      resourceRef: projectId,
      outcome: 'SUCCESS',
    });

    return result;
  }
}

export const projectsHook = new ProjectsHook();