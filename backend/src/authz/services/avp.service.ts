import { VerifiedPermissionsClient, IsAuthorizedCommand, type EntityItem } from '@aws-sdk/client-verifiedpermissions';
import { env } from '../../shared/config/env.js';
import { AppError } from '../../shared/errors/app-error.js';
import type { AuthenticatedUser } from '../types.js';

const avpClient = new VerifiedPermissionsClient({ region: env.AWS_REGION });

export const authorizeActionService = async (
  user: AuthenticatedUser,
  actionId: string,
  resourceType?: string,
  resourceId?: string,
  resourceAttributes?: Record<string, string | boolean | number>
): Promise<void> => {
  if (!env.AVP_POLICY_STORE_ID) {
    throw AppError.internal('La configuración de Amazon Verified Permissions no está definida.');
  }

  const entities: EntityItem[] = [];

  const groupEntities = user.groups.map((group) => ({
    identifier: { entityType: 'SecureDonations::UserGroup', entityId: group },
  }));
  entities.push(...groupEntities);

  entities.push({
    identifier: { entityType: 'SecureDonations::User', entityId: user.sub },
    parents: groupEntities.map((g) => g.identifier!),
    attributes: {
      sub: { string: user.sub },
      isMfaVerified: { boolean: user.isMfaVerified },
    },
  });

  let resource;
  if (resourceType && resourceId) {
    resource = { entityType: `SecureDonations::${resourceType}`, entityId: resourceId };
    const attributes: Record<string, any> = {};

    if (resourceAttributes) {
      for (const [key, value] of Object.entries(resourceAttributes)) {
        if (typeof value === 'string') attributes[key] = { string: value };
        else if (typeof value === 'boolean') attributes[key] = { boolean: value };
        else if (typeof value === 'number') attributes[key] = { long: value };
      }
    }
    entities.push({ identifier: resource, attributes });
  }

  const command = new IsAuthorizedCommand({
    policyStoreId: env.AVP_POLICY_STORE_ID,
    principal: { entityType: 'SecureDonations::User', entityId: user.sub },
    action: { actionType: 'SecureDonations::Action', actionId },
    resource,
    entities: { entityList: entities },
  });

  try {
    const response = await avpClient.send(command);
    if (response.decision !== 'ALLOW') {
      throw AppError.forbidden(`Acceso denegado (Zero Trust PE): Operación no permitida.`);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw AppError.internal(`Error en el motor de políticas (AVP): ${String(error)}`);
  }
};