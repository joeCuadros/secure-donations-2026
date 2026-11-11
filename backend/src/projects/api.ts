import { z } from 'zod';
import { extractAndVerifyContext } from '../authz/api.js';
import { buildSuccessResponse, parseJsonBody } from '../shared/utils/index.js';
import { withAccessLog } from '../shared/logger/access-log.js';
import { DEFAULT_PAGE_SIZE, paginationQuerySchema } from '../shared/schemas/common.schema.js';
import { listProjectsService } from './services/list-projects.service.js';
import { listDraftProjectsService } from './services/list-draft-projects.service.js';
import { authorizeActionService } from '../authz/services/avp.service.js';
import { getProjectService } from './services/get-project.service.js';
import { getProjectStatsService } from './services/stats-project.service.js';
import { createProjectService } from './services/create-project.service.js';
import { publishProjectService } from './services/publish-project.service.js';
import { withAuditedAccessLog } from '../audit/audited-handler.js';

const createProjectSchema = z.object({
  title: z.string().min(3).max(150),
  description: z.string().min(10),
  purpose: z.string().min(5),
  goalAmountCents: z.number().int().positive(),
});

export const listProjectsHandler = withAccessLog('listProjects', async (event) => {
  const { limit = DEFAULT_PAGE_SIZE, nextToken } = paginationQuerySchema.parse(event.queryStringParameters ?? {});
  const result = await listProjectsService(limit, nextToken);
  return buildSuccessResponse(200, result);
});

export const getProjectHandler = withAccessLog('getProject', async (event) => {
  const projectId = event.pathParameters?.projectId!;
  // La vista pública no expone el identificador del gestor que creó el proyecto (CA-02.1, CA-09.2).
  const { createdBy: _createdBy, ...publicProject } = await getProjectService(projectId);
  return buildSuccessResponse(200, publicProject);
});

export const getProjectStatsHandler = withAccessLog('getProjectStats', async (event) => {
  const projectId = event.pathParameters?.projectId!;
  const result = await getProjectStatsService(projectId);
  return buildSuccessResponse(200, result);
});

export const createProjectHandler = withAuditedAccessLog(
  'createProject',
  { eventType: 'PROJECT_EVENT', action: 'CREATE_PROJECT', recordSuccess: true },
  async (event, audit) => {
    const user = extractAndVerifyContext(event, 'api/projects.write');
    const body = createProjectSchema.parse(parseJsonBody(event));
    const result = await createProjectService(body, user);

    audit.resourceRef = result.projectId;
    return buildSuccessResponse(201, result);
  }
);

export const publishProjectHandler = withAuditedAccessLog(
  'publishProject',
  { eventType: 'PROJECT_EVENT', action: 'PUBLISH_PROJECT', recordSuccess: true, pathParam: 'projectId' },
  async (event) => {
    const user = extractAndVerifyContext(event, 'api/projects.write');
    const projectId = event.pathParameters?.projectId!;
    const result = await publishProjectService(projectId, user);

    return buildSuccessResponse(200, result);
  }
);

// HU-08: cualquier GESTOR ve todos los borradores, no solo los propios. La matriz de roles asigna la gestión de
// proyectos al rol GESTOR y PublishProject ya permite a cualquier GESTOR publicar cualquier proyecto.
// La respuesta no incluye `createdBy`. Solo se auditan los rechazos: las lecturas exitosas no generan evento.
export const listDraftProjectsHandler = withAuditedAccessLog(
  'listDraftProjects',
  { eventType: 'PROJECT_EVENT', action: 'LIST_DRAFT_PROJECTS', recordSuccess: false },
  async (event) => {
    const user = extractAndVerifyContext(event, 'api/projects.write');
    await authorizeActionService(user, 'ListDraftProjects');

    const { limit = DEFAULT_PAGE_SIZE, nextToken } = paginationQuerySchema.parse(event.queryStringParameters ?? {});
    const result = await listDraftProjectsService(limit, nextToken);
    return buildSuccessResponse(200, result);
  }
);
