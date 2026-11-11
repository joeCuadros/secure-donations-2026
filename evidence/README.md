# Evidencias

Esta carpeta guarda las evidencias sanitizadas de las pruebas T01–T14 (requirements.md §6) y de los controles de
seguridad. Cada archivo indica la fecha, el entorno y qué se observó realmente.

## Contenido

| Archivo | Descripción |
|---|---|
| [2026-11-11-smoke.md](2026-11-11-smoke.md) | Verificación sin credenciales contra el despliegue: tabla T01–T14 con trazabilidad y estado, pruebas unitarias relacionadas y observaciones sin procesar |
| [2026-11-11-acceptance.md](2026-11-11-acceptance.md) | Pruebas de aceptación con usuarios reales: T01–T09, T11, T12 y T13 superadas, T10 con evidencia estática y T14 pendiente. Sustituye los estados «pendiente» de la verificación sin credenciales |

Los eventos de auditoría (`AuditEvents`) registran también las operaciones rechazadas tras la autenticación (`DENIED`,
`FAILURE`, `ERROR`). Ninguna de las evidencias anteriores incluye todavía una consulta de `GET /v1/audit` con esos
eventos reales: esa comprobación en el despliegue está pendiente.

## Estados

- **Verificado en despliegue**: observado contra la pila real.
- **Verificado solo en pruebas unitarias**: cubierto por Vitest con DynamoDB y Verified Permissions simulados.
- **Pendiente**: no ejecutado. No debe presentarse como superado en el informe ni en la defensa.

## Cómo agregar evidencia

1. Ejecute la prueba (`bash scripts/acceptance.sh` o el procedimiento manual indicado por el script).
2. Guarde el resultado en un archivo con fecha: `evidence/AAAA-MM-DD-<tema>.md` (o `.txt` para salidas de consola).
3. Indique siempre fecha y zona horaria, entorno (stage y región), el comando o procedimiento y el resultado observado.
4. Actualice el estado en la tabla de [2026-11-11-smoke.md](2026-11-11-smoke.md) o cree una tabla nueva con la fecha.

## Reglas de sanitización

Antes de guardar o publicar cualquier evidencia, elimine o reemplace:

- Tokens (access, ID y refresh), cabeceras `Authorization` y cualquier JWT, aunque haya expirado.
- Contraseñas, códigos TOTP y claves de idempotencia reales.
- El identificador de cuenta de AWS (use `<account-id>`) y los dominios que lo contienen, como el dominio alojado de
  Cognito (use `<cognito-hosted-domain>`).
- Correos y `sub` de usuarios reales; use usuarios de prueba y nómbrelos por rol (DONANTE, GESTOR, AUDITOR).
- Capturas con barras del navegador, perfiles o notificaciones personales.

Las URL públicas del despliegue (frontend y API) pueden mostrarse. Revise el archivo completo antes de confirmarlo en
Git (design.md §10: no se comparten credenciales, tokens ni contenido de `.env`).
