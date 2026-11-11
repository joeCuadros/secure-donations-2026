import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { getErrorCode, handleError } from '../errors/error-handler.js';
import { logger } from './logger.js';

export type ApiHandler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

export const statusOf = (result: APIGatewayProxyResultV2): number =>
  typeof result === 'object' && result !== null && typeof result.statusCode === 'number'
    ? result.statusCode
    : 200;

/**
 * Envuelve un handler HTTP: convierte cualquier excepción en la respuesta de error uniforme
 * `{ code, message, requestId }` y emite exactamente una línea JSON de acceso por invocación
 * (CA-NF07.1) con requestId, acción, resultado, código HTTP y duración.
 * Nunca se registran cabeceras, tokens, cuerpo ni el evento crudo.
 */
export const withAccessLog = (action: string, handler: ApiHandler): ApiHandler =>
  async (event) => {
    const startedAt = Date.now();
    const requestId = event.requestContext.requestId;
    let result: APIGatewayProxyResultV2;
    let errorCode: string | undefined;

    try {
      result = await handler(event);
    } catch (error) {
      errorCode = getErrorCode(error);
      result = handleError(error, requestId);
    }

    const statusCode = statusOf(result);
    logger.access(statusCode, {
      requestId,
      action,
      outcome: statusCode < 400 ? 'SUCCESS' : 'FAILURE',
      durationMs: Date.now() - startedAt,
      ...(errorCode ? { errorCode } : {}),
    });
    return result;
  };
