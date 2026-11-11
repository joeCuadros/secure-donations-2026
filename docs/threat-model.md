# Modelo de amenazas y mapeo NIST SP 800-207

Resumen STRIDE por frontera de confianza de la Plataforma de Donaciones Seguras (prototipo académico con donaciones
simuladas). Cada control cita el archivo o recurso de la plantilla donde vive. Solo se describen controles
confirmados en `infra/template.yaml`, `policies/`, `backend/src/` y `frontend/src/`.

**Estado de verificación.** Cada fila indica cómo se comprobó el control:

- **Despliegue**: observado contra la pila real el 2026-11-11, sin credenciales (ver
  [evidence/2026-11-11-smoke.md](../evidence/2026-11-11-smoke.md)).
- **Unitaria**: cubierto por pruebas Vitest, que simulan DynamoDB y Verified Permissions (no demuestran el
  comportamiento real de esos servicios).
- **Plantilla**: revisado en el código de infraestructura, sin ejercicio en vivo.
- **Pendiente**: requiere usuarios autenticados y aún no se ha ejecutado (T03–T09, T12–T14 y la mitad de T11 con
  ID token). **Un control pendiente no está demostrado.**

## 1. Modelo del sistema

Actores: visitante (anónimo), donante, gestor y auditor (grupos de Cognito `DONANTE`, `GESTOR`, `AUDITOR`).
Activos: proyectos y su acumulado confirmado simulado, donaciones y su estado, registros de idempotencia, eventos de
auditoría, identidades y tokens. No hay datos de pago.

```text
Navegador ──► CloudFront ──► S3 privado                      (frontera 1)
Navegador ──► Cognito (hosted UI, /oauth2/token)              (frontera 2)
Navegador ──► API Gateway HTTP API (JWT authorizer)           (frontera 3)
API Gateway ──► Lambda                                        (frontera 4)
Lambda ──► Verified Permissions (IsAuthorized)                (frontera 5)
Lambda ──► DynamoDB                                           (frontera 6)
```

Supuestos: el navegador y la red no son confiables; la identidad solo se confía a partir de claims que API Gateway
entrega tras validar el JWT; los servicios administrados de AWS son confiables dentro de su modelo de responsabilidad
compartida.

## 2. STRIDE por frontera de confianza

### Frontera 1: navegador → CloudFront / S3

