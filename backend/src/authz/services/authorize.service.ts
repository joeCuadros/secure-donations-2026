import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { AuthenticatedUser } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';

export const extractUserContext = (event: APIGatewayProxyEventV2): AuthenticatedUser => {
  const authorizer = event.requestContext.authorizer;
  if (!authorizer || !authorizer.jwt || !authorizer.jwt.claims) {
    throw AppError.unauthorized('Token no válido o ausente');
  }

  const claims = authorizer.jwt.claims;
  const sub = claims['sub'] as string;
  if (!sub) throw AppError.unauthorized('El claim sub es obligatorio');

  let groups: string[] = [];
  const rawGroups = claims['cognito:groups'];
  if (Array.isArray(rawGroups)) groups = rawGroups.map(String);
  else if (typeof rawGroups === 'string') groups = rawGroups.split(',').map((g) => g.trim());

  let scopes: string[] = [];
  const rawScope = claims['scope'];
  if (typeof rawScope === 'string') scopes = rawScope.split(' ').filter(Boolean);
  else if (Array.isArray(rawScope)) scopes = rawScope.map(String);

  return {
    sub,
    email: claims['email'] as string | undefined,
    groups,
    scopes,
    username: (claims['username'] || claims['cognito:username']) as string | undefined,
  };
};

export const verifyRoleAndScope = (
  user: AuthenticatedUser,
  requiredGroup: string,
  requiredScope: string
): void => {
  if (!user.groups.includes(requiredGroup)) {
    throw AppError.forbidden(`Acceso denegado. Se requiere el rol ${requiredGroup}.`);
  }
  if (user.scopes.length > 0 && !user.scopes.includes(requiredScope)) {
    throw AppError.forbidden(`Scope insuficiente. Se requiere ${requiredScope}.`);
  }
};