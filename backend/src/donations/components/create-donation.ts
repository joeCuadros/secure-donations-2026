import { donationRepository } from './donation.repository.js';
import { projectRepository } from '../../projects/components/project.repository.js';
import type { CreateDonationInput, DonationItem, DonationResponseDTO } from './donation.types.js';
import { AppError } from '../../shared/errors/app-error.js';
import { randomUUID } from 'node:crypto';

export const createDonation = async (
  input: CreateDonationInput,
  donorSub: string
): Promise<{ statusCode: number; data: DonationResponseDTO }> => {
  // 1. Verificar idempotencia
  const pk = `${donorSub}#createDonation#${input.idempotencyKey}`;
  const payloadHash = donationRepository.computePayloadHash({
    projectId: input.projectId,
    amountCents: input.amountCents,
  });

  const existingRecord = await donationRepository.getIdempotencyRecord(pk);

  if (existingRecord) {
    if (existingRecord.payloadHash === payloadHash) {
      // Reutilización idéntica -> Respuesta original
      const body = JSON.parse(existingRecord.responseBody) as DonationResponseDTO;
      return { statusCode: existingRecord.responseStatus, data: body };
    } else {
      // Misma clave, distinto payload -> Conflicto 409
      throw AppError.conflict(
        'La clave de idempotencia fue utilizada previamente con un payload diferente.'
      );
    }
  }

  // 2. Verificar existencia y publicación del proyecto
  const project = await projectRepository.getById(input.projectId);
  if (!project) {
    throw AppError.notFound('El proyecto especificado no existe.');
  }
  if (project.status !== 'PUBLICADO') {
    throw AppError.conflict('No se pueden realizar donaciones a proyectos no publicados.');
  }

  // 3. Crear donación
  const now = new Date().toISOString();
  const donationId = `don_${randomUUID().replace(/-/g, '').substring(0, 12)}`;

  const donationItem: DonationItem = {
    donationId,
    projectId: input.projectId,
    donorSub,
    amountCents: input.amountCents,
    currency: 'PEN',
    status: 'PENDIENTE_SIMULACION',
    createdAt: now,
    updatedAt: now,
  };

  const responseDTO: DonationResponseDTO = {
    donationId: donationItem.donationId,
    projectId: donationItem.projectId,
    amountCents: donationItem.amountCents,
    currency: donationItem.currency,
    status: donationItem.status,
    createdAt: donationItem.createdAt,
  };

  try {
    await donationRepository.createDonationWithIdempotency(
      donationItem,
      input.idempotencyKey,
      payloadHash,
      responseDTO
    );
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'TransactionCanceledException'
    ) {
      throw AppError.conflict('Conflicto al procesar la clave de idempotencia o registro duplicado.');
    }
    throw error;
  }

  return { statusCode: 201, data: responseDTO };
};