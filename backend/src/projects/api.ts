import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { projectsHook } from './hook.js';
import { buildSuccessResponse } from '../shared/utils/response.js';
import { handleError } from '../shared/errors/error-handler.js';

export const listProjectsHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await projectsHook.handleListProjects(event);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const getProjectHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await projectsHook.handleGetProject(event);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const getProjectStatsHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await projectsHook.handleGetProjectStats(event);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const createProjectHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await projectsHook.handleCreateProject(event);
    return buildSuccessResponse(201, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const publishProjectHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await projectsHook.handlePublishProject(event);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};