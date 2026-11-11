import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { z } from 'zod';
import { extractAndVerifyContext } from '../authz/api.js';
import { buildSuccessResponse } from '../shared/utils/response.js';
import { handleError } from '../shared/errors/error-handler.js';
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

export const listProjectsHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit, 10) : 20;
    const nextToken = event.queryStringParameters?.nextToken;
    const result = await listProjectsService(limit, nextToken);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const getProjectHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const projectId = event.pathParameters?.projectId!;
    const result = await getProjectService(projectId);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const getProjectStatsHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const projectId = event.pathParameters?.projectId!;
    const result = await getProjectStatsService(projectId);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const createProjectHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const user = extractAndVerifyContext(event, 'api/projects.write');
    const body = createProjectSchema.parse(JSON.parse(event.body || '{}'));
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
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const publishProjectHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
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
  } catch (error) {
    return handleError(error, requestId);
  }
};