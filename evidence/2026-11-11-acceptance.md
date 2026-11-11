# Evidencia: pruebas de aceptación con usuarios autenticados (2026-11-11)

Ejecución de `scripts/acceptance.sh` contra el stage `academic` desplegado en `us-east-2`
(pila `secure-donations-backend-academic`), con tres usuarios de prueba reales del user pool:
dos del grupo DONANTE y uno del grupo GESTOR. Los tres iniciaron sesión por el login administrado
de Cognito (Authorization Code + PKCE) con MFA TOTP obligatorio. Los tokens se obtuvieron con
`scripts/refresh-tokens.sh` y no se registran en este documento.

Esta evidencia sustituye el estado «pendiente» que `2026-11-11-smoke.md` asigna a T03–T09, T11 y T12.

## Resultado

| ID | Estado | Trazabilidad | Resultado observado |
|---|---|---|---|
| T01 | PASS | CA-01.1, CA-01.2 | 200 sin proyectos BORRADOR; el borrador no aparece en el catálogo y responde 404 por id |
| T02 | PASS | CA-03.2 | 401 sin token: `{"message":"Unauthorized"}` |
| T03 | PASS | CA-04.1 | 403 para DONANTE al crear proyecto: `{"code":"FORBIDDEN","message":"Acceso denegado (Zero Trust PE): Operación no permitida.","requestId":"GsNznjyWiYcEM6g="}` |
| T04 | PASS | CA-05.2 | 400 para 0, 100001, 12.5, `"2500"` y ausencia de `Idempotency-Key` |
| T05 | PASS | CA-05.1 | 201; donación `don_0ed21c12e190` en `PENDIENTE_SIMULACION` (simulada, sin cobro) |
| T06 | PASS | CA-05.4 | Mismo `donationId` al repetir clave y carga; el historial creció en exactamente 1 (0 → 1) |
| T07 | PASS | CA-05.4 | 409 al reutilizar la clave con otro importe: `{"code":"CONFLICT","message":"La clave de idempotencia ya fue utilizada con otro payload.","requestId":"GsN0-jbPiYcEPwA="}` |
| T08 | PASS | CA-06.2, CA-NF04.1 | 10 solicitudes paralelas de confirmación: 1 × 200 y 9 × 409; acumulado +1000 céntimos (un solo incremento) |
| T09 | PASS | CA-07.2 | 403 sin filtración al operar sobre una donación ajena; la donación del propietario sigue en `PENDIENTE_SIMULACION` |
| T10 | Evidencia estática | CA-NF03.1 | Ver `2026-11-11-smoke.md`: el rol de la función de listado solo permite `dynamodb:Query` sobre el índice del catálogo. El IAM Policy Simulator no es utilizable en esta cuenta: la SCP de la organización hace que devuelva `explicitDeny` para cualquier acción, por lo que no sirve como prueba dinámica |
| T11 | PASS (con desviación) | CA-03.2, CA-NF02.1 | Token alterado rechazado con 401; ID token rechazado con **403** |
| T12 | PASS | CA-04.2 | 403 para GESTOR al consultar donaciones; la respuesta no contiene datos de donaciones |
| T13 | PASS | CA-03.4 | El access token revocado siguió aceptado (200) hasta expirar y se rechazó (401) dos segundos después; el refresh token revocado fue rechazado (`invalid_grant`). Ver la sección «T13: ejecución completa» |
| T14 | Pendiente | CA-11.2 | Captura manual pendiente. La configuración del pool está verificada (`MfaConfiguration: ON`, solo TOTP, sin SMS) y CloudTrail registra eventos `MfaRegister` en el primer inicio de sesión |

Resumen del script: 11 PASS, 0 FAIL, 3 SKIPPED (T10, T13 y T14 no son automatizables con curl). T13 se ejecutó
después de forma manual y quedó en PASS (ver más abajo); T14 sigue pendiente.

El proyecto de prueba `prj_c798226845a3` quedó creado y publicado en el entorno.

## T13: ejecución completa

Ejecución manual del procedimiento de `scripts/acceptance.sh` con un usuario de prueba y **el mismo access token**
durante toda la prueba (emitido hacia las 19:56:48 UTC, con vencimiento a las 20:11:48 UTC). Horas en UTC,
2026-11-11. Los tokens no se registran.

