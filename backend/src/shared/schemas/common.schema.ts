import { z } from 'zod';

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const uuidSchema = z.string().uuid('El parámetro debe ser un UUID válido');

// Fecha-hora ISO 8601 (con 'Z' o desplazamiento). Se normaliza a UTC con milisegundos para que
// la comparación lexicográfica con las claves `timestamp#eventId` sea correcta.
export const isoDateSchema = z
  .string()
  .datetime({ offset: true, message: 'Debe ser una fecha-hora ISO 8601 válida' })
  .transform((value) => new Date(value).toISOString());

const limitMessage = `limit debe ser un entero entre 1 y ${MAX_PAGE_SIZE}`;

export const limitSchema = z
  .string()
  .regex(/^\d+$/, limitMessage)
  .transform(Number)
  .pipe(z.number().int(limitMessage).min(1, limitMessage).max(MAX_PAGE_SIZE, limitMessage));

export const paginationQuerySchema = z.object({
  limit: limitSchema.optional(),
  nextToken: z.string().min(1).max(2048).optional(),
});

export const amountCentsSchema = z
  .number({ error: 'amountCents es obligatorio' })
  .int('El monto debe ser un entero')
  .min(100, 'El monto mínimo es 100 céntimos')
  .max(100000, 'El monto máximo es 100000 céntimos');
