import { z } from 'zod';
import { amountCentsSchema, uuidSchema, paginationQuerySchema } from '../../shared/schemas/common.schema.js';

export const createDonationSchema = z.object({
  projectId: z.string().min(1, 'projectId es obligatorio'),
  amountCents: amountCentsSchema,
});

export const idempotencyHeaderSchema = z.object({
  'idempotency-key': uuidSchema,
});

export const simulateDonationSchema = z.object({
  result: z.enum(['CONFIRMADA_SIMULADA', 'RECHAZADA_SIMULADA'], {
    required_error: 'El campo result es obligatorio',
  }),
});

export const donationPathParamsSchema = z.object({
  donationId: z.string().min(1, 'donationId es obligatorio'),
});

export const listDonationsQuerySchema = paginationQuerySchema;

export type CreateDonationDTO = z.infer<typeof createDonationSchema>;
export type SimulateDonationDTO = z.infer<typeof simulateDonationSchema>;

export const validateCreateDonation = (data: unknown): CreateDonationDTO => {
  return createDonationSchema.parse(data);
};

export const validateIdempotencyKeyHeader = (headers: Record<string, string | undefined>): string => {
  const normalizedHeaders: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(headers)) {
    normalizedHeaders[k.toLowerCase()] = v;
  }
  const result = idempotencyHeaderSchema.parse(normalizedHeaders);
  return result['idempotency-key'];
};

export const validateSimulateDonation = (data: unknown): SimulateDonationDTO => {
  return simulateDonationSchema.parse(data);
};

export const validateDonationIdParam = (params: Record<string, string | undefined> | null): string => {
  if (!params || !params['donationId']) {
    throw new Error('Parámetro donationId faltante en la ruta');
  }
  return donationPathParamsSchema.parse(params).donationId;
};