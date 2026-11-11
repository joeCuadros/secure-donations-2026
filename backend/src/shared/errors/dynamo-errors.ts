// Errores de DynamoDB que indican que otra solicitud ganó la carrera sobre el mismo ítem:
// condición no cumplida, transacción cancelada por su condición o transacción en curso.
const CONFLICT_ERROR_NAMES = new Set([
  'ConditionalCheckFailedException',
  'TransactionCanceledException',
  'TransactionConflictException',
]);

export const isConditionalWriteConflict = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'name' in error &&
  typeof error.name === 'string' &&
  CONFLICT_ERROR_NAMES.has(error.name);
