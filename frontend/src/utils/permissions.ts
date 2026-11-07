import { User } from "oidc-client-ts";

export const hasPermission = (user: User | null | undefined, requiredScope: string): boolean => {
  if (!user?.access_token) return false;
  
  // oidc-client-ts almacena los scopes concedidos en la propiedad 'scope' como string separado por espacios
  const scopes = user.scope?.split(" ") || [];
  return scopes.includes(requiredScope);
};