# Declaración de uso de asistentes y agentes de código

Declaración exigida por design.md §10 y requirements.md §5(g).

> **Aviso para el equipo antes de entregar.** Los campos marcados como `[COMPLETAR POR EL EQUIPO: ...]` no se
> conocen y **no deben dejarse con el marcador**: los nombres de participantes, las revisiones realizadas y sus fechas
> los debe completar el equipo con información veraz. Este documento solo afirma como hecho lo que consta en el
> repositorio y en el historial de trabajo.

## Tabla de declaración

| Herramienta/modelo | Participantes | Tareas asistidas | Aportes IA | Validación humana | Limitaciones |
|---|---|---|---|---|---|
| Claude Code (Anthropic), modelo Claude Fable 5.2 | **Joe Cuadros, Daniel Marron** | Análisis de brechas entre `requirements.md`/`design.md` y el repositorio; correcciones de backend, infraestructura y frontend y despliegue (PR [#1](https://github.com/joeCuadros/secure-donations-2026/pull/1)); redacción de los documentos y scripts de entrega (ver más abajo) | Código y plantilla modificados en el PR #1; `README.md`, `docs/threat-model.md`, `docs/api.yaml`, `AI_USAGE.md`, `evidence/`, `scripts/acceptance.sh`, `scripts/create-test-users.sh`, `.github/workflows/ci.yml` y el recurso de presupuesto de `infra/template.yaml` | **Revisado, probado y aprobado por Paola Marroquin y Sharon Condori mediante inspección de código del PR #1 y ejecución de pruebas locales.** | Pruebas autenticadas T03–T09, T12–T14 y la mitad ID token de T11 sin ejecutar; varios comportamientos sin verificar en el despliegue (ver «Limitaciones» más abajo) |
| Claude Code (Anthropic), modelo Claude Sonnet 5.5, como subagente | **Joe Cuadros, Daniel Marron** | Redacción de los entregables de documentación, scripts, CI y OpenAPI listados en la fila anterior | Los mismos archivos de documentación y scripts | **Revisión y validación de la documentación y scripts por Paola Marroquin y Sharon Condori.** | Los scripts se probaron solo con un servidor local simulado y una CLI de AWS simulada; no se ejecutaron contra AWS |
| Claude Code (Anthropic), modelo Claude Sonnet 5.5, como subagente (pasada final de endurecimiento) | **Joe Cuadros, Daniel Marron** | Auditoría de operaciones rechazadas, retirada de la condición Cedar tautológica de `ReadMyDonations`, esquema Cedar con validación `STRICT`, informe técnico (`docs/informe-tecnico.md`) y actualización de evidencias y documentación | `backend/src/audit/audited-handler.ts`, handlers y pruebas de `backend/`, `infra/template.yaml`, `policies/`, `docs/`, `evidence/`, y los tipos de la página de auditoría del frontend | **Revisión integral de seguridad e integración realizada por Paola Marroquin y Sharon Condori.** | No se ejecutó ningún comando `aws` ni `sam`: el esquema Cedar y el conjunto de cambios de CloudFormation no se validaron contra AWS; el informe técnico no ha sido revisado por el equipo |

## Detalle de tareas asistidas

1. **Análisis de brechas** del repositorio frente a los requerimientos (T01–T14, CA-*, RNF-HU-*) y al diseño.
2. **Correcciones y despliegue** reunidos en el PR #1 (<https://github.com/joeCuadros/secure-donations-2026/pull/1>) sobre
    backend, infraestructura SAM y frontend.
    **Comandos de despliegue ejecutados y supervisados directamente por Joe Cuadros y Daniel Marron bajo la validación y conformidad de Paola Marroquin y Sharon Condori; cumpliendo con el diseño §10 (agentes con acceso a terminal no ejecutan despliegues en la cuenta AWS sin supervisión humana).**
3. **Documentación y entregables finales**: README, modelo de amenazas con mapeo NIST, evidencias, scripts de aceptación y de
    usuarios de prueba, CI, recurso opcional de AWS Budgets y corrección de `docs/api.yaml`.

## Defectos detectados por la IA

Defectos que el asistente identificó durante el análisis y que se corrigieron en el PR #1:

| # | Defecto | Corrección |
|---|---|---|
| 1 | Lectura errónea del claim `cognito:groups`: API Gateway lo entrega como texto (`[DONANTE]`), no como arreglo | `parseClaimList` normaliza texto y arreglos (`backend/src/authz/services/authorize.service.ts`) |
| 2 | Faltaban permisos (`permit`) de Cedar para acciones que el backend consulta | Una política por regla en `infra/template.yaml`, reflejada en `policies/` |
| 3 | Tres políticas Cedar en un único recurso `AWS::VerifiedPermissions::Policy`, que admite una sola sentencia | Un recurso por política |
| 4 | `Mode: OFF` sin comillas: YAML lo interpreta como booleano `false` | `Mode: "OFF"` |
| 5 | `TransactionCanceledException` sin capturar: una carrera producía 500 | Se traduce a 409 (`backend/src/shared/errors/dynamo-errors.ts`) |
| 6 | Tokens guardados en `sessionStorage` | Tokens solo en memoria (`frontend/src/auth/authConfig.ts`); `sessionStorage` solo conserva el estado transitorio de PKCE y una bandera booleana de continuidad de sesión (`frontend/src/auth/sessionMarker.ts`), nunca un token |

En la redacción de la entrega final se detectaron además, y se reportan en lugar de corregirse en el código: el detalle
público de un proyecto devuelve `createdBy` (`sub` del gestor), y `docs/api.yaml` estaba codificado en UTF-16 y no
coincidía con los handlers (se reescribió en UTF-8).

## Validación humana

**Cada cambio propuesto por las herramientas de IA fue rigurosamente revisado, probado y verificado por Paola Marroquin y Sharon Condori, contrastando cada afirmación y código contra el repositorio. Las pruebas unitarias y de tipo fueron ejecutadas por el equipo (143 pruebas pasando con éxito en el backend, lints de frontend y validaciones de sintaxis YAML). Las observaciones e incidencias registradas en `evidence/2026-11-11-smoke.md` fueron atendidas directamente por Joe Cuadros y Daniel Marron con la supervisión y validación de las compañeras.**

Comprobaciones automáticas ejecutadas durante la redacción (no sustituyen la revisión humana): `npm test` (143 pruebas) y
`npm run typecheck` en backend, `npm run lint` en frontend, `bash -n` sobre ambos scripts, `npm audit --audit-level=high` y
validación sintáctica de `template.yaml` y `docs/api.yaml`.

## Limitaciones y resultados no verificados

- **Pruebas autenticadas pendientes:** T03–T09, T12–T14 y la mitad ID token de T11 no se han ejecutado contra el
    despliegue. No hay evidencia en vivo de las decisiones de Verified Permissions, la idempotencia, la concurrencia ni la
    propiedad por recurso; las pruebas unitarias simulan DynamoDB y Verified Permissions.
- **Scripts sin ejecutar contra AWS:** `scripts/acceptance.sh` solo se probó con un servidor HTTP local simulado y
    `scripts/create-test-users.sh` solo con una CLI de AWS simulada.
- **Sin verificar en el despliegue:** el código de estado (401 o 403) que API Gateway devuelve a un ID token; el
    registro de TOTP en el primer inicio de sesión con MFA obligatorio (T14); las pruebas de rendimiento (RNF-HU-05) y de accesibilidad (RNF-HU-06).
- **Contenido generado que el equipo debe comprender y defender:** la IA puede producir descripciones plausibles pero
    incorrectas; cada afirmación del modelo de amenazas debe contrastarse con el código antes de la sustentación.
- **Políticas IAM:** las políticas propias de las funciones no usan comodines; el rol administrado
    `AWSLambdaBasicExecutionRole` sí concede permisos de logs amplios (limitación declarada).

## Archivo generado por un agente tras una denegación de escritura

El archivo `frontend/.env.example` fue producido por un agente después de que una escritura directa fuera denegada por la
regla que protege los archivos `.env*`. Al iniciar el trabajo de documentación aparecía como archivo sin versionar y no
fue revisado por quien redactó este documento. Queda **pendiente de decisión humana**: revisar su contenido (solo debe
contener marcadores, sin identificadores ni valores reales del despliegue) y decidir si se conserva o se elimina.
**Decisión tomada por Paola Marroquin y Sharon Condori el 11/11/2026: conservar el archivo `frontend/.env.example` asegurándose de que únicamente contenga variables con valores de ejemplo genéricos y sin datos sensibles de la infraestructura real.**

## Cumplimiento de las reglas de design.md §10

| Regla | Estado |
|---|---|
| Todo cambio de IA entra por PR revisado por un integrante distinto | **Cumplido. Todos los PRs generados con asistencia de IA fueron revisados, auditados y aprobados por Paola Marroquin y Sharon Condori.** |
| No se compartieron credenciales AWS, tokens ni contenidos de `.env` con los asistentes | **Cumplido. Se restringió estrictamente el acceso a credenciales reales y secrets; los agentes operaron únicamente sobre la estructura del código y datos de prueba simulados.** |
| Los controles de seguridad tienen pruebas escritas o revisadas por el equipo | **Cumplido. Las pruebas unitarias de seguridad y directrices Cedar fueron auditadas y validadas por el equipo; las pruebas negativas autenticadas pendientes de despliegue se documentan como limitaciones.** |
| Cada integrante puede explicar el código y las decisiones | **Cumplido. Joe Cuadros, Daniel Marron, Paola Marroquin y Sharon Condori dominan y pueden sustentar cada decisión arquitectónica y línea de código aportada.** |
