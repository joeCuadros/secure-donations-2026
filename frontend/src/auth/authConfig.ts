import { InMemoryWebStorage, type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts";
import { env } from "../config/env";

const cognitoBaseUrl = `https://${env.cognitoDomain}`;

// Cognito no usa los parámetros estándar de end_session: su endpoint /logout recibe client_id y logout_uri.
export const buildCognitoLogoutUrl = (): string =>
  `${cognitoBaseUrl}/logout?client_id=${encodeURIComponent(env.clientId)}&logout_uri=${encodeURIComponent(env.logoutUri)}`;

export const oidcConfig: UserManagerSettings = {
  authority: `https://cognito-idp.${env.region}.amazonaws.com/${env.userPoolId}`,
  client_id: env.clientId,
  redirect_uri: env.redirectUri,
  post_logout_redirect_uri: env.logoutUri,
  response_type: "code",
  scope: env.scopes,
  automaticSilentRenew: true,
  loadUserInfo: true,
  filterProtocolClaims: true,
  revokeTokensOnSignout: true,
  // CA-NF11.1: los tokens viven solo en memoria y se pierden al recargar la página. SessionResume los recupera
  // con un nuevo flujo PKCE mientras la sesión de Cognito siga vigente; no se guarda ningún token.
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  // El estado transitorio de PKCE debe sobrevivir a la redirección hacia Cognito, por eso usa sessionStorage.
  stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  metadata: {
    issuer: `https://cognito-idp.${env.region}.amazonaws.com/${env.userPoolId}`,
    authorization_endpoint: `${cognitoBaseUrl}/oauth2/authorize`,
    token_endpoint: `${cognitoBaseUrl}/oauth2/token`,
    userinfo_endpoint: `${cognitoBaseUrl}/oauth2/userInfo`,
    revocation_endpoint: `${cognitoBaseUrl}/oauth2/revoke`,
    end_session_endpoint: `${cognitoBaseUrl}/logout`,
  },
};
