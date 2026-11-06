import { z } from 'zod';

export const uuidSchema = z.string().uuid('El parámetro debe ser un UUID válido');

export const isoDateSchema = z.string().datetime({ message: 'Debe ser una fecha ISO 8601 válida' });

export const paginationQuerySchema = z.object({
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  nextToken: z.string().optional(),
});

export const amountCentsSchema = z
  .number({ error: 'amountCents es obligatorio' })
  .int('El monto debe ser un entero')
  .min(100, 'El monto mínimo es 100 céntimos')
  .max(100000, 'El monto máximo es 100000 céntimos');