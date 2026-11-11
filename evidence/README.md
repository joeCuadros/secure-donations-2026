# Evidencias

Esta carpeta guarda las evidencias sanitizadas de las pruebas T01–T14 (requirements.md §6) y de los controles de
seguridad. Cada archivo indica la fecha, el entorno y qué se observó realmente.

## Contenido

| Archivo | Descripción |
|---|---|
| [2026-11-11-smoke.md](2026-11-11-smoke.md) | Primera verificación, sin credenciales, contra el despliegue: tabla T01–T14 con trazabilidad y estado, pruebas unitarias relacionadas y observaciones sin procesar. Es un registro fechado: sus estados «pendiente» fueron superados después (ver la nota inicial de ese archivo) |
| [2026-11-11-acceptance.md](2026-11-11-acceptance.md) | Pruebas de aceptación con usuarios reales (tres corridas de `scripts/acceptance.sh`, la tercera con T03b): T01–T09, T11, T12 y T03b superadas (T11 con la desviación del 403 para el ID token), T13 superada con su línea de tiempo en UTC, T10 con evidencia estática y T14 pendiente. Incluye los rechazos registrados en `AuditEvents` y la gestión de borradores. Es la evidencia vigente: sustituye los estados «pendiente» de la verificación sin credenciales |

Los eventos de auditoría (`AuditEvents`) registran también las operaciones rechazadas tras la autenticación (`DENIED`,
`FAILURE`, `ERROR`). Esos eventos se observaron en el despliegue con una consulta directa al índice
`AllAuditLogsIndex` (extracto en `2026-11-11-acceptance.md`). Ninguna evidencia incluye una consulta de `GET /v1/audit`
hecha por un usuario AUDITOR a través de la API: ninguna ejecución usó un usuario AUDITOR, y esa comprobación está
pendiente. Tampoco hay todavía capturas de pantalla.

Pendientes de evidencia: la captura manual de T14, la demostración dinámica de T10 (el IAM Policy Simulator no es
utilizable en esta cuenta: la SCP de la organización hace que devuelva `explicitDeny` para cualquier acción), las
capturas de CloudWatch con un caso exitoso y uno rechazado (CA-NF07.2) y las mediciones de rendimiento y accesibilidad.

## Estados

- **Verificado en despliegue**: observado contra la pila real.
- **Verificado solo en pruebas unitarias**: cubierto por Vitest con DynamoDB y Verified Permissions simulados.
- **Pendiente**: no ejecutado. No debe presentarse como superado en el informe ni en la defensa.

## Cómo agregar evidencia

1. Ejecute la prueba (`bash scripts/acceptance.sh` o el procedimiento manual indicado por el script).
2. Guarde el resultado en un archivo con fecha: `evidence/AAAA-MM-DD-<tema>.md` (o `.txt` para salidas de consola).
3. Indique siempre fecha y zona horaria, entorno (stage y región), el comando o procedimiento y el resultado observado.
4. No reescriba los registros fechados anteriores: cree una tabla nueva con la fecha, como
   [2026-11-11-acceptance.md](2026-11-11-acceptance.md), y enlácela desde esta lista.

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
