import type { AuthenticatedUser } from '../../shared/types/api.types.js';

export interface AuthorizationContext {
  user: AuthenticatedUser;
  requiredGroup?: string;
  requiredScope?: string;
}

export interface OwnershipContext {
  authenticatedSub: string;
  resourceOwnerSub: string;
}