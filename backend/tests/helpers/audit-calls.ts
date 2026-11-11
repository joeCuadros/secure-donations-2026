import { expect, vi } from 'vitest';
import { docClient } from '../../src/shared/aws/dynamodb.client.js';
import { env } from '../../src/shared/config/env.js';

type SentCommand = { constructor: { name: string }; input: { TableName?: string } };

/**
 * Un rechazo posterior a la autenticación solo puede dejar un evento de auditoría (CA-08.3, CA-10.2):
 * ninguna escritura ni lectura sobre las tablas de negocio. Requiere que `docClient` esté mockeado.
 */
export const expectOnlyAuditWrites = (expectedEvents = 1): void => {
  const sent = vi.mocked(docClient.send).mock.calls.map(([command]) => command as unknown as SentCommand);
  expect(sent.filter((c) => c.constructor.name !== 'PutCommand' || c.input.TableName !== env.AUDIT_TABLE)).toEqual([]);
  expect(sent).toHaveLength(expectedEvents);
};
