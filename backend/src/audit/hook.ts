import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { authzHook } from '../authz/hook.js';
import { validateQueryAudit, listAuditLogs } from './components/index.js';
import type { AuditEventItem } from './components/audit.types.js';

export class AuditHook {
  public async handleListAuditLogs(
    event: APIGatewayProxyEventV2
  ): Promise<{ items: AuditEventItem[]; nextToken: string | null }> {
    // 1. Autorización Zero Trust: Exige AUDITOR y api/audit.read
    authzHook.requireRoleAndScope(event, 'AUDITOR', 'api/audit.read');

    // 2. Validar parámetros de consulta
    const queryParams = event.queryStringParameters || {};
    const validatedQuery = validateQueryAudit(queryParams);

    // 3. Ejecutar consulta
    return await listAuditLogs(validatedQuery);
  }
}

export const auditHook = new AuditHook();