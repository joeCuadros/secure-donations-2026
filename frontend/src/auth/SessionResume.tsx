import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "react-oidc-context";
import { clearSessionMarker, hasSessionMarker } from "./sessionMarker";

// En estas rutas nunca se inicia sesión automáticamente: son la pantalla de acceso y los retornos de Cognito.
const NO_RESUME_PATHS = new Set(["/login", "/callback", "/auth/callback"]);

// Como mucho un intento automático por carga de página, aunque React monte el efecto más de una vez.
let resumeAttempted = false;

/**
 * Continuidad de sesión al recargar (F5). Los tokens viven solo en memoria (CA-NF11.1), así que al recargar la
 * SPA no tiene usuario. Si el marcador indica que en esta pestaña hubo una sesión, se inicia una sola vez
 * `signinRedirect`: mientras la cookie de sesión de Cognito siga vigente, Cognito devuelve el código sin pedir
 * credenciales y la SPA recupera los tokens en memoria con un flujo PKCE normal. Si la cookie venció, Cognito
 * muestra su inicio de sesión habitual.
 *
 * Anti-bucle: el marcador se borra ANTES de redirigir (un intento fallido aterriza en el login normal), se borra
 * ante cualquier error de autenticación y solo se vuelve a fijar tras un callback correcto.
 */
export const SessionResume = () => {
  const auth = useAuth();
  const location = useLocation();
  const { isLoading, activeNavigator, user, error } = auth;
  const { pathname, search, hash } = location;

  useEffect(() => {
    if (error) clearSessionMarker();
  }, [error]);

  useEffect(() => {
    if (resumeAttempted) return;
    if (isLoading || activeNavigator || user || error) return;
    if (NO_RESUME_PATHS.has(pathname) || !hasSessionMarker()) return;

    resumeAttempted = true;
    clearSessionMarker();
    // El callback devuelve al usuario a la ruta que tenía (AuthCallback lee `state.returnTo`).
    void auth.signinRedirect({ state: { returnTo: `${pathname}${search}${hash}` } });
  }, [auth, isLoading, activeNavigator, user, error, pathname, search, hash]);

  return null;
};
