export const encodeNextToken = (key: Record<string, unknown> | undefined): string | null => {
  if (!key) return null;
  return Buffer.from(JSON.stringify(key)).toString('base64');
};

export const decodeNextToken = (token: string | undefined): Record<string, unknown> | undefined => {
  if (!token) return undefined;
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
  } catch {
    return undefined;
  }
};