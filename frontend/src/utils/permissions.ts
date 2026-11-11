import type { User } from "oidc-client-ts";

type TokenClaims = Record<string, unknown> & {
  scope?: string | string[];
  "cognito:groups"?: string[] | string;
};

const scopeGroups: Record<string, string> = {
  "api/projects.write": "GESTOR",
  "api/donations.read": "DONANTE",
  "api/donations.write": "DONANTE",
  "api/audit.read": "AUDITOR",
};

const readTokenClaims = (accessToken: string): TokenClaims => {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return {};

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
    return JSON.parse(decoded) as TokenClaims;
  } catch {
    return {};
  }
};

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value === "string") return value.split(/[ ,]+/).filter(Boolean);
  return [];
};

export const hasPermission = (
  user: User | null | undefined,
  requiredScope: string
): boolean => {
  if (!user?.access_token || user.expired) return false;

  const claims = readTokenClaims(user.access_token);
  const profile = user.profile as Record<string, unknown>;
  const scopes = [
    ...toStringArray(claims.scope),
    ...toStringArray(user.scope),
  ];
  const groups = [
    ...toStringArray(claims["cognito:groups"]),
    ...toStringArray(profile["cognito:groups"]),
  ];
  const requiredGroup = scopeGroups[requiredScope];

  return (
    scopes.includes(requiredScope) &&
    (!requiredGroup || groups.includes(requiredGroup))
  );
};