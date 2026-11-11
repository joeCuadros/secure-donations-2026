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
| T10 | Evidencia estática | CA-NF03.1 | Ver `2026-11-11-smoke.md`: el rol de la función de listado solo permite `dynamodb:Query` sobre el índice del catálogo |
| T11 | PASS (con desviación) | CA-03.2, CA-NF02.1 | Token alterado rechazado con 401; ID token rechazado con **403** |
| T12 | PASS | CA-04.2 | 403 para GESTOR al consultar donaciones; la respuesta no contiene datos de donaciones |
| T13 | Pendiente | CA-03.4 | Procedimiento manual; no ejecutado |
| T14 | Pendiente | CA-11.2 | Procedimiento manual; no ejecutado. La configuración del pool (`MfaConfiguration: ON`, solo TOTP) está verificada |

Resumen del script: 11 PASS, 0 FAIL, 3 SKIPPED (T10, T13 y T14 no son automatizables con curl).

El proyecto de prueba `prj_c798226845a3` quedó creado y publicado en el entorno.

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
