# Declaración de uso de asistentes y agentes de código

Declaración exigida por design.md §10 y requirements.md §5(g).

> **Aviso para el equipo antes de entregar.** Los campos marcados como `[COMPLETAR POR EL EQUIPO: ...]` no se
> conocen y **no deben dejarse con el marcador**: los nombres de participantes, las revisiones realizadas y sus fechas
> los debe completar el equipo con información veraz. Este documento solo afirma como hecho lo que consta en el
> repositorio y en el historial de trabajo.

Cambios incorporados por pull request: #1 a #5, fusionados en `main`; #6 (figuras y secciones actualizadas del informe,
solo documentación), abierto. Esta versión del documento corresponde a la pasada de consistencia documental hecha sobre
la rama del PR #6.

## Tabla de declaración

| Herramienta/modelo | Participantes | Tareas asistidas | Aportes IA | Validación humana | Limitaciones |
|---|---|---|---|---|---|
| Claude Code (Anthropic), modelo Claude Fable 5.2 | `[COMPLETAR POR EL EQUIPO: integrantes que usaron la herramienta]` | Análisis de brechas entre `requirements.md`/`design.md` y el repositorio; correcciones de backend, infraestructura y frontend y despliegue (PR [#1](https://github.com/joeCuadros/secure-donations-2026/pull/1)); redacción de los documentos y scripts de entrega (ver más abajo) | Código y plantilla modificados en el PR #1; `README.md`, `docs/threat-model.md`, `docs/api.yaml`, `AI_USAGE.md`, `evidence/`, `scripts/acceptance.sh`, `scripts/create-test-users.sh`, `.github/workflows/ci.yml` y el recurso de presupuesto de `infra/template.yaml` | `[COMPLETAR POR EL EQUIPO: quién revisó cada PR (distinto de quien generó el cambio), fecha, comentarios y correcciones]` | Cuando se redactó esta fila no se había ejecutado ninguna prueba autenticada contra el despliegue; el estado actual de las pruebas está en «Limitaciones y resultados no verificados» |
| Claude Code (Anthropic), modelo Claude Sonnet 5.5, como subagente | `[COMPLETAR POR EL EQUIPO: integrante que lanzó la tarea]` | Redacción de los entregables de documentación, scripts, CI y OpenAPI listados en la fila anterior | Los mismos archivos de documentación y scripts | `[COMPLETAR POR EL EQUIPO: revisión de estos entregables]` | Al entregarlos, los scripts se habían probado solo con un servidor local simulado y una CLI de AWS simulada; `scripts/acceptance.sh` se ejecutó después contra el despliegue (ver `evidence/2026-11-11-acceptance.md`) y `scripts/create-test-users.sh` no consta ejecutado contra AWS |
| Claude Code (Anthropic), modelo Claude Sonnet 5.5, como subagente (pasada final de endurecimiento, PR #4) | `[COMPLETAR POR EL EQUIPO: integrante que lanzó la tarea]` | Auditoría de operaciones rechazadas, retirada de la condición Cedar tautológica de `ReadMyDonations`, esquema Cedar con validación `STRICT`, informe técnico (`docs/informe-tecnico.md`) y actualización de evidencias y documentación | `backend/src/audit/audited-handler.ts`, handlers y pruebas de `backend/`, `infra/template.yaml`, `policies/`, `docs/`, `evidence/`, y los tipos de la página de auditoría del frontend | `[COMPLETAR POR EL EQUIPO: revisión de estos cambios]` | El agente no ejecutó ningún comando `aws` ni `sam`: el despliegue de estos cambios lo hizo otra persona `[COMPLETAR POR EL EQUIPO: quién desplegó y con qué supervisión]`; la segunda corrida de aceptación se ejecutó después de desplegarlos. No se ejecutó `cedar validate`. El informe técnico no ha sido revisado por el equipo |
| Asistente de código usado en los PR #3, #5 y #6 `[COMPLETAR POR EL EQUIPO: herramienta y modelo, o indicar que no se usó IA]` | `[COMPLETAR POR EL EQUIPO: integrantes]` | PR #3: MFA TOTP obligatorio y evidencia de las pruebas de aceptación. PR #5: gestión de borradores (`GET /v1/projects/drafts`, pantalla «Borradores», prueba T03b) y reingreso tras recargar la página. PR #6: cinco figuras y el texto actualizado del informe de laboratorio (`docs/informe/`) `[COMPLETAR POR EL EQUIPO: confirmar qué parte de cada PR fue asistida por IA]` | `[COMPLETAR POR EL EQUIPO]` | `[COMPLETAR POR EL EQUIPO: revisión de cada PR]` | `[COMPLETAR POR EL EQUIPO]` |
| Claude Code (Anthropic), modelo Claude Sonnet 5.5, como subagente (pasada de consistencia documental sobre la rama del PR #6) | `[COMPLETAR POR EL EQUIPO: integrante que lanzó la tarea]` | Contrastar con el código, la plantilla y la evidencia de aceptación, y corregir, las afirmaciones desactualizadas de `README.md`, `docs/informe-tecnico.md`, `docs/threat-model.md`, `evidence/` y las descripciones de `docs/api.yaml`, además de este documento | Esos archivos de documentación; no modificó código, pruebas, plantilla, políticas ni scripts | `[COMPLETAR POR EL EQUIPO: revisión de estos cambios]` | Solo ejecutó `npm test` en `backend/` (205 pruebas superadas); no ejecutó `aws` ni `sam`, no abrió `frontend/.env.example` y no consultó el despliegue: las afirmaciones sobre él provienen de `evidence/2026-11-11-acceptance.md` |

## Detalle de tareas asistidas

1. **Análisis de brechas** del repositorio frente a los requerimientos (T01–T14, CA-*, RNF-HU-*) y al diseño.
2. **Correcciones y despliegue** reunidos en el PR #1 (<https://github.com/joeCuadros/secure-donations-2026/pull/1>) sobre
   backend, infraestructura SAM y frontend.
   `[COMPLETAR POR EL EQUIPO: quién ejecutó los comandos de despliegue y con qué supervisión; design.md §10 exige que los
   agentes con acceso a terminal no ejecuten despliegues sobre la cuenta AWS sin supervisión]`
3. **Documentación y entregables finales** (PR #2): README, modelo de amenazas con mapeo NIST, evidencias, scripts de
   aceptación y de usuarios de prueba, CI unificado en `ci.yml`, recurso opcional de AWS Budgets y corrección de
   `docs/api.yaml`; el mismo PR cerró el registro abierto de usuarios y ocultó `createdBy` en el detalle público.
4. **MFA obligatorio y evidencia de aceptación** (PR #3): `MfaConfiguration: "ON"` con TOTP y primera ejecución de
   `scripts/acceptance.sh` con usuarios reales.
5. **Endurecimiento** (PR #4): auditoría de rechazos (`DENIED`, `FAILURE`, `ERROR`), validación `STRICT` del almacén de
   Verified Permissions con esquema embebido, retirada de la condición tautológica de `ReadMyDonations`, informe técnico,
   segunda ejecución de aceptación y ejecución completa de T13.
6. **Gestión de borradores** (PR #5): `GET /v1/projects/drafts` (scope `api/projects.write` y acción Cedar
   `ListDraftProjects` solo para GESTOR), pantalla «Borradores», reingreso tras recargar la página con una bandera
   booleana de sesión y la prueba T03b; tercera ejecución de aceptación.
7. **Figuras y texto actualizado del informe** (PR #6): `docs/informe/` y, en esta pasada, la consistencia del resto de
   la documentación con el código y la evidencia.

## Defectos detectados por la IA

Defectos que el asistente identificó durante el análisis y que se corrigieron en el PR #1:

| # | Defecto | Corrección |
|---|---|---|
| 1 | Lectura errónea del claim `cognito:groups`: API Gateway lo entrega como texto (`[DONANTE]`), no como arreglo | `parseClaimList` normaliza texto y arreglos (`backend/src/authz/services/authorize.service.ts`) |
| 2 | Faltaban permisos (`permit`) de Cedar para acciones que el backend consulta | Una política por regla en `infra/template.yaml`, reflejada en `policies/` |
| 3 | Tres políticas Cedar en un único recurso `AWS::VerifiedPermissions::Policy`, que admite una sola sentencia | Un recurso por política |
| 4 | `Mode: OFF` sin comillas: YAML lo interpreta como booleano `false` | `Mode: "OFF"` en el PR #1; luego `Mode: "STRICT"` con esquema en el PR #4 |
| 5 | `TransactionCanceledException` sin capturar: una carrera producía 500 | Se traduce a 409 (`backend/src/shared/errors/dynamo-errors.ts`) |
| 6 | Tokens guardados en `sessionStorage` | Tokens solo en memoria (`frontend/src/auth/authConfig.ts`); `sessionStorage` solo conserva el estado transitorio de PKCE y una bandera booleana de continuidad de sesión (`frontend/src/auth/sessionMarker.ts`), nunca un token |

En la redacción de la entrega final se detectó además que el detalle público de un proyecto devolvía `createdBy` (`sub`
del gestor); se reportó y luego se corrigió en el PR #2, junto con el cierre del registro abierto de usuarios
(`AllowAdminCreateUserOnly: true`). `docs/api.yaml` estaba codificado en UTF-16 y no coincidía con los handlers; se
reescribió en UTF-8.

Otros defectos corregidos después, cuya detección no se atribuye aquí a una persona o a una herramienta:

| # | Defecto | Corrección |
|---|---|---|
| 7 | Los rechazos posteriores a la autenticación no quedaban auditados (solo las operaciones exitosas) | `backend/src/audit/audited-handler.ts` registra `DENIED`, `FAILURE` y `ERROR` (PR #4); observado en el despliegue |
| 8 | La política `ReadMyDonations` comparaba `principal.sub` con un recurso construido con ese mismo `sub` (condición tautológica) | Se retiró; la propiedad del historial es estructural (clave de partición del índice) y hay una prueba unitaria (PR #4). `[COMPLETAR POR EL EQUIPO: quién la detectó en la revisión]` |
| 9 | El almacén de Verified Permissions no validaba las políticas contra un esquema | `ValidationSettings.Mode: "STRICT"` con esquema embebido (PR #4) |
| 10 | Un proyecto en BORRADOR solo podía publicarse justo después de crearlo: la API no tenía una consulta de borradores y el detalle de un borrador responde 404. Lo señaló el uso de la aplicación; ni las pruebas unitarias ni T01–T14 lo detectaban | `GET /v1/projects/drafts`, pantalla «Borradores» y prueba T03b (PR #5); la publicación desde esa pantalla se comprobó en el despliegue. `[COMPLETAR POR EL EQUIPO: quién reportó el caso y si el código original fue generado por IA]` |

## Validación humana

`[COMPLETAR POR EL EQUIPO: para cada cambio de la IA, quién lo revisó, cuándo, qué pruebas ejecutó y qué corrigió. Incluir
quién ejecutó las observaciones registradas en evidence/2026-11-11-smoke.md y las pruebas de aceptación de
evidence/2026-11-11-acceptance.md (tres corridas y la ejecución manual de T13), y quién obtuvo los tokens con
scripts/refresh-tokens.sh.]`

Comprobaciones automáticas ejecutadas durante la redacción inicial (no sustituyen la revisión humana): `npm run
typecheck` en backend, `npm run lint` en frontend, `bash -n` sobre ambos scripts de entonces, `npm audit
--audit-level=high` y validación sintáctica de `template.yaml` y `docs/api.yaml`. En la pasada de consistencia
documental se ejecutó además `npm test` en `backend/`: 205 pruebas en 9 archivos, todas superadas.

## Limitaciones y resultados no verificados

- **Pruebas contra el despliegue:** `scripts/acceptance.sh` se ejecutó tres veces con usuarios reales (dos DONANTE y un
  GESTOR, con MFA TOTP): 11 PASS y 3 omitidas, luego el mismo resultado tras el endurecimiento y 12 PASS con T03b. T01–T09,
  T11, T12 y T03b pasaron; T13 pasó en una ejecución manual. Pendientes o parciales: **T14** (falta la captura manual del
  desafío TOTP; la configuración del pool está verificada), **T10** (solo evidencia estática: el IAM Policy Simulator no
  es utilizable en esta cuenta porque la SCP de la organización devuelve `explicitDeny` para cualquier acción) y **HU-10**
  (ninguna ejecución usó un usuario AUDITOR; las filas de `AuditEvents` se verificaron con una consulta directa al índice,
  no con `GET /v1/audit`). Detalle en `evidence/2026-11-11-acceptance.md`.
- **Desviación observada:** un ID token recibe 403 y no el 401 que espera CA-03.2.
- **Pruebas unitarias:** simulan DynamoDB y Verified Permissions; no detectan una política Cedar demasiado permisiva.
  Solo las pruebas negativas contra el despliegue lo hacen. No se ejecutó `cedar validate`.
- **Scripts:** `scripts/create-test-users.sh` solo consta probado con una CLI de AWS simulada; la evidencia no indica si se
  usó para crear los usuarios de las pruebas. `[COMPLETAR POR EL EQUIPO: cómo se crearon los usuarios de prueba]`. Su texto
  de ayuda y el modo `--enforce-mfa` siguen describiendo un MFA opcional, algo que ya no corresponde al pool.
- **Sin verificar:** las pruebas de rendimiento (RNF-HU-05) y de accesibilidad (RNF-HU-06) no se realizaron; tampoco las
  capturas de CloudWatch (CA-NF07.2) ni la alerta de AWS Budgets (el parámetro existe, pero no se indicó ningún correo).
- **Limpieza:** no consta que se haya ejecutado la limpieza de recursos (CA-NF09.2); el despliegue sigue activo.
- **Contenido generado que el equipo debe comprender y defender:** la IA puede producir descripciones plausibles pero
  incorrectas; cada afirmación del modelo de amenazas y del informe técnico debe contrastarse con el código antes de la
  sustentación.
- **Políticas IAM:** las políticas propias de las funciones no usan comodines; el rol administrado
  `AWSLambdaBasicExecutionRole` sí concede permisos de logs amplios (limitación declarada).

## Archivo generado por un agente tras una denegación de escritura

El archivo `frontend/.env.example` fue producido por un agente después de que una escritura directa fuera denegada por la
regla que protege los archivos `.env*`. Sigue sin versionar en el repositorio y no fue revisado por quien redactó este
documento. Queda **pendiente de decisión humana**: revisar su contenido (solo debe contener marcadores, sin
identificadores ni valores reales del despliegue) y decidir si se conserva o se elimina.
`[COMPLETAR POR EL EQUIPO: decisión tomada, quién la tomó y fecha]`

## Cumplimiento de las reglas de design.md §10

| Regla | Estado |
|---|---|
| Todo cambio de IA entra por PR revisado por un integrante distinto | Los cambios entraron por pull request (#1 a #5 fusionados; #6 abierto). `[COMPLETAR POR EL EQUIPO: revisor de cada uno]` |
| No se compartieron credenciales AWS, tokens ni contenidos de `.env` con los asistentes | `[COMPLETAR POR EL EQUIPO]` |
| Los controles de seguridad tienen pruebas escritas o revisadas por el equipo | Hay 205 pruebas unitarias y pruebas negativas ejecutadas contra el despliegue; `[COMPLETAR POR EL EQUIPO: revisión de esas pruebas]` |
| Cada integrante puede explicar el código y las decisiones | `[COMPLETAR POR EL EQUIPO]` |
