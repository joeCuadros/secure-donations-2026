import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { extractUserContext, verifyScope } from '../../src/authz/services/authorize.service.js';
import { extractAndVerifyContext } from '../../src/authz/api.js';
import { AppError } from '../../src/shared/errors/app-error.js';
import { authorizeActionService } from '../../src/authz/services/avp.service.js';
import { env } from '../../src/shared/config/env.js';
import { logger } from '../../src/shared/logger/logger.js';

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
    it('CA-04.3: debe extraer el contexto completo desde claims verificados', () => {
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

    it('CA-04.3 / CA-NF02.2: debe extraer grupos y scopes cuando vienen en formato string separado por comas', () => {
      const event = buildMockEvent({
        sub: 'sub_auditor_01',
        'cognito:groups': 'AUDITOR, GESTOR',
        scope: ['api/audit.read'],
      });

      const user = extractUserContext(event);
      expect(user.groups).toEqual(['AUDITOR', 'GESTOR']);
      expect(user.scopes).toEqual(['api/audit.read']);
    });

    it('T03 / CA-04.3: el authorizer JWT de API Gateway entrega los grupos como "[DONANTE]" y no debe enviarse con corchetes', () => {
      const user = extractUserContext(buildMockEvent({ sub: 'sub_01', 'cognito:groups': '[DONANTE]' }));
      expect(user.groups).toEqual(['DONANTE']);
    });

    it('CA-04.3: debe separar por espacios los grupos entre corchetes ("[GESTOR AUDITOR]")', () => {
      const user = extractUserContext(buildMockEvent({ sub: 'sub_01', 'cognito:groups': '[GESTOR AUDITOR]' }));
      expect(user.groups).toEqual(['GESTOR', 'AUDITOR']);
    });

    it('CA-04.3: debe aceptar arreglos reales, descartar vacíos y elementos que no son texto', () => {
      const user = extractUserContext(
        buildMockEvent({ sub: 'sub_01', 'cognito:groups': ['DONANTE', '', '  ', 42, null] })
      );
      expect(user.groups).toEqual(['DONANTE']);
    });

    it.each([['[]'], [''], ['   '], [' , , ']])('CA-04.3: el valor de grupos %j no produce grupos', (raw) => {
      const user = extractUserContext(buildMockEvent({ sub: 'sub_01', 'cognito:groups': raw }));
      expect(user.groups).toEqual([]);
    });

    it('CA-04.3: sin claim de grupos el usuario no tiene grupos', () => {
      const user = extractUserContext(buildMockEvent({ sub: 'sub_01' }));
      expect(user.groups).toEqual([]);
    });

    it('CA-NF02.1: debe interpretar el claim scope como string separado por espacios o entre corchetes', () => {
      const plain = extractUserContext(
        buildMockEvent({ sub: 'sub_01', scope: 'openid  api/donations.write   api/donations.read' })
      );
      expect(plain.scopes).toEqual(['openid', 'api/donations.write', 'api/donations.read']);

      const bracketed = extractUserContext(
        buildMockEvent({ sub: 'sub_01', scope: '[api/donations.write api/donations.read]' })
      );
      expect(bracketed.scopes).toEqual(['api/donations.write', 'api/donations.read']);
    });

    it('HU-11: el contexto no deriva ni expone ningún atributo de MFA a partir de claims', () => {
      const user = extractUserContext(
        buildMockEvent({ sub: 'sub_auditor_01', 'cognito:groups': 'AUDITOR', scope: 'api/audit.read', amr: ['pwd', 'mfa'] })
      );
      expect(user).not.toHaveProperty('isMfaVerified');
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
      };

      expect(() => verifyScope(user, 'api/projects.write')).not.toThrow();
    });

    it('CA-NF02.1: un token sin scopes no debe pasar una ruta que exige scope (falla cerrada)', () => {
      const user = {
        sub: 'sub_01',
        groups: ['GESTOR'],
        scopes: [],
      };

      expect(() => verifyScope(user, 'api/projects.write')).toThrow(AppError);
      try {
        verifyScope(user, 'api/projects.write');
      } catch (error) {
        expect((error as AppError).statusCode).toBe(403);
      }
    });

    it('CA-NF02.1: un evento sin claim scope es rechazado por la fachada con 403', () => {
      const event = buildMockEvent({ sub: 'sub_01', 'cognito:groups': ['GESTOR'] });
      expect(() => extractAndVerifyContext(event, 'api/projects.write')).toThrow(/Scope insuficiente/);
    });

    it('debe lanzar 403 Forbidden si el scope es insuficiente', () => {
      const user = {
        sub: 'sub_01',
        groups: ['GESTOR'],
        scopes: ['api/donations.read'],
      };

      expect(() => verifyScope(user, 'api/projects.write')).toThrow(AppError);
    });
  });

  describe('avp.service.ts (Authorization)', () => {
    const user = {
      sub: 'sub_test',
      groups: ['DONANTE'],
      scopes: [],
    };

    it('debe permitir acceso si AVP devuelve ALLOW', async () => {
      mockSend.mockResolvedValueOnce({ decision: 'ALLOW' });
      await expect(authorizeActionService(user, 'CreateDonation', 'Project', 'prj_1', { status: 'PUBLICADO', am: 123, bl: true })).resolves.not.toThrow();
    });

    it('HU-12: debe enviar a AVP los tipos de entidad, la acción y los atributos del espacio SecureDonations', async () => {
      mockSend.mockResolvedValueOnce({ decision: 'ALLOW' });
      await authorizeActionService(user, 'SimulateDonation', 'Donation', 'don_1', { donorSub: 'sub_test', status: 'PENDIENTE_SIMULACION' });

      const input = mockSend.mock.calls[0]![0].args;
      expect(input.principal).toEqual({ entityType: 'SecureDonations::User', entityId: 'sub_test' });
      expect(input.action).toEqual({ actionType: 'SecureDonations::Action', actionId: 'SimulateDonation' });
      expect(input.resource).toEqual({ entityType: 'SecureDonations::Donation', entityId: 'don_1' });

      const entities = input.entities.entityList as Array<{ identifier: { entityType: string; entityId: string }; attributes?: Record<string, unknown>; parents?: unknown[] }>;
      expect(entities.find((e) => e.identifier.entityType === 'SecureDonations::UserGroup')?.identifier.entityId).toBe('DONANTE');
      expect(entities.find((e) => e.identifier.entityType === 'SecureDonations::Donation')?.attributes).toEqual({
        donorSub: { string: 'sub_test' },
        status: { string: 'PENDIENTE_SIMULACION' },
      });
    });

    it.each(['CreateProject', 'ReadMyDonations', 'ReadAuditLogs'])(
      'HU-12: %s no tiene recurso propio y se evalúa contra el singleton SecureDonations::Application sin atributos',
      async (action) => {
        mockSend.mockResolvedValueOnce({ decision: 'ALLOW' });
        await authorizeActionService(user, action);

        const input = mockSend.mock.calls[0]![0].args;
        expect(input.resource).toEqual({ entityType: 'SecureDonations::Application', entityId: 'secure-donations' });
        const entities = input.entities.entityList as Array<{ identifier: { entityType: string }; attributes?: Record<string, unknown> }>;
        expect(entities.find((e) => e.identifier.entityType === 'SecureDonations::Application')?.attributes).toEqual({});
      }
    );

    it('HU-12: PublishProject autoriza antes de leer el proyecto y no envía atributos de Project', async () => {
      mockSend.mockResolvedValueOnce({ decision: 'ALLOW' });
      await authorizeActionService(user, 'PublishProject', 'Project', 'prj_1');

      const input = mockSend.mock.calls[0]![0].args;
      expect(input.resource).toEqual({ entityType: 'SecureDonations::Project', entityId: 'prj_1' });
      const entities = input.entities.entityList as Array<{ identifier: { entityType: string }; attributes?: Record<string, unknown> }>;
      expect(entities.find((e) => e.identifier.entityType === 'SecureDonations::Project')?.attributes).toEqual({});
    });

    it('HU-11: el principal enviado a AVP solo lleva el atributo sub (sin isMfaVerified)', async () => {
      mockSend.mockResolvedValueOnce({ decision: 'ALLOW' });
      await authorizeActionService(user, 'ReadAuditLogs');

      const entities = mockSend.mock.calls[0]![0].args.entities.entityList as Array<{ identifier: { entityType: string }; attributes?: Record<string, unknown> }>;
      const principal = entities.find((e) => e.identifier.entityType === 'SecureDonations::User');
      expect(principal?.attributes).toEqual({ sub: { string: 'sub_test' } });
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

    it('CA-NF01.2: un fallo del SDK falla cerrado con 500, mensaje genérico y detalle solo en el log del servidor', async () => {
      const errorLog = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
      mockSend.mockRejectedValueOnce(new Error('AccessDeniedException: arn:aws:verifiedpermissions::000000000000:policy-store/xyz'));

      const error = await authorizeActionService(user, 'CreateDonation').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).statusCode).toBe(500);
      expect((error as AppError).message).not.toContain('AccessDeniedException');
      expect((error as AppError).message).not.toContain('arn:aws');
      expect(errorLog).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(errorLog.mock.calls[0])).toContain('AccessDeniedException');
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
