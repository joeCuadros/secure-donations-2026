import { ErrorCode } from './error-codes.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  public static badRequest(message: string): AppError {
    return new AppError(400, ErrorCode.VALIDATION_ERROR, message);
  }

  public static unauthorized(message: string = 'Autenticación requerida'): AppError {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message);
  }

  public static forbidden(message: string = 'Acceso no autorizado'): AppError {
    return new AppError(403, ErrorCode.FORBIDDEN, message);
  }

  public static notFound(message: string = 'Recurso no encontrado'): AppError {
    return new AppError(404, ErrorCode.NOT_FOUND, message);
  }

  public static conflict(message: string): AppError {
    return new AppError(409, ErrorCode.CONFLICT, message);
  }

  public static internal(message: string = 'Error interno del servidor'): AppError {
    return new AppError(500, ErrorCode.INTERNAL_ERROR, message);
  }
}