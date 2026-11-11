import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { AuthenticatedUser } from '../types.js';
import { AppError } from '../../shared/errors/app-error.js';

interface JwtAuthorizer {
  jwt?: {
    claims?: Record<string, unknown>;
  };
}

/**
 * Normaliza un claim con varios valores (`cognito:groups`, `scope`).
 * El authorizer JWT de API Gateway HTTP API entrega los claims de tipo arreglo como un
 * único string, por ejemplo "[DONANTE]" o "[GESTOR AUDITOR]" (separado por espacios y entre
 * corchetes). También se aceptan arreglos reales y strings separados por comas o espacios.
 */
export const parseClaimList = (raw: unknown): string[] => {
  const values: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.trim().replace(/^\[|\]$/g, '').split(/[\s,]+/)
      : [];

  return values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().replace(/^["']|["']$/g, ''))
    .filter((value) => value.length > 0);
};

export const extractUserContext = (event: APIGatewayProxyEventV2): AuthenticatedUser => {
  const authorizer = (
    event.requestContext as typeof event.requestContext & { authorizer?: JwtAuthorizer; }
  ).authorizer;

  const claims = authorizer?.jwt?.claims;
  if (!claims) throw AppError.unauthorized('Token no válido o ausente');

  const sub = claims['sub'];
  if (typeof sub !== 'string' || !sub) throw AppError.unauthorized('El claim sub es obligatorio');

  const groups = parseClaimList(claims['cognito:groups']);
  const scopes = parseClaimList(claims['scope']);

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

// Falla cerrada: una ruta que exige scope nunca se concede a un token sin scopes.
export const verifyScope = (user: AuthenticatedUser, requiredScope: string): void => {
  if (!user.scopes.includes(requiredScope)) {
    throw AppError.forbidden(`Scope insuficiente. Se requiere ${requiredScope}.`);
  }
};
