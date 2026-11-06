export const encodeNextToken = (lastEvaluatedKey: Record<string, unknown> | undefined): string | null => {
  if (!lastEvaluatedKey) return null;
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
};

export const decodeNextToken = (nextToken: string | undefined): Record<string, unknown> | undefined => {
  if (!nextToken) return undefined;
  try {
    const jsonStr = Buffer.from(nextToken, 'base64').toString('utf-8');
    return JSON.parse(jsonStr) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};