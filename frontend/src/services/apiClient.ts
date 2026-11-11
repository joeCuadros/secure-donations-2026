import { userManager } from "../auth/userManager";
import { env } from "../config/env";

interface ApiClientOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

const getAccessToken = async (): Promise<string | undefined> => {
  let user = await userManager.getUser();

  if (user?.expired) {
    try {
      user = await userManager.signinSilent();
    } catch {
      return undefined;
    }
  }

  return user && !user.expired ? user.access_token : undefined;
};

const getErrorMessage = (body: unknown, status: number): string => {
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string"
  ) {
    return body.message;
  }

  if (typeof body === "string" && body.trim()) return body;
  return `Error HTTP ${status}`;
};

export const apiClient = async <T>(
  endpoint: string,
  options: ApiClientOptions = {}
): Promise<T> => {
  const { params, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);
  let token = await getAccessToken();

  headers.set("Accept", "application/json");
  if (fetchOptions.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const url = new URL(`${env.apiUrl}${endpoint}`);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  let response = await fetch(url, { ...fetchOptions, headers });

  // Si detecta 403 Forbidden, el permiso del grupo podría estar obsoleto en el JWT actual
  // Intenta una renovación forzada y reintenta la solicitud una vez.
  if (response.status === 403) {
    try {
      const freshUser = await userManager.signinSilent();
      if (freshUser?.access_token) {
        token = freshUser.access_token;
        headers.set("Authorization", `Bearer ${token}`);
        response = await fetch(url, { ...fetchOptions, headers });
      }
    } catch {
      // Retiene el error de red o de renovación silenciosa y procede a lanzar la excepción base
    }
  }

  if (response.status === 204) return undefined as T;

  const responseText = await response.text();
  let responseBody: unknown = null;

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      responseBody = responseText;
    }
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(responseBody, response.status));
  }

  return responseBody as T;
};