import { z } from 'zod';
import { extractAndVerifyContext } from '../authz/api.js';
import { buildSuccessResponse, parseJsonBody } from '../shared/utils/index.js';
import { withAccessLog } from '../shared/logger/access-log.js';
import { DEFAULT_PAGE_SIZE, paginationQuerySchema } from '../shared/schemas/common.schema.js';
import { listProjectsService } from './services/list-projects.service.js';
import { getProjectService } from './services/get-project.service.js';
import { getProjectStatsService } from './services/stats-project.service.js';
import { createProjectService } from './services/create-project.service.js';
import { publishProjectService } from './services/publish-project.service.js';
import { createAuditLogService } from '../audit/services/create-audit.service.js';

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

export const createProjectHandler = withAccessLog('createProject', async (event) => {
  const requestId = event.requestContext.requestId;
  const user = extractAndVerifyContext(event, 'api/projects.write');
  const body = createProjectSchema.parse(parseJsonBody(event));
  const result = await createProjectService(body, user);

  await createAuditLogService({
    eventType: 'PROJECT_EVENT',
    requestId,
    actorSub: user.sub,
    action: 'CREATE_PROJECT',
    resourceRef: result.projectId,
    outcome: 'SUCCESS',
  });

  return buildSuccessResponse(201, result);
});

export const publishProjectHandler = withAccessLog('publishProject', async (event) => {
  const requestId = event.requestContext.requestId;
  const user = extractAndVerifyContext(event, 'api/projects.write');
  const projectId = event.pathParameters?.projectId!;
  const result = await publishProjectService(projectId, user);

  await createAuditLogService({
    eventType: 'PROJECT_EVENT',
    requestId,
    actorSub: user.sub,
    action: 'PUBLISH_PROJECT',
    resourceRef: projectId,
    outcome: 'SUCCESS',
  });

  return buildSuccessResponse(200, result);
});
