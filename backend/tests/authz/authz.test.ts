import { describe, it, expect } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { extractUserContext, verifyRoleAndScope } from '../../src/authz/services/authorize.service.js';
import { verifyResourceOwnership } from '../../src/authz/services/ownership.service.js';
import { authorizeUser, assertOwnership } from '../../src/authz/api.js';
import { AppError } from '../../src/shared/errors/app-error.js';

describe('Dominio Authz - Comprehensive Test Suite', () => {
  const buildMockEvent = (claims: Record<string, unknown>): APIGatewayProxyEventV2 =>
    ({
      version: '2.0',
      routeKey: 'POST /v1/test',
      rawPath: '/v1/test',
      rawQueryString: '',
      headers: {},
      isBase64Encoded: false,
      requestContext: {
        accountId: '123456789012',
        apiId: 'api-id',
        domainName: 'id.execute-api.us-east-1.amazonaws.com',
        domainPrefix: 'id',
        http: {
          method: 'POST',
          path: '/v1/test',
          protocol: 'HTTP/1.1',
          sourceIp: '127.0.0.1',
          userAgent: 'CustomUserAgent',
        },
        requestId: 'req_authz_1',
        routeKey: 'POST /v1/test',
        stage: 'academic',
        time: '05/Nov/2026:10:00:00 +0000',
        timeEpoch: 1793872800000,
        authorizer: {
          jwt: {
            claims,
            scopes: [],
          },
        },
      },
    }) as unknown as APIGatewayProxyEventV2;

  describe('authorize.service.ts', () => {
    it('debe extraer el contexto completo con grupos como arreglos', () => {
      const event = buildMockEvent({
        sub: 'sub_gestor_01',
        email: 'gestor@unsa.edu.pe',
        'cognito:groups': ['GESTOR', 'DONANTE'],
        scope: 'api/projects.write api/donations.read',
        username: 'user_gestor',
      });

      const user = extractUserContext(event);
      expect(user.sub).toBe('sub_gestor_01');
      expect(user.email).toBe('gestor@unsa.edu.pe');
      expect(user.groups).toEqual(['GESTOR', 'DONANTE']);
      expect(user.scopes).toEqual(['api/projects.write', 'api/donations.read']);
      expect(user.username).toBe('user_gestor');
    });

    it('debe extraer grupos cuando vienen en formato string separado por comas', () => {
      const event = buildMockEvent({
        sub: 'sub_auditor_01',
        'cognito:groups': 'AUDITOR, GESTOR',
        scope: 'api/audit.read',
      });

      const user = extractUserContext(event);
      expect(user.groups).toEqual(['AUDITOR', 'GESTOR']);
    });

    it('debe lanzar 401 si no hay claims o falta el claim sub', () => {
      expect(() => extractUserContext({ requestContext: {} } as unknown as APIGatewayProxyEventV2)).toThrow(AppError);
      expect(() => extractUserContext(buildMockEvent({ email: 'no_sub@unsa.edu.pe' }))).toThrow(AppError);
    });

    it('debe validar exitosamente rol y scope', () => {
      const user = {
        sub: 'sub_01',
        groups: ['GESTOR'],
        scopes: ['api/projects.write'],
      };

      expect(() => verifyRoleAndScope(user, 'GESTOR', 'api/projects.write')).not.toThrow();
    });

    it('debe lanzar 403 Forbidden si falta el grupo requerido', () => {
      const user = {
        sub: 'sub_01',
        groups: ['DONANTE'],
        scopes: ['api/projects.write'],
      };

      expect(() => verifyRoleAndScope(user, 'GESTOR', 'api/projects.write')).toThrow(AppError);
    });

    it('debe lanzar 403 Forbidden si el scope es insuficiente', () => {
      const user = {
        sub: 'sub_01',
        groups: ['GESTOR'],
        scopes: ['api/donations.read'],
      };

      expect(() => verifyRoleAndScope(user, 'GESTOR', 'api/projects.write')).toThrow(AppError);
    });
  });

  describe('ownership.service.ts (BOLA Guard)', () => {
    it('debe permitir acceso si el sub autenticado es el propietario del recurso', () => {
      expect(() => verifyResourceOwnership('sub_donor_123', 'sub_donor_123')).not.toThrow();
    });

    it('debe lanzar 404 (para prevenir enumeration) si el sub autenticado difiere del dueño', () => {
      expect(() => verifyResourceOwnership('sub_donor_123', 'sub_donor_999', 'Donación')).toThrow(AppError);
    });
  });

  describe('api.ts (Fachada Authz)', () => {
    it('debe autorizar usuario y verificar pertenencia vía fachada api.ts', () => {
      const event = buildMockEvent({
        sub: 'sub_user_01',
        'cognito:groups': ['DONANTE'],
        scope: 'api/donations.write',
      });

      const user = authorizeUser(event, 'DONANTE', 'api/donations.write');
      expect(user.sub).toBe('sub_user_01');

      expect(() => assertOwnership(user.sub, 'sub_user_01')).not.toThrow();
      expect(() => assertOwnership(user.sub, 'other_sub')).toThrow(AppError);
    });
  });
});