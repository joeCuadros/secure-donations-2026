import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { auditHook } from './hook.js';
import { buildSuccessResponse } from '../shared/utils/response.js';
import { handleError } from '../shared/errors/error-handler.js';

export const listAuditLogsHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await auditHook.handleListAuditLogs(event);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};