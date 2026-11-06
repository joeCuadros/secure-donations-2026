import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyStructuredResultV2 } from 'aws-lambda';
import { AppError } from '../../src/shared/errors/app-error.js';
import { ErrorCode } from '../../src/shared/errors/error-codes.js';
import { handleError } from '../../src/shared/errors/error-handler.js';
import { buildSuccessResponse, buildErrorResponse } from '../../src/shared/utils/response.js';
import { encodeNextToken, decodeNextToken } from '../../src/shared/utils/pagination.js';
import { logger } from '../../src/shared/logger/logger.js';
import { uuidSchema, amountCentsSchema, paginationQuerySchema } from '../../src/shared/schemas/common.schema.js';
import { getEnv } from '../../src/shared/config/env.js';
import { ZodError } from 'zod';

describe('Shared Module - Comprehensive Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Env Config', () => {
    it('debe validar las variables de entorno o lanzar excepción en configuración inválida', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'invalid_env_name' as any;
      expect(() => getEnv()).toThrow();
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('AppError & ErrorHandler', () => {
    it('debe instanciar AppError con factory methods correctos', () => {
      const badReq = AppError.badRequest('Monto inválido');
      expect(badReq.statusCode).toBe(400);
      expect(badReq.code).toBe(ErrorCode.VALIDATION_ERROR);

      const unauth = AppError.unauthorized();
      expect(unauth.statusCode).toBe(401);

      const forb = AppError.forbidden();
      expect(forb.statusCode).toBe(403);

      const nf = AppError.notFound();
      expect(nf.statusCode).toBe(404);

      const conf = AppError.conflict('Conflicto detectado');
      expect(conf.statusCode).toBe(409);

      const internal = AppError.internal();
      expect(internal.statusCode).toBe(500);
    });

    it('debe responder estructurado al capturar AppError en handleError', () => {
      const err = AppError.conflict('Error de estado');
      const res = handleError(err, 'req-001') as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(409);
      const body = JSON.parse(res.body as string);
      expect(body.code).toBe(ErrorCode.CONFLICT);
      expect(body.message).toBe('Error de estado');
      expect(body.requestId).toBe('req-001');
    });

    it('debe responder 400 al capturar ZodError en handleError', () => {
      try {
        amountCentsSchema.parse(50);
      } catch (zError) {
        const res = handleError(zError, 'req-002') as APIGatewayProxyStructuredResultV2;
        expect(res.statusCode).toBe(400);
        const body = JSON.parse(res.body as string);
        expect(body.code).toBe(ErrorCode.VALIDATION_ERROR);
        expect(body.requestId).toBe('req-002');
      }
    });

    it('debe enmascarar excepciones genéricas con 500 INTERNAL_ERROR', () => {
      const genericErr = new Error('Database disconnected unexpectedly');
      const res = handleError(genericErr, 'req-003') as APIGatewayProxyStructuredResultV2;

      expect(res.statusCode).toBe(500);
      const body = JSON.parse(res.body as string);
      expect(body.code).toBe(ErrorCode.INTERNAL_ERROR);
      expect(body.message).toBe('Ocurrió un error interno en el servidor.');
      expect(body.requestId).toBe('req-003');
    });
  });

  describe('Response Helpers', () => {
    it('debe generar respuestas HTTP exitosas con cabeceras de seguridad', () => {
      const res = buildSuccessResponse(200, { data: 'ok' }) as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(200);
      expect(res.headers?.['Content-Type']).toBe('application/json');
      expect(res.headers?.['X-Frame-Options']).toBe('DENY');
      expect(JSON.parse(res.body as string)).toEqual({ data: 'ok' });
    });

    it('debe generar respuestas de error estandarizadas', () => {
      const res = buildErrorResponse(404, ErrorCode.NOT_FOUND, 'No existe', 'req-004') as APIGatewayProxyStructuredResultV2;
      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body as string)).toEqual({
        code: 'NOT_FOUND',
        message: 'No existe',
        requestId: 'req-004',
      });
    });
  });

  describe('Pagination Utils', () => {
    it('debe codificar y decodificar correctamente LastEvaluatedKey', () => {
      const key = { projectId: 'prj_01', createdAt: '2026-11-05T00:00:00.000Z' };
      const encoded = encodeNextToken(key);
      expect(typeof encoded).toBe('string');

      const decoded = decodeNextToken(encoded!);
      expect(decoded).toEqual(key);
    });

    it('debe retornar null cuando Key es undefined', () => {
      expect(encodeNextToken(undefined)).toBeNull();
    });

    it('debe retornar undefined al decodificar un token con Base64 o JSON inválido', () => {
      expect(decodeNextToken('token_invalido_$$$')).toBeUndefined();
      expect(decodeNextToken(undefined)).toBeUndefined();
    });
  });

  describe('Common Schemas Zod', () => {
    it('debe validar un UUID válido y rechazar cadenas arbitrarias', () => {
      const validUuid = '550e8400-e29b-41d4-a716-446655440000';
      expect(uuidSchema.parse(validUuid)).toBe(validUuid);
      expect(() => uuidSchema.parse('invalid-uuid-format')).toThrow(ZodError);
    });

    it('debe exigir enteros entre 100 y 100000 céntimos', () => {
      expect(amountCentsSchema.parse(100)).toBe(100);
      expect(amountCentsSchema.parse(100000)).toBe(100000);
      expect(() => amountCentsSchema.parse(99)).toThrow(ZodError);
      expect(() => amountCentsSchema.parse(100001)).toThrow(ZodError);
      expect(() => amountCentsSchema.parse(150.5)).toThrow(ZodError);
    });

    it('debe transformar limit numérico en el esquema de paginación', () => {
      const parsed = paginationQuerySchema.parse({ limit: '15' });
      expect(parsed.limit).toBe(15);
    });
  });

  describe('Logger Sanitization', () => {
    it('debe omitir/redactar campos sensibles en logs', () => {
      const spyLog = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.info('Prueba de log', { password: 'secret_pass', token: 'bearer_xxx', data: 'public' });
      
      expect(spyLog).toHaveBeenCalled();
      const output = JSON.parse(spyLog.mock.calls[0]![0]);
      expect(output.password).toBe('[REDACTED]');
      expect(output.token).toBe('[REDACTED]');
      expect(output.data).toBe('public');
      spyLog.mockRestore();
    });
  });
});