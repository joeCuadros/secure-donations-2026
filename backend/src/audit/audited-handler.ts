import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { extractUserContext } from '../authz/services/authorize.service.js';
import { getErrorStatusCode } from '../shared/errors/error-handler.js';
import { statusOf, withAccessLog, type ApiHandler } from '../shared/logger/access-log.js';
import { logger } from '../shared/logger/logger.js';
import { createAuditLogService } from './services/create-audit.service.js';
import type { AuditOutcome } from './types.js';

export interface AuditSpec {
  eventType: string;
  action: string;
  // Las operaciones de escritura registran también el éxito; las consultas solo registran rechazos.
  recordSuccess: boolean;
  // Parámetro del path que identifica el recurso afectado (por ejemplo `projectId`).
  pathParam?: string;
}

/** El handler asigna `resourceRef` cuando conoce el recurso creado o afectado. */
export interface AuditContext {
  resourceRef: string | undefined;
}

export type AuditedHandler = (
  event: APIGatewayProxyEventV2,
  audit: AuditContext
) => Promise<APIGatewayProxyResultV2>;

const NO_RESOURCE_REF = 'n/a';
const INVALID_RESOURCE_REF = 'invalid';
const SAFE_RESOURCE_REF = /^[A-Za-z0-9_-]{1,64}$/;

// Los identificadores salen del path o de resultados internos; si no tienen la forma esperada no se almacenan.
const toResourceRef = (value: string | undefined): string => {
  if (value === undefined || value === '') return NO_RESOURCE_REF;
  return SAFE_RESOURCE_REF.test(value) ? value : INVALID_RESOURCE_REF;
};

const outcomeOf = (statusCode: number): AuditOutcome => {
  if (statusCode < 400) return 'SUCCESS';
  if (statusCode === 401 || statusCode === 403) return 'DENIED';
  return statusCode < 500 ? 'FAILURE' : 'ERROR';
};

// Solo se usa la identidad del contexto del authorizer; sin ella el evento queda con `actor_unknown`.
const verifiedSub = (event: APIGatewayProxyEventV2): string | undefined => {
  try {
    return extractUserContext(event).sub;
  } catch {
    return undefined;
  }
};

// Un fallo de auditoría nunca cambia la respuesta HTTP: se registra en el log y la solicitud continúa.
const recordAudit = async (
  event: APIGatewayProxyEventV2,
  spec: AuditSpec,
  audit: AuditContext,
  statusCode: number
): Promise<void> => {
  const outcome = outcomeOf(statusCode);
  if (outcome === 'SUCCESS' && !spec.recordSuccess) return;

  try {
    await createAuditLogService({
      eventType: spec.eventType,
      requestId: event.requestContext.requestId,
      actorSub: verifiedSub(event),
      action: spec.action,
      resourceRef: toResourceRef(audit.resourceRef),
      outcome,
    });
  } catch (error) {
    logger.error('Error no bloqueante en auditoría', { error: String(error) });
  }
};

/**
 * Variante de `withAccessLog` para los handlers protegidos: persiste exactamente un evento de auditoría
 * por solicitud (éxito si `recordSuccess`, y siempre los rechazos tras autenticar: DENIED, FAILURE o ERROR).
 * Nunca se almacenan cabeceras, tokens, cuerpo ni importes (CA-08.3, CA-10.2).
 */
export const withAuditedAccessLog = (
  logAction: string,
  spec: AuditSpec,
  handler: AuditedHandler
): ApiHandler =>
  withAccessLog(logAction, async (event) => {
    const audit: AuditContext = {
      resourceRef: spec.pathParam ? event.pathParameters?.[spec.pathParam] : undefined,
    };

    let result: APIGatewayProxyResultV2;
    try {
      result = await handler(event, audit);
    } catch (error) {
      await recordAudit(event, spec, audit, getErrorStatusCode(error));
      throw error;
    }

    await recordAudit(event, spec, audit, statusOf(result));
    return result;
  });
