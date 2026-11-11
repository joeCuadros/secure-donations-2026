import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { extractUserContext, verifyScope } from './services/authorize.service.js';

export const extractAndVerifyContext = (
  event: APIGatewayProxyEventV2,
  requiredScope?: string
) => {
  const user = extractUserContext(event);
  if (requiredScope) verifyScope(user, requiredScope);
  return user;
};