import { AppError } from '../../shared/errors/app-error.js';

export const verifyResourceOwnership = (
  authenticatedSub: string,
  resourceOwnerSub: string,
  resourceName: string = 'Recurso'
): void => {
  if (authenticatedSub !== resourceOwnerSub) {
    throw AppError.notFound(`${resourceName} no encontrado.`);
  }
};