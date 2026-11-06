import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import {
  extractUserContext,
  verifyRoleAndScope,
  verifyGroupPermission,
  verifyResourceOwnership,
} from './components/index.js';
import type { AuthenticatedUser } from '../shared/types/api.types.js';

export class AuthzHook {
  public getUser(event: APIGatewayProxyEventV2): AuthenticatedUser {
    return extractUserContext(event);
  }

  public requireRoleAndScope(
    event: APIGatewayProxyEventV2,
    requiredGroup: string,
    requiredScope: string
  ): AuthenticatedUser {
    const user = this.getUser(event);
    verifyRoleAndScope(user, requiredGroup, requiredScope);
    return user;
  }

  public requireRole(event: APIGatewayProxyEventV2, requiredGroup: string): AuthenticatedUser {
    const user = this.getUser(event);
    verifyGroupPermission(user, requiredGroup);
    return user;
  }

  public assertOwnership(authenticatedSub: string, resourceOwnerSub: string): void {
    verifyResourceOwnership(authenticatedSub, resourceOwnerSub);
  }
}

export const authzHook = new AuthzHook();