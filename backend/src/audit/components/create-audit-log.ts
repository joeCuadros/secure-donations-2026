import { auditRepository } from './audit.repository.js';
import type { CreateAuditInput, AuditEventItem } from './audit.types.js';
import { logger } from '../../shared/logger/logger.js';

export const createAuditLog = async (input: CreateAuditInput): Promise<AuditEventItem | null> => {
  try {
    return await auditRepository.createLog(input);
  } catch (error) {
    logger.error('Fallo al registrar evento de auditoría', {
      error: error instanceof Error ? error.message : String(error),
      input,
    });
    return null;
  }
};