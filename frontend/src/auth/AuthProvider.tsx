import type { ReactNode } from "react";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import { userManager } from "./userManager";

interface AuthProviderProps {
  children: ReactNode;
}

const handleSigninCallback = () => {
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
