import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { authorizeUser } from '../authz/api.js';
import { buildSuccessResponse } from '../shared/utils/response.js';
import { handleError } from '../shared/errors/error-handler.js';
import { listAuditLogsService } from './services/list-audit.service.js';

export const listAuditLogsHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    authorizeUser(event, 'AUDITOR', 'api/audit.read');

    const eventType = event.queryStringParameters?.eventType;
    const from = event.queryStringParameters?.from;
    const to = event.queryStringParameters?.to;
    const limit = event.queryStringParameters?.limit ? parseInt(event.queryStringParameters.limit, 10) : 20;
    const nextToken = event.queryStringParameters?.nextToken;

    const result = await listAuditLogsService(eventType, from, to, limit, nextToken);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};