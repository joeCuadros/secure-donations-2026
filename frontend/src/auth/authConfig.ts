import { type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts";

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID?.trim();
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID?.trim();
const region = userPoolId?.split("_")[0];

if (!userPoolId || !region || !clientId) {
  throw new Error(
    "Falta configurar VITE_COGNITO_USER_POOL_ID o VITE_COGNITO_CLIENT_ID en el archivo .env."
  );
}

const requestedScopes = (
  import.meta.env.VITE_COGNITO_SCOPES ||
  "openid email profile api/projects.write api/donations.write api/donations.read api/audit.read"
)
  .trim()
  .split(/\s+/)
  .filter(Boolean)
  .join(" ");

export const oidcConfig: UserManagerSettings = {
  authority: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  client_id: clientId,
  redirect_uri: import.meta.env.VITE_REDIRECT_URI?.trim() || `${window.location.origin}/callback`,
  post_logout_redirect_uri:
    import.meta.env.VITE_LOGOUT_URI?.trim() || `${window.location.origin}/login`,
  response_type: "code",
  scope: requestedScopes,
  automaticSilentRenew: true,
  loadUserInfo: true,
  filterProtocolClaims: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
};
