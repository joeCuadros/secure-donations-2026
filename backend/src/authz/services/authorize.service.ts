
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { AuthenticatedUser } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';

interface JwtAuthorizer {
  jwt?: {
    claims?: Record<string, unknown>;
  };
}

export const extractUserContext = (
  event: APIGatewayProxyEventV2
): AuthenticatedUser => {
  const authorizer = (
    event.requestContext as typeof event.requestContext & {
      authorizer?: JwtAuthorizer;
    }
  ).authorizer;

  const claims = authorizer?.jwt?.claims;

  if (!claims) {
    throw AppError.unauthorized('Token no válido o ausente');
  }

  const sub = claims['sub'];

  if (typeof sub !== 'string' || !sub) {
    throw AppError.unauthorized('El claim sub es obligatorio');
  }

  // Parsear grupos
  let groups: string[] = [];
  const rawGroups = claims['cognito:groups'];

  if (Array.isArray(rawGroups)) {
    groups = rawGroups.map(String);
  } else if (typeof rawGroups === 'string') {
    groups = rawGroups.split(',').map((g) => g.trim());
  }

  // Parsear scopes
  let scopes: string[] = [];
  const rawScope = claims['scope'];

  if (typeof rawScope === 'string') {
    scopes = rawScope.split(' ').filter(Boolean);
  } else if (Array.isArray(rawScope)) {
    scopes = rawScope.map(String);
  }

  const email = claims['email'];
  const username = claims['username'] ?? claims['cognito:username'];

  return {
    sub,
    groups,
    scopes,
    ...(typeof email === 'string' ? { email } : {}),
    ...(typeof username === 'string' ? { username } : {}),
  };
};

export const verifyRoleAndScope = (
  user: AuthenticatedUser,
  requiredGroup: string,
  requiredScope: string
): void => {
  if (!user.groups.includes(requiredGroup)) {
    throw AppError.forbidden(
      `Acceso denegado. Se requiere el rol ${requiredGroup}.`
    );
  }

  if (user.scopes.length > 0 && !user.scopes.includes(requiredScope)) {
    throw AppError.forbidden(
      `Scope insuficiente. Se requiere ${requiredScope}.`
    );
  }
};
