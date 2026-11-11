import { buildCognitoLogoutUrl } from "./authConfig";
import { clearSessionMarker } from "./sessionMarker";
import { userManager } from "./userManager";

// CA-03.3: primero se revocan los tokens (necesitan el usuario en memoria), luego se limpia la sesión local
// y por último se cierra la sesión del dominio de Cognito. Si la revocación falla, el cierre local continúa.
export const logout = async (): Promise<void> => {
  // Un cierre de sesión explícito nunca debe reanudarse al recargar.
  clearSessionMarker();

  try {
    await userManager.revokeTokens(["access_token", "refresh_token"]);
  } catch {
    // La sesión local y la de Cognito se cierran de todos modos.
  }

  await userManager.removeUser();
  window.location.assign(buildCognitoLogoutUrl());
};
