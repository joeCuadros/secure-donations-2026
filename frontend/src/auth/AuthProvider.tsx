import type { ReactNode } from "react";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import { UserManager, type User } from "oidc-client-ts";
import { oidcConfig } from "./authConfig";

export const userManager = new UserManager(oidcConfig);

interface AuthProviderProps {
  children: ReactNode;
}

const handleSigninCallback = (_user: User | undefined) => {
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
