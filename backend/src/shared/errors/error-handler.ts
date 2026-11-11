import { ZodError } from 'zod';
import { AppError } from './app-error.js';
import { ErrorCode } from './error-codes.js';
import { buildErrorResponse } from '../utils/response.js';
import { logger } from '../logger/logger.js';
import type { APIGatewayProxyResultV2 } from 'aws-lambda';

export const getErrorCode = (error: unknown): ErrorCode => {
  if (error instanceof AppError) return error.code;
  if (error instanceof ZodError) return ErrorCode.VALIDATION_ERROR;
  return ErrorCode.INTERNAL_ERROR;
};

export const getErrorStatusCode = (error: unknown): number => {
  if (error instanceof AppError) return error.statusCode;
  if (error instanceof ZodError) return 400;
  return 500;
};

// Los errores esperados (AppError, ZodError) quedan trazados en la línea de acceso del handler.
export const handleError = (error: unknown, requestId: string): APIGatewayProxyResultV2 => {
  if (error instanceof AppError) {
    return buildErrorResponse(error.statusCode, error.code, error.message, requestId);
  }

  if (error instanceof ZodError) {
    const message = error.issues.map((i) => i.message).join('; ');
    return buildErrorResponse(400, ErrorCode.VALIDATION_ERROR, message, requestId);
  }

  logger.error('Error no controlado', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    requestId,
  });

  return buildErrorResponse(500, ErrorCode.INTERNAL_ERROR, 'Ocurrió un error interno en el servidor.', requestId);
};