| STRIDE | Amenaza | Control implementado | Dónde vive | Estado |
|---|---|---|---|---|
| S | Suplantación o intermediario sobre el sitio | Solo HTTPS: `ViewerProtocolPolicy: redirect-to-https` y HSTS (`max-age=31536000; includeSubDomains`) | `FrontendDistribution`, `FrontendResponseHeadersPolicy` | Despliegue (301 a HTTPS y cabecera HSTS observadas) |
| T | Modificación del contenido servido o acceso directo al bucket | Bucket privado con `PublicAccessBlockConfiguration` completo, `BucketOwnerEnforced` y política que solo permite `s3:GetObject` al servicio CloudFront con `AWS:SourceArn` de la distribución (OAC con SigV4) | `FrontendBucket`, `FrontendOriginAccessControl`, `FrontendBucketPolicy` | Despliegue (URL directa de S3: 403) |
| T/E | XSS que ejecute código o robe tokens | CSP restrictiva (`default-src 'none'`, `script-src 'self'`, `style-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limitado a la API, el dominio de Cognito y `cognito-idp`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`; tokens solo en memoria | `FrontendResponseHeadersPolicy`; `frontend/src/auth/authConfig.ts` (`InMemoryWebStorage`) | Despliegue (cabeceras observadas); tokens en memoria: Plantilla/código |
| T | Clickjacking | `X-Frame-Options: DENY` y `frame-ancestors 'none'` | `FrontendResponseHeadersPolicy` | Despliegue |
| I | Divulgación de datos o secretos desde el sitio | El build solo incluye URLs e identificadores públicos (`VITE_*`); cifrado en reposo AES256 del bucket; sin credenciales AWS en el frontend | `FrontendBucket`; `frontend/src/config/env.ts` | Plantilla |
| I | Cabecera `Permissions-Policy` (cámara, micrófono, geolocalización) | Definida como cabecera personalizada | `FrontendResponseHeadersPolicy` (`CustomHeadersConfig`) | Plantilla (no figura entre las cabeceras capturadas el 2026-11-11; verificar) |
| R | Falta de registro de accesos al sitio | **No implementado**: no hay logs de acceso de CloudFront ni de S3 | — | Limitación declarada |
| D | Saturación del sitio | Distribución global de CloudFront; no hay WAF | `FrontendDistribution` (`PriceClass_100`) | Limitación declarada |

### Frontera 2: navegador → Amazon Cognito

| STRIDE | Amenaza | Control implementado | Dónde vive | Estado |
|---|---|---|---|---|
| S | Interceptación del código de autorización o uso del flujo implícito | Solo flujo `code` (`AllowedOAuthFlows: [code]`), cliente sin secreto, `ExplicitAuthFlows` limitado a SRP y refresh; la SPA usa `response_type=code` con PKCE (oidc-client-ts). La plantilla no tiene un ajuste que **imponga** PKCE: lo aplica el cliente | `CognitoUserPoolClient`; `frontend/src/auth/authConfig.ts` | Plantilla; el flujo completo está **pendiente** de pruebas autenticadas |
| S | Redirección a un destino no autorizado | Lista de `CallbackURLs` y `LogoutURLs` (CloudFront y `http://localhost:5173`) | `CognitoUserPoolClient` | Plantilla. La URL local queda registrada también en el despliegue académico |
| S/I | Enumeración de usuarios | `PreventUserExistenceErrors: ENABLED` | `CognitoUserPoolClient` | Plantilla |
| E | Robo de credenciales de GESTOR o AUDITOR | TOTP (`EnabledMfas: SOFTWARE_TOKEN_MFA`, sin SMS) exigido **por usuario** mediante `admin-set-user-mfa-preference`; el pool es `MfaConfiguration: OPTIONAL` | `CognitoUserPool`; `scripts/create-test-users.sh --enforce-mfa` | **Pendiente** (T14). Riesgo residual: un usuario privilegiado sin TOTP activo entra solo con contraseña |
| E | Autorregistro de cuentas | La plantilla no define `AdminCreateUserConfig`, por lo que no restringe el registro. Una cuenta sin grupo no recibe ningún permiso porque Verified Permissions deniega por defecto | `CognitoUserPool`; `policies/*.cedar` | Plantilla; el comportamiento real del autorregistro debe confirmarse en el despliegue |
| E | Un usuario solicita un scope que no corresponde a su rol | Los scopes `api/*` no dependen del grupo: acotan el tipo de token, no el rol. El rol lo decide Cedar (frontera 5) | `CognitoResourceServer`; `policies/*.cedar` | **Pendiente** (T03, T12) |
| I/R | Robo de tokens y su reutilización | Access e ID token de 15 minutos, refresh token de 1 día, `EnableTokenRevocation: true`; al cerrar sesión la SPA revoca access y refresh token y borra la sesión local | `CognitoUserPoolClient`; `frontend/src/auth/logout.ts` | Plantilla; revocación **pendiente** (T13) |
| D | Fuerza bruta de credenciales | Solo las protecciones propias de Cognito; política de contraseña de 8 caracteres con mayúscula, minúscula y número. No hay Cognito Plus | `CognitoUserPool` | Limitación declarada |

### Frontera 3: navegador → API Gateway HTTP API

| STRIDE | Amenaza | Control implementado | Dónde vive | Estado |
|---|---|---|---|---|
| S | Llamada sin token, expirado, alterado o de otro app client | JWT authorizer por defecto: valida emisor, firma, expiración y audiencia (`client_id` del app client). Solo tres rutas GET son públicas, con `Authorizer: NONE` explícito | `HttpApi` (`Auth.DefaultAuthorizer`); eventos `ApiEvent` de las funciones | Despliegue (sin token: 401; token alterado: 401; `/v1/audit` sin token: 401). ID token: **pendiente** |
| E | Uso de un ID token como credencial | Las rutas protegidas exigen scope (`AuthorizationScopes`); un ID token no lleva `scope` | `ApiEvent.Auth.AuthorizationScopes` | **Pendiente** (T11, mitad ID token). El requisito espera 401; API Gateway puede responder 401 o 403 al fallar el scope, y debe registrarse el código observado |
| S/T | Reutilización de un token robado | Vida corta (15 min). El JWT authorizer no consulta revocaciones | `CognitoUserPoolClient` | Limitación declarada; **pendiente** (T13) |
| T | Origen web no autorizado (CORS) | `AllowOrigins` limitado al dominio de CloudFront y a `http://localhost:5173`; métodos y cabeceras acotados. CORS lo aplica el navegador y no sustituye la autenticación | `HttpApi.CorsConfiguration` | Despliegue (origen de CloudFront reflejado; `https://evil.example` sin `allow-origin`) |
| I | Divulgación en errores | Formato uniforme `{code,message,requestId}`; los errores no controlados devuelven un mensaje genérico | `backend/src/shared/errors/error-handler.ts` | Despliegue (404 con formato uniforme); Unitaria |
| R | Falta de trazabilidad | Log de acceso JSON del stage (sin cabecera `Authorization` ni cuerpo), retención de 14 días | `HttpApiAccessLogGroup`, `HttpApi.AccessLogSettings` | Plantilla |
| D | Abuso y fuerza bruta contra la API | Limitación del stage: 10 solicitudes/s con ráfaga de 20 (`DefaultRouteSettings`). HTTP API no admite WAF | `HttpApi.DefaultRouteSettings` | Plantilla; limitación declarada (sin WAF) |

### Frontera 4: API Gateway → Lambda

| STRIDE | Amenaza | Control implementado | Dónde vive | Estado |
|---|---|---|---|---|
| S | Falsificar identidad o roles desde el cliente | `sub`, `cognito:groups` y `scope` se leen **solo** de `requestContext.authorizer.jwt.claims`, que completa API Gateway; nunca del cuerpo ni de cabeceras. Sin claims, el handler responde 401 | `backend/src/authz/services/authorize.service.ts` | Unitaria; el 401 de API Gateway se observó en despliegue |
| E | Ruta protegida expuesta por error de configuración del authorizer | Defensa en profundidad: cada handler reverifica el scope (`verifyScope`, falla cerrada) y rechaza eventos sin claims | `backend/src/authz/api.ts` | Unitaria |
| T | Entradas manipuladas | Zod: `amountCents` entero entre 100 y 100000, `Idempotency-Key` UUID, `result` enumerado, límites de título y descripción, `limit` entre 1 y 100; JSON malformado responde 400, no 500 | `backend/src/shared/schemas/common.schema.ts`, `backend/src/*/api.ts`, `shared/utils/request.ts` | Unitaria |
| T | Lectura errónea de grupos | El authorizer entrega `cognito:groups` como texto (`[DONANTE]`); `parseClaimList` lo normaliza | `parseClaimList` | Unitaria (defecto corregido) |
| R | Acciones sin rastro | Cada invocación emite una línea de acceso JSON con `requestId`, acción, resultado, código HTTP y duración; el logger redacta claves sensibles (`password`, `token`, `authorization`, `secret`, `idempotencykey`, `card`) y no registra cabeceras, cuerpo ni evento crudo | `backend/src/shared/logger/` | Unitaria |
| I | Secretos en variables de entorno | Solo hay nombres de tablas e identificadores; no hay secretos | `Globals.Function.Environment` | Plantilla |
| D | Funciones lentas o con recursos excesivos | `Timeout: 10`, `MemorySize: 256`; limitación en API Gateway | `Globals.Function` | Plantilla |
| E | Invocación directa de la función | No hay URL de función ni otras fuentes de eventos; solo el evento `HttpApi` | Funciones `AWS::Serverless::Function` | Plantilla |

### Frontera 5: Lambda → Amazon Verified Permissions

| STRIDE | Amenaza | Control implementado | Dónde vive | Estado |
|---|---|---|---|---|
| S | Una función suplanta al motor de políticas o consulta otro almacén | El rol de las funciones protegidas solo permite `verifiedpermissions:IsAuthorized` sobre el ARN del almacén de políticas | `AVPAuthPolicy` (no se adjunta a las tres funciones públicas) | Plantilla |
| T | El cliente inyecta atributos para obtener un `ALLOW` | Las entidades se construyen en el servidor: grupos y `sub` desde claims verificados; `donorSub` y `status` desde el registro persistido | `backend/src/authz/services/avp.service.ts`, `simulate-donation.service.ts`, `create-donation.service.ts` | Unitaria (forma de la solicitud); decisión real **pendiente** |
| E | Elevación vertical (donante gestiona proyectos) | Una política `permit` por regla; denegación por defecto: `CreateProject`/`PublishProject` solo `GESTOR`, `CreateDonation` y `SimulateDonation` solo `DONANTE`, `ReadAuditLogs` solo `AUDITOR` | `policies/*.cedar`; `CreateProjectPolicy`, `PublishProjectPolicy`, `CreateDonationPolicy`, `SimulateDonationPolicy`, `ReadMyDonationsPolicy`, `CoreAuthorizationPolicy` | **Pendiente** (T03, T12) |
| E | Acceso horizontal (BOLA) a donaciones ajenas | `SimulateDonation` exige `principal.sub == resource.donorSub`; además la transacción de DynamoDB condiciona `donorSub = :sub` (segunda barrera independiente de Cedar) | `SimulateDonationPolicy`; `simulate-donation.service.ts` | **Pendiente** (T09). La condición de DynamoDB no tiene aserción en las pruebas unitarias |
| E | Donar a un proyecto no publicado | `CreateDonation` exige `resource.status == "PUBLICADO"`, y el servicio devuelve 409 antes de consultar | `CreateDonationPolicy`; `create-donation.service.ts` | Unitaria (409); Cedar **pendiente** |
| R | Decisiones sin registro | Una denegación queda en el log de acceso (403 con `errorCode`), pero no hay registro de decisiones del motor | `access-log.ts` | Limitación declarada |
| D/I | Indisponibilidad o error del motor | Falla cerrada: cualquier error de AVP o falta de configuración produce 500 genérico; el detalle va solo al log del servidor. Las rutas públicas no dependen de AVP | `avp.service.ts` | Unitaria |
| T | Políticas inválidas pasan sin detectarse | El almacén se crea con `ValidationSettings.Mode: "OFF"`, de modo que Cedar no valida nombres de entidades ni atributos contra el esquema | `PolicyStore` | Limitación declarada. Las pruebas T03/T09/T12 detectan el efecto |

Observaciones: la política `ReadMyDonations` compara `principal.sub` con un `donorSub` que el propio handler rellena con
el `sub` del token, por lo que su efecto práctico es exigir el grupo `DONANTE`; el aislamiento del historial lo da la
consulta por `donorSub = sub` en el índice. Las reglas de `policies/*.cedar` y de `template.yaml` se mantienen a mano en
dos lugares (riesgo de divergencia; no hay verificación automática).

### Frontera 6: Lambda → DynamoDB

| STRIDE | Amenaza | Control implementado | Dónde vive | Estado |
|---|---|---|---|---|
| E | Una función comprometida lee o escribe más de lo necesario | Un rol por función con acciones y recursos exactos (tabla siguiente); sin `Action: "*"` ni `Resource: "*"` en las políticas propias | Bloques `Policies` de cada `AWS::Serverless::Function` | Despliegue para `ListProjects` (T10, evidencia estática de IAM); Plantilla para el resto |
| T | Doble conteo, transiciones inválidas, repetición de solicitudes | `TransactWriteItems` con condiciones: reserva de clave (`attribute_not_exists(pk)`) y donación en una sola transacción; transición `status = PENDIENTE_SIMULACION AND donorSub = :sub` con incremento del acumulado en la misma transacción; publicación condicionada a `BORRADOR`; importes en céntimos enteros; `ConsistentRead` en lecturas por clave | `create-donation.service.ts`, `simulate-donation.service.ts`, `publish-project.service.ts` | Unitaria (simulada); **pendiente** en vivo (T06–T08) |
| T | Reutilizar una clave de idempotencia con otro cuerpo o de otro usuario | `payloadHash` SHA-256 y clave `sub#createDonation#idempotencyKey`; TTL de 24 h | `create-donation.service.ts`; `IdempotencyTable` | Unitaria; **pendiente** (T06, T07) |
| R | Repudio o manipulación del rastro | Las funciones que escriben auditoría solo tienen `PutItem` sobre `AuditEvents` (sin actualizar ni borrar); actor seudonimizado con SHA-256 truncado; sin tokens ni datos financieros. **Solo se registran eventos `SUCCESS`**: las denegaciones y errores quedan en CloudWatch, y un fallo al escribir la auditoría no bloquea la operación | `create-audit.service.ts`; handlers | Unitaria; limitación declarada |
| I | Divulgación de datos de donantes en vistas públicas | El catálogo y las estadísticas no incluyen donantes; el historial se consulta por `donorSub` y no devuelve ese campo. **Defecto observado en el código**: el detalle público del proyecto (`GET /v1/projects/{id}`) devuelve también `createdBy` (el `sub` del gestor) | `list-projects.service.ts`, `list-donations.service.ts`, `get-project.service.ts` | Unitaria / código; defecto reportado |
| I | Datos en reposo | Cifrado por defecto de DynamoDB con clave propiedad de AWS; no hay PITR ni copias de respaldo (laboratorio desechable) | `Properties` de las tablas | Plantilla |
| D | Saturación o costos | Capacidad bajo demanda; limitación en API Gateway; TTL para registros de idempotencia | Tablas | Plantilla |

Permisos DynamoDB por función (extraídos de `infra/template.yaml`):

| Función | Acciones y recursos | Verified Permissions |
|---|---|---|
| `ListProjectsFunction` | `Query` en el índice `Projects/index/status-createdAt` | No |
| `GetProjectFunction`, `GetProjectStatsFunction` | `GetItem` en `Projects` | No |
| `CreateProjectFunction` | `PutItem` en `Projects` y `AuditEvents` | Sí |
| `PublishProjectFunction` | `GetItem`, `UpdateItem` en `Projects`; `PutItem` en `AuditEvents` | Sí |
| `CreateDonationFunction` | `GetItem` en `Idempotency` y `Projects`; `PutItem` en `Idempotency`, `Donations` y `AuditEvents` | Sí |
| `SimulateDonationFunction` (solo stage `academic`) | `GetItem`, `UpdateItem` en `Donations`; `UpdateItem` en `Projects`; `PutItem` en `AuditEvents` | Sí |
| `ListMyDonationsFunction` | `Query` en el índice `Donations/index/donorSub-createdAt` | Sí |
| `ListAuditLogsFunction` | `Query` en `AuditEvents` y en `AuditEvents/index/AllAuditLogsIndex` | Sí |

Además, todas las funciones reciben el rol administrado `AWSLambdaBasicExecutionRole` para escribir logs. Esa política
administrada no está acotada a los grupos de logs de la pila.

## 3. Mapeo a NIST SP 800-207

### 3.1 Componentes lógicos

| Componente NIST | Implementación | Evidencia |
|---|---|---|
| Policy Enforcement Point (PEP) | Dos puntos de aplicación en serie. **PEP 1**: JWT authorizer de API Gateway (emisor, firma, expiración, `client_id` y scope de la ruta) y, para el sitio, CloudFront (TLS, cabeceras, acceso exclusivo a S3 por OAC). **PEP 2**: el código de cada handler, que aplica la decisión del motor (lanza 403 si no es `ALLOW`) y falla cerrado | `HttpApi`, `FrontendDistribution`, `backend/src/authz/`; T02, T11 |
| Policy Engine (PE) | Amazon Verified Permissions con políticas Cedar; decisión por solicitud con grupo, `sub` y estado del recurso | `PolicyStore`, `policies/*.cedar`; T03, T09, T12 (pendientes) |
| Policy Administrator (PA) | Amazon Cognito: autentica, aplica MFA, emite, renueva y revoca tokens y mantiene los grupos. Los cambios de políticas Cedar los administra CloudFormation | `CognitoUserPool`, `CognitoUserPoolClient`; T13, T14 (pendientes) |
| Fuentes de información | Claims del token; estado del recurso en DynamoDB (propietario, estado del proyecto); logs de acceso de CloudWatch; tabla `AuditEvents`; historial de eventos de CloudTrail (el que AWS activa por defecto; la plantilla no define un trail propio) | `access-log.ts`, `create-audit.service.ts` |

### 3.2 Los siete principios

| # | Principio | Control | Evidencia | Cobertura |
|---|---|---|---|---|
| 1 | Todo dato y servicio es un recurso | Cada ruta tiene autorización explícita (público o scope + política Cedar); cada función tiene su rol y sus tablas | Tabla de permisos por función; T10 | Total |
| 2 | Comunicación segura sin importar la red | HTTPS en CloudFront (redirección y HSTS) y en API Gateway; ningún acceso directo a S3 | CA-NF01.1; 301 a HTTPS y S3 directo 403 observados | Total. El dominio `*.cloudfront.net` usa el certificado por defecto (sin dominio propio) |
| 3 | Acceso por sesión y por recurso | Access token de 15 min, scope por ruta, propietario por recurso (Cedar y condición de DynamoDB) | T09, T11, T13 | Total en diseño; la **revocación inmediata no existe** (ver §5). T09, T11 (ID token) y T13 pendientes |
| 4 | Política dinámica | Decisión por solicitud con identidad, grupo, estado del recurso y stage (la simulación no existe fuera de `academic`) | T03, T12 | Total respecto del diseño; sin atributos de dispositivo ni de riesgo. Pendiente en vivo |
| 5 | Monitorear la integridad y la postura de los activos | CloudTrail (historial por defecto) y `npm audit --audit-level=high` en CI | CI en verde | **Parcial**: sin postura de dispositivo, sin GuardDuty/Security Hub/Config, sin alarmas ni Dependabot configurados |
| 6 | Autenticación y autorización dinámicas y estrictas antes del acceso | JWT authorizer + Verified Permissions + TOTP en roles privilegiados | T02, T11 (mitad con token alterado), T14 | Total en diseño. El TOTP se aplica por usuario y no por claim; T14 y la mitad ID token de T11 pendientes |
| 7 | Recolectar información para mejorar la postura | Logs JSON con `requestId`, eventos de auditoría y CloudTrail | CA-NF07.2 (evidencia en CloudWatch pendiente de capturar) | Total en recolección; no hay análisis ni alertas automáticas |

## 4. Fuera de alcance declarado

- Verificación de postura del dispositivo y evaluación continua del riesgo de sesión.
- ZTNA (AWS Verified Access) y detección gestionada (GuardDuty, Security Hub), no incluidos en el plan Free.
- Pagos reales, conciliación, comprobantes tributarios y verificación legal de la fundación.
- AWS WAF (HTTP API no se integra con WAF; asociarlo a CloudFront consume créditos).
- Dominio propio y certificado propio.

## 5. Limitaciones conocidas

1. **Revocación.** El JWT authorizer valida firma y expiración localmente: un access token revocado funciona hasta
   expirar (≤ 15 min).
2. **Sin postura de dispositivo, evaluación continua de riesgo ni ZTNA.**
3. **HTTP API sin WAF.** La limitación del stage (10 solicitudes/s, ráfaga 20) es la única defensa de tasa.
4. **MFA por usuario, no por claim.** El access token de Cognito no incluye `amr`, por lo que la política de auditoría no
   comprueba MFA. El pool es `MfaConfiguration: OPTIONAL`: un GESTOR o AUDITOR que no haya activado TOTP puede
   autenticarse solo con contraseña hasta que un administrador ejecute `--enforce-mfa`.
5. **Tokens en memoria.** Recargar la página obliga a iniciar sesión de nuevo (decisión por CA-NF11.1).
6. **Almacén de políticas con validación desactivada** (`Mode: "OFF"`); las políticas Cedar están duplicadas entre
   `policies/` y `template.yaml`.
7. **Permisos de logs.** Se usa el rol administrado `AWSLambdaBasicExecutionRole`.
8. **Auditoría.** `AuditEvents` registra solo éxitos; los fallos de escritura de auditoría no bloquean la operación.
9. **Sin registros de acceso** de CloudFront ni S3, sin alarmas de CloudWatch y sin copias de respaldo de DynamoDB.
10. **Autorregistro y PKCE.** La plantilla no restringe el registro de usuarios ni puede imponer PKCE en el app client
    (el cliente lo aplica).
11. **Exposición menor en la API pública.** `GET /v1/projects/{id}` devuelve `createdBy`; `POST
    /v1/donations/{id}/simulate` distingue 404 (no existe) de 403 (ajena), lo que permite comprobar si un identificador
    existe.
12. **Cuenta compartida por el equipo.** El aislamiento entre integrantes depende de IAM y de la disciplina del equipo.
13. **Controles autenticados sin ejecutar.** T03–T09, T12–T14 y la mitad ID token de T11 siguen pendientes.

## 6. Preguntas de discusión

**1. ¿Dónde está el PEP y qué pasa si falla?**
Hay dos puntos de aplicación en serie. El primero es el JWT authorizer de API Gateway, que rechaza sin invocar a Lambda
los tokens ausentes, vencidos, alterados o sin el scope de la ruta (observado: 401 sin token, con token alterado y en
`/v1/audit`). El segundo es el handler, que reverifica el scope y convierte cualquier decisión distinta de `ALLOW` del
motor de políticas en un 403. Para el sitio estático, CloudFront es el único camino a S3 (el acceso directo devuelve
403). Ante una falla, el diseño cierra el acceso: si Verified Permissions no responde o falta su configuración, el
handler devuelve 500 y no ejecuta la operación (prueba unitaria); si el authorizer estuviera mal configurado en una ruta
protegida, el handler rechazaría igualmente con 401 al faltar los claims. Lo que sí se pierde es disponibilidad: sin
Verified Permissions, todas las rutas protegidas fallan, mientras que el catálogo público sigue disponible. El riesgo
principal es de configuración (una ruta marcada `Authorizer: NONE`), que hoy corresponde solo a las tres lecturas
públicas y se vigila con T02 y T11.

**2. ¿Qué principio NIST queda cubierto solo parcialmente?**
El principio 5 (monitorear la integridad y la postura de los activos). Hay CloudTrail y la revisión de dependencias con
`npm audit` en CI, pero no existe verificación de postura de dispositivo, ni GuardDuty o Security Hub, ni AWS Config, ni
alarmas, ni Dependabot configurado. Otros principios tienen matices: el 3 y el 6 son completos en diseño, pero la
revocación inmediata de un access token no es posible y el TOTP se exige por usuario, y el 7 recolecta información pero
no la analiza automáticamente.

**3. ¿Cómo se detectaría una autorización incorrecta generada por IA?**
No basta con la suite unitaria: las pruebas mockean Verified Permissions y DynamoDB, así que no pueden detectar una
política Cedar demasiado permisiva ni una condición de DynamoDB mal escrita. La detección real combina: (a) pruebas
negativas contra el despliegue (T03 donante crea proyecto, T09 donación ajena, T12 gestor consulta historial,
`scripts/acceptance.sh`), que fallan si una política concede de más; (b) la denegación por defecto de Cedar, que hace
que un error por omisión (una política que falta) se manifieste como un 403 inesperado y no como un acceso indebido;
(c) la doble barrera de propiedad (Cedar y `donorSub = :sub` en la transacción), de modo que un error en una sola capa
no basta para romper el aislamiento; (d) revisión humana en el PR por alguien distinto de quien generó el cambio, con
las políticas de `policies/` y de `template.yaml` comparadas entre sí; (e) los logs de acceso y `AuditEvents`, que
permiten detectar a posteriori accesos que no deberían haberse concedido. Con la validación del almacén en `OFF`, un
error de nombre de entidad o de atributo no se rechaza al desplegar: solo lo revelan las pruebas.

**4. ¿Qué cambia si un token robado sigue válido 15 minutos?**
Quien lo posea puede actuar como la víctima durante esa ventana con los permisos de su rol: un donante podría crear y
simular donaciones propias (sin dinero real), un gestor crear y publicar proyectos, y un auditor leer eventos
seudonimizados. El MFA no protege contra esto, porque el token se emite después del segundo factor. Cerrar la sesión o
revocar el refresh token impide renovar el acceso, pero no invalida el access token ya emitido, porque el authorizer no
consulta revocaciones (T13 documenta ese comportamiento, aún por ejecutar). El impacto está acotado por la vida corta,
la limitación de tasa, el aislamiento por propietario (el ladrón de un token de donante no puede gestionar proyectos ni
leer donaciones ajenas) y los eventos de auditoría con `requestId`. El refresh token (1 día) es el activo de mayor
valor; se mantiene solo en memoria y se revoca al cerrar sesión. Una respuesta más fuerte sería un Lambda authorizer con
lista de revocación, con el costo de latencia y de un almacén adicional, que el diseño descarta para este laboratorio.