| Hora (UTC) | Paso | Resultado |
|---|---|---|
| 19:56:48 | `GET /v1/donations/me` con el access token vigente | 200 |
| hacia 19:57:00 | Revocación del refresh token con `/oauth2/revoke` | 200 |
| 19:57:04 | Mismo access token | **200**: se acepta tras la revocación |
| posterior | Intento de renovar con el refresh token revocado | `invalid_grant` |
| 19:57:34, 20:01:45, 20:02:58, 20:03:01 y 20:03:02 | Mismo access token | 200 en cada llamada |
| 20:11:50 | Mismo access token, dos segundos después de expirar | **401** |

Conclusión: un access token revocado permaneció válido durante el resto de su vigencia (unos 15 minutos), porque el JWT
authorizer valida firma y expiración de forma local y no consulta revocaciones; la revocación solo impidió renovarlo. La
exposición queda acotada por la vida de 15 minutos del token (AD-07, CA-03.4). Se cumple lo que T13 espera: aceptado
hasta expirar y rechazado después.

## Desviación observada en T11

`requirements.md` (CA-03.2) espera HTTP 401 cuando se usa un ID token como credencial. El despliegue
responde **403**. El ID token es rechazado igualmente, pero con otro código: el JWT authorizer de
API Gateway HTTP API valida la firma y el emisor (que en un ID token son correctos) y lo rechaza al
comprobar los scopes de la ruta, que el ID token no contiene; esa comprobación produce 403, no 401.
El comportamiento es propio del servicio y no es configurable. Debe constar en el informe.

## Lo que esta ejecución demuestra por primera vez

Las pruebas unitarias simulan Verified Permissions y DynamoDB, por lo que hasta esta ejecución no
estaban verificados contra servicios reales:

- El formato del claim `cognito:groups` que entrega el JWT authorizer y su interpretación por el backend.
- La evaluación de las políticas Cedar en Amazon Verified Permissions (T03, T05, T09, T12).
- La idempotencia atómica y la transición condicionada bajo concurrencia real en DynamoDB (T06–T08).

## Observaciones del proceso

- Todos los access tokens incluyen todos los scopes del app client, también `api/projects.write` en
  los usuarios DONANTE. El control de rol lo ejerce Verified Permissions a partir del grupo, no el
  scope; T03 lo comprueba.
- La vigencia de 15 minutos del access token (CA-03.3) no alcanza para copiar a mano los tokens de
  varios usuarios con MFA; por eso se añadió `scripts/refresh-tokens.sh`.

## Segunda ejecución, tras el endurecimiento (20:35 UTC)

`scripts/acceptance.sh` se repitió después de desplegar la auditoría de rechazos, el esquema Cedar en
modo `STRICT` y la nueva política `ReadMyDonations`. Resultado idéntico: **11 PASS, 0 FAIL, 3 SKIPPED**
(T10, T13 y T14 son manuales). No hubo regresión. Proyecto de prueba: `prj_4e5d239613b5`.

### Rechazos registrados en `AuditEvents`

Consulta al índice `AllAuditLogsIndex` inmediatamente después de la ejecución. Los 35 eventos más
recientes se reparten en 17 `SUCCESS`, 15 `FAILURE` y 3 `DENIED`. Extracto (hora UTC):

```text
20:35:20.502  DONATION_EVENT  LIST_MY_DONATIONS       DENIED   actor_71b3623f  n/a                (T12)
20:35:18.302  DONATION_EVENT  SIMULATE_DONATION       DENIED   actor_95ee128d  don_411ae3363a09   (T09)
20:35:17.024 – 20:35:17.175   SIMULATE_DONATION       FAILURE  actor_0420370a  don_e322f7e17fc2   (T08, 9 eventos)
20:35:16.962  DONATION_EVENT  SIMULATE_DONATION       SUCCESS  actor_0420370a  don_e322f7e17fc2   (T08, 1 evento)
20:35:10.632  DONATION_EVENT  CREATE_DONATION_INTENT  FAILURE  actor_0420370a  n/a                (T07)
20:35:04.665 – 20:35:07.528   CREATE_DONATION_INTENT  FAILURE  actor_0420370a  n/a                (T04, 5 eventos)
20:35:03.494  PROJECT_EVENT   CREATE_PROJECT          DENIED   actor_0420370a  n/a                (T03)
```

La auditoría reproduce T08 con exactitud: una confirmación `SUCCESS` y nueve `FAILURE` sobre la misma
donación. Cada evento contiene únicamente `timestamp`, `requestId`, `eventId`, `eventType`, `action`,
`outcome`, `actorRef` (seudónimo), `resourceRef` y las claves de la tabla; no hay tokens, importes ni
el `sub` en claro (CA-10.2).

Observación: la repetición idempotente de T06 genera un segundo evento `SUCCESS` para la misma
donación. No afecta a los datos de negocio, pero la auditoría cuenta dos eventos para una sola creación.
