import type { AuthenticatedUser } from '../../shared/types/api.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/logger.js';

export const verifyGroupPermission = (user: AuthenticatedUser, requiredGroup: string): void => {
  if (!user.groups.includes(requiredGroup)) {
    logger.warn('Permiso denegado por grupo insuficiente', {
      userSub: user.sub,
      requiredGroup,
      userGroups: user.groups,
    });
    throw AppError.forbidden(`Acceso denegado. Se requiere el rol ${requiredGroup}.`);
  }
};

export const verifyScopePermission = (user: AuthenticatedUser, requiredScope: string): void => {
  if (user.scopes.length > 0 && !user.scopes.includes(requiredScope)) {
    logger.warn('Permiso denegado por scope insuficiente', {
      userSub: user.sub,
      requiredScope,
      userScopes: user.scopes,
    });
    throw AppError.forbidden(`Scope insuficiente. Se requiere ${requiredScope}.`);
  }
};

export const verifyRoleAndScope = (
  user: AuthenticatedUser,
  requiredGroup: string,
  requiredScope: string
): void => {
  verifyGroupPermission(user, requiredGroup);
  verifyScopePermission(user, requiredScope);
};