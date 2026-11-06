import { AppError } from '../../shared/errors/app-error.js';
import { logger } from '../../shared/logger/logger.js';

export const verifyResourceOwnership = (
  authenticatedSub: string,
  resourceOwnerSub: string,
  resourceName: string = 'Recurso'
): void => {
  if (authenticatedSub !== resourceOwnerSub) {
    logger.warn('Intento de acceso no autorizado a recurso ajeno (BOLA)', {
      authenticatedSub,
      resourceOwnerSub,
      resourceName,
    });
    throw AppError.notFound(`${resourceName} no encontrado.`);
  }
};