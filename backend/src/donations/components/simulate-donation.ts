import { donationRepository } from './donation.repository.js';
import type { SimulateDonationInput, DonationStatus } from './donation.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { env } from '../../shared/config/env.js';

export const simulateDonation = async (
  input: SimulateDonationInput,
  authenticatedSub: string
): Promise<{ donationId: string; status: DonationStatus; updatedAt: string }> => {
  // Restricción de entorno: solo en stage 'academic'
  if (env.STAGE !== 'academic') {
    throw AppError.forbidden('El endpoint de simulación solo está disponible en el entorno académico.');
  }

  // 1. Obtener la donación
  const donation = await donationRepository.getById(input.donationId);

  if (!donation) {
    throw AppError.notFound('Donación no encontrada.');
  }

  // 2. Verificar propiedad BOLA
  if (donation.donorSub !== authenticatedSub) {
    throw AppError.notFound('Donación no encontrada.');
  }

  // 3. Validar estado inicial
  if (donation.status !== 'PENDIENTE_SIMULACION') {
    throw AppError.conflict(
      `La donación ya se encuentra en un estado terminal (${donation.status}) y no puede ser simulada nuevamente.`
    );
  }

  const nowIso = new Date().toISOString();

  try {
    await donationRepository.executeSimulationTransaction(donation, input.result, nowIso);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'TransactionCanceledException'
    ) {
      throw AppError.conflict('Transición de estado no permitida o conflicto de concurrencia.');
    }
    throw error;
  }

  return {
    donationId: donation.donationId,
    status: input.result,
    updatedAt: nowIso,
  };
};