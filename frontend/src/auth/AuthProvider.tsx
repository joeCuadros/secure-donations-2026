import React, { type ReactNode } from "react";
import { AuthProvider as OidcProvider } from "react-oidc-context";
import { UserManager } from "oidc-client-ts";
import { oidcConfig } from "./authConfig";

// Exportamos la instancia para poder inyectar el token en peticiones (fuera del árbol de React)
export const userManager = new UserManager(oidcConfig);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  return (
    <OidcProvider userManager={userManager}>
      {children}
    </OidcProvider>
  );
};