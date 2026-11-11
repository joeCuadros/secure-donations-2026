// Marcador de sesión: una bandera booleana en sessionStorage que solo indica «en esta pestaña hubo una sesión».
// Nunca contiene tokens, identificadores, correos ni claims, y no concede acceso por sí misma: sirve únicamente
// para que SessionResume vuelva a iniciar el flujo Authorization Code + PKCE tras recargar la página.
//
// CA-NF11.1 no se debilita: los tokens siguen solo en memoria (ver authConfig.ts). Lo que permite volver sin pedir
// credenciales es la cookie de sesión del dominio alojado de Cognito, que el navegador envía a Cognito y que el
// JavaScript de la SPA no puede leer. Un XSS que fije o borre esta bandera solo provoca (o evita) una redirección
// al inicio de sesión de Cognito: no obtiene ningún secreto.
const SESSION_MARKER_KEY = "sd:session-active";

export const markSessionActive = (): void => {
  try {
    window.sessionStorage.setItem(SESSION_MARKER_KEY, "true");
  } catch {
    // Sin sessionStorage (modo privado o bloqueado): se pierde solo la continuidad al recargar.
  }
};

export const clearSessionMarker = (): void => {
  try {
    window.sessionStorage.removeItem(SESSION_MARKER_KEY);
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible.
  }
};

export const hasSessionMarker = (): boolean => {
  try {
    return window.sessionStorage.getItem(SESSION_MARKER_KEY) === "true";
  } catch {
    return false;
  }
};
