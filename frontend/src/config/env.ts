// Variables de entorno de Vite obligatorias. Si falta alguna se falla de inmediato con un mensaje claro,
// en lugar de construir URLs como `https://undefined/...`.
const read = (value: string | undefined): string => value?.trim() ?? "";

const required = {
  VITE_API_URL: read(import.meta.env.VITE_API_URL),
  VITE_COGNITO_USER_POOL_ID: read(import.meta.env.VITE_COGNITO_USER_POOL_ID),
  VITE_COGNITO_CLIENT_ID: read(import.meta.env.VITE_COGNITO_CLIENT_ID),
  VITE_COGNITO_DOMAIN: read(import.meta.env.VITE_COGNITO_DOMAIN),
};

const missing = Object.entries(required)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  throw new Error(
    `Falta configurar variables de entorno obligatorias: ${missing.join(", ")}. ` +
      "Copia frontend/.env.example a frontend/.env y completa los valores del despliegue."
  );
}

const userPoolId = required.VITE_COGNITO_USER_POOL_ID;
const region = userPoolId.split("_")[0];
if (!region || !userPoolId.includes("_")) {
  throw new Error("VITE_COGNITO_USER_POOL_ID no tiene el formato esperado (por ejemplo, us-east-2_AbCdEfGhI).");
}

export const env = {
  apiUrl: required.VITE_API_URL.replace(/\/+$/, ""),
  userPoolId,
  region,
  clientId: required.VITE_COGNITO_CLIENT_ID,
  // Host de Cognito sin esquema ni barra final.
  cognitoDomain: required.VITE_COGNITO_DOMAIN.replace(/^https?:\/\//, "").replace(/\/+$/, ""),
  redirectUri: read(import.meta.env.VITE_REDIRECT_URI) || `${window.location.origin}/callback`,
  logoutUri: read(import.meta.env.VITE_LOGOUT_URI) || `${window.location.origin}/login`,
  scopes: (
    read(import.meta.env.VITE_COGNITO_SCOPES) ||
    "openid email profile api/projects.write api/donations.write api/donations.read api/audit.read"
  )
    .split(/\s+/)
    .filter(Boolean)
    .join(" "),
};
