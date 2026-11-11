import type { ReactNode } from "react";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import { markSessionActive } from "./sessionMarker";
import { userManager } from "./userManager";

interface AuthProviderProps {
  children: ReactNode;
}

// Solo un callback de inicio de sesión correcto fija el marcador que permite reanudar la sesión al recargar.
const handleSigninCallback = () => {
  markSessionActive();
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.hash}`
  );
};

export const AuthProvider = ({ children }: AuthProviderProps) => (
  <OidcProvider userManager={userManager} onSigninCallback={handleSigninCallback}>
    {children}
  </OidcProvider>
);
