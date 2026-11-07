import { type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts";

export const oidcConfig: UserManagerSettings = {
  authority: `https://${import.meta.env.VITE_COGNITO_DOMAIN}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.VITE_LOGOUT_URI,
  response_type: "code",
  scope: "openid email profile api/projects.write api/donations.write api/donations.read api/audit.read",
  // Se usa sessionStorage para mantener los tokens en memoria de la sesión actual de la pestaña
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
};