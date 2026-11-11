import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { extractUserContext, verifyScope } from '../../src/authz/services/authorize.service.js';
import { extractAndVerifyContext } from '../../src/authz/api.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import { authorizeActionService } from '../../src/authz/services/avp.service.js';
import { env } from '../../src/shared/config/env.js';

// 1. Elevamos la declaración del mock para que exista ANTES de que se resuelvan los imports
const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

// 2. Simulamos el SDK exportando clases reales, ya que el código original usa 'new'
vi.mock('@aws-sdk/client-verifiedpermissions', () => {
  return {
    VerifiedPermissionsClient: class {
      send = mockSend;
    },
    IsAuthorizedCommand: class {
      constructor(public args: any) {}
    },
  };
});

describe('Dominio Authz - Contexto, Scopes y AVP', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockReset();
    
    // Configuramos explícitamente la variable de entorno para que las aserciones
    // de autorización no se caigan por validaciones tempranas
    env.AVP_POLICY_STORE_ID = 'mocked-store-id';
  });

  const buildMockEvent = (claims: Record<string, unknown>): APIGatewayProxyEventV2 =>
    ({
      version: '2.0',
      routeKey: 'POST /v1/test',
      rawPath: '/v1/test',
      rawQueryString: '',
      headers: {},
      isBase64Encoded: false,
      requestContext: {
        authorizer: {
          jwt: {
            claims,
            scopes: [],
          },
        },
      },
    }) as unknown as APIGatewayProxyEventV2;

  describe('authorize.service.ts', () => {
    it('debe extraer el contexto completo identificando MFA verificado', () => {
      const event = buildMockEvent({
        sub: 'sub_gestor_01',
        email: 'gestor@unsa.edu.pe',
        'cognito:groups': ['GESTOR', 'DONANTE'],
        scope: 'api/projects.write api/donations.read',
        username: 'user_gestor',
        amr: ['pwd', 'mfa'],
      });

      const user = extractUserContext(event);
      expect(user.sub).toBe('sub_gestor_01');
      expect(user.email).toBe('gestor@unsa.edu.pe');
      expect(user.groups).toEqual(['GESTOR', 'DONANTE']);
      expect(user.scopes).toEqual(['api/projects.write', 'api/donations.read']);
      expect(user.username).toBe('user_gestor');
      expect(user.isMfaVerified).toBe(true);
    });

    it('debe extraer grupos y scopes cuando vienen en formato string separado por comas', () => {
      const event = buildMockEvent({
        sub: 'sub_auditor_01',
        'cognito:groups': 'AUDITOR, GESTOR',
        scope: ['api/audit.read'],
      });

      const user = extractUserContext(event);
      expect(user.groups).toEqual(['AUDITOR', 'GESTOR']);
      expect(user.scopes).toEqual(['api/audit.read']);
    });

    it('debe marcar isMfaVerified como false si el amr no contiene mfa', () => {
      const event = buildMockEvent({
        sub: 'sub_auditor_01',
        'cognito:groups': 'AUDITOR',
        scope: 'api/audit.read',
        amr: ['pwd'],
      });

      const user = extractUserContext(event);
      expect(user.isMfaVerified).toBe(false);
    });

    it('debe lanzar 401 si no hay claims o falta el claim sub', () => {
      expect(() => extractUserContext({ requestContext: {} } as unknown as APIGatewayProxyEventV2)).toThrow(AppError);
      expect(() => extractUserContext(buildMockEvent({ email: 'no_sub@unsa.edu.pe' }))).toThrow(AppError);
    });

    it('debe lanzar 401 si el sub no es string o esta vacio', () => {
      expect(() => extractUserContext(buildMockEvent({ sub: '' }))).toThrow(AppError);
      expect(() => extractUserContext(buildMockEvent({ sub: 123 }))).toThrow(AppError);
    });

    it('debe validar exitosamente el scope', () => {
      const user = {
        sub: 'sub_01',
        groups: ['GESTOR'],
        scopes: ['api/projects.write'],
        isMfaVerified: false,
      };

      expect(() => verifyScope(user, 'api/projects.write')).not.toThrow();
    });

    it('debe validar scope si el usuario no tiene scopes requeridos (scopes vacios)', () => {
      const user = {
        sub: 'sub_01',
        groups: ['GESTOR'],
        scopes: [],
        isMfaVerified: false,
      };

      expect(() => verifyScope(user, 'api/projects.write')).not.toThrow();
    });

    it('debe lanzar 403 Forbidden si el scope es insuficiente', () => {
      const user = {
        sub: 'sub_01',
        groups: ['GESTOR'],
        scopes: ['api/donations.read'],
        isMfaVerified: false,
      };

      expect(() => verifyScope(user, 'api/projects.write')).toThrow(AppError);
    });
  });

  describe('avp.service.ts (Authorization)', () => {
    const user = {
      sub: 'sub_test',
      groups: ['DONANTE'],
      scopes: [],
      isMfaVerified: true
    };

    it('debe permitir acceso si AVP devuelve ALLOW', async () => {
      mockSend.mockResolvedValueOnce({ decision: 'ALLOW' });
      await expect(authorizeActionService(user, 'CreateDonation', 'Project', 'prj_1', { status: 'PUBLICADO', am: 123, bl: true })).resolves.not.toThrow();
    });

    it('debe rechazar acceso si AVP devuelve DENY', async () => {
      mockSend.mockResolvedValueOnce({ decision: 'DENY' });
      await expect(authorizeActionService(user, 'CreateDonation')).rejects.toThrow(AppError);
    });

    it('debe lanzar internal error si la configuracion AVP_POLICY_STORE_ID no existe', async () => {
      const originalStoreId = env.AVP_POLICY_STORE_ID;
      env.AVP_POLICY_STORE_ID = undefined as any;
      await expect(authorizeActionService(user, 'CreateDonation')).rejects.toThrow(AppError);
      env.AVP_POLICY_STORE_ID = originalStoreId;
    });

    it('debe lanzar internal error si el cliente AVP falla', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network Error'));
      await expect(authorizeActionService(user, 'CreateDonation')).rejects.toThrow(AppError);
    });
  });

  describe('api.ts (Fachada Authz)', () => {
    it('debe extraer y verificar contexto vía fachada', () => {
      const event = buildMockEvent({
        sub: 'sub_user_01',
        'cognito:groups': ['DONANTE'],
        scope: 'api/donations.write',
      });

      const user = extractAndVerifyContext(event, 'api/donations.write');
      expect(user.sub).toBe('sub_user_01');
    });
  });
});