import { type UserManagerSettings, WebStorageStateStore } from "oidc-client-ts";

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || "";
const region = userPoolId.split("_")[0];

export const oidcConfig: UserManagerSettings = {
  authority: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
  client_id: import.meta.env.VITE_COGNITO_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_REDIRECT_URI,
  post_logout_redirect_uri: import.meta.env.VITE_LOGOUT_URI,
  response_type: "code",
  scope: "openid email profile api/projects.write api/donations.write api/donations.read api/audit.read",
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
};