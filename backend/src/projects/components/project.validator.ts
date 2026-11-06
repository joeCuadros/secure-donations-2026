import { z } from 'zod';
import { paginationQuerySchema } from '../../shared/schemas/common.schema.js';

export const createProjectSchema = z.object({
  title: z.string().min(3, 'El título debe tener al menos 3 caracteres').max(150, 'Título demasiado largo'),
  description: z.string().min(10, 'La descripción debe tener al menos 10 caracteres'),
  purpose: z.string().min(5, 'El propósito debe tener al menos 5 caracteres'),
  goalAmountCents: z
    .number({ error: 'goalAmountCents es obligatorio' })
    .int('Debe ser entero céntimos')
    .positive('El monto objetivo debe ser mayor a cero'),
});

export const projectPathParamsSchema = z.object({
  projectId: z.string().min(1, 'projectId es obligatorio'),
});

export const listProjectsQuerySchema = paginationQuerySchema;

export type CreateProjectDTO = z.infer<typeof createProjectSchema>;

export const validateCreateProject = (data: unknown): CreateProjectDTO => {
  return createProjectSchema.parse(data);
};

export const validateProjectIdParam = (params: Record<string, string | undefined> | null): string => {
  if (!params || !params['projectId']) {
    throw new Error('Parámetro projectId faltante en la ruta');
  }
  return projectPathParamsSchema.parse(params).projectId;
};