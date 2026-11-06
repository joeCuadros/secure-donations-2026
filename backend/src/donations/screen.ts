import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { donationsHook } from './hook.js';
import { buildSuccessResponse } from '../shared/utils/response.js';
import { handleError } from '../shared/errors/error-handler.js';

export const createDonationHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const { statusCode, data } = await donationsHook.handleCreateDonation(event);
    return buildSuccessResponse(statusCode, data);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const simulateDonationHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await donationsHook.handleSimulateDonation(event);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};

export const listMyDonationsHandler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  try {
    const result = await donationsHook.handleListMyDonations(event);
    return buildSuccessResponse(200, result);
  } catch (error) {
    return handleError(error, requestId);
  }
};