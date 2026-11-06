import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { extractUserContext, verifyRoleAndScope } from './services/authorize.service.js';
import { verifyResourceOwnership } from './services/ownership.service.js';

export const authorizeUser = (
  event: APIGatewayProxyEventV2,
  requiredGroup?: string,
  requiredScope?: string
) => {
  const user = extractUserContext(event);
  if (requiredGroup && requiredScope) {
    verifyRoleAndScope(user, requiredGroup, requiredScope);
  }
  return user;
};

export const assertOwnership = (
  authenticatedSub: string,
  resourceOwnerSub: string,
  resourceName?: string
) => {
  verifyResourceOwnership(authenticatedSub, resourceOwnerSub, resourceName);
};