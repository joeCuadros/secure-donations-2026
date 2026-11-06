# ENDPOINTS.md — Contrato de la API

**Base URL:** `https://{api-domain}/{stage}/v1`  
**Formato:** JSON (`Content-Type: application/json`)  
**Autenticación:** `Authorization: Bearer <Cognito access_token>` en rutas protegidas.  
**Identidad:** `sub` y grupos se obtienen de los claims verificados; nunca del body.  
**Moneda:** `PEN`. Los importes se envían como enteros en céntimos: `100` equivale a S/ 1.00.

## 1. Proyectos

### GET `/v1/projects`
**Acceso:** público.

**Entrada**
- Query opcional: `limit` (entero, máximo definido por el backend), `nextToken` (token de paginación).

**Respuesta 200**
```json
{
  "items": [
    {
      "projectId": "prj_01HXYZ",
      "title": "Biblioteca comunitaria",
      "purpose": "Implementar una biblioteca para escolares",
      "goalAmountCents": 500000,
      "confirmedAmountCents": 125000,
      "currency": "PEN",
      "status": "PUBLICADO",
      "createdAt": "2026-11-05T15:30:00.000Z"
    }
  ],
  "nextToken": null
}
```
**Reglas:** solo devuelve proyectos `PUBLICADO`; nunca incluye proyectos en borrador ni información personal de donantes.

### GET `/v1/projects/{projectId}`
**Acceso:** público.

**Entrada**
- Path: `projectId` (string).

**Respuesta 200**
```json
{
  "projectId": "prj_01HXYZ",
  "title": "Biblioteca comunitaria",
  "description": "Implementación de una biblioteca y espacio de lectura.",
  "purpose": "Mejorar el acceso a recursos educativos.",
  "goalAmountCents": 500000,
  "confirmedAmountCents": 125000,
  "currency": "PEN",
  "status": "PUBLICADO",
  "createdAt": "2026-11-05T15:30:00.000Z",
  "updatedAt": "2026-11-05T16:00:00.000Z",
  "publishedAt": "2026-11-05T16:00:00.000Z"
}
```
**Reglas:** si el proyecto no existe o no está publicado, responde `404`.

### GET `/v1/projects/{projectId}/stats`
**Acceso:** público.

**Entrada**
- Path: `projectId` (string).

**Respuesta 200**
```json
{
  "projectId": "prj_01HXYZ",
  "goalAmountCents": 500000,
  "confirmedAmountCents": 125000,
  "currency": "PEN",
  "progress": 25
}
```
**Reglas:** `progress` es el porcentaje de avance calculado en backend. Solo usa montos confirmados y no expone donantes ni donaciones individuales. Proyecto inexistente o no publicado: `404`.

### POST `/v1/projects`
**Acceso:** grupo `GESTOR`, scope `api/projects.write`.

**Headers**
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Entrada JSON**
```json
{
  "title": "Biblioteca comunitaria",
  "description": "Implementación de una biblioteca y espacio de lectura.",
  "purpose": "Mejorar el acceso a recursos educativos.",
  "goalAmountCents": 500000
}
```

**Respuesta 201**
```json
{
  "projectId": "prj_01HXYZ",
  "title": "Biblioteca comunitaria",
  "description": "Implementación de una biblioteca y espacio de lectura.",
  "purpose": "Mejorar el acceso a recursos educativos.",
  "goalAmountCents": 500000,
  "confirmedAmountCents": 0,
  "currency": "PEN",
  "status": "BORRADOR",
  "createdAt": "2026-11-05T15:30:00.000Z"
}
```
**Reglas:** `goalAmountCents` debe ser un entero positivo. El backend asigna `createdBy` desde el `sub` autenticado y establece el estado inicial `BORRADOR`. No se aceptan `status`, `createdBy` ni `confirmedAmountCents` enviados por el cliente.

### PATCH `/v1/projects/{projectId}/publish`
**Acceso:** grupo `GESTOR`, scope `api/projects.write`.

**Entrada**
- Path: `projectId` (string).
- Body: vacío; no se reciben atributos modificables desde el cliente.

**Respuesta 200**
```json
{
  "projectId": "prj_01HXYZ",
  "status": "PUBLICADO",
  "publishedAt": "2026-11-05T16:00:00.000Z",
  "updatedAt": "2026-11-05T16:00:00.000Z"
}
```
**Reglas:** solo publica proyectos válidos en estado `BORRADOR`. Proyecto inexistente: `404`. Proyecto ya publicado o transición no permitida: `409`.

## 2. Donaciones

### POST `/v1/donations`
**Acceso:** grupo `DONANTE`, scope `api/donations.write`.

**Headers**
```http
Authorization: Bearer <access_token>
Content-Type: application/json
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
```

**Entrada JSON**
```json
{
  "projectId": "prj_01HXYZ",
  "amountCents": 2500
}
```

**Respuesta 201**
```json
{
  "donationId": "don_01HABC",
  "projectId": "prj_01HXYZ",
  "amountCents": 2500,
  "currency": "PEN",
  "status": "PENDIENTE_SIMULACION",
  "createdAt": "2026-11-05T17:00:00.000Z"
}
```
**Reglas:**
- `amountCents` debe ser entero entre `100` y `100000`.
- El proyecto debe existir y estar `PUBLICADO`.
- `donorSub` se obtiene del `sub` autenticado y no se acepta en el body.
- `Idempotency-Key` es obligatorio y debe ser UUID.
- La reserva de idempotencia y la creación de la donación ocurren en un único `TransactWriteItems`.
- Misma clave y mismo payload: se devuelve la respuesta original. Misma clave con payload distinto: `409`.
- Proyecto inexistente: `404`; proyecto no publicado: `409`; datos inválidos o falta de cabecera: `400`.

### POST `/v1/donations/{donationId}/simulate`
**Acceso:** grupo `DONANTE`, scope `api/donations.write`, propietario de la donación. **Disponible únicamente en el stage `academic`.**

**Entrada JSON**
```json
{
  "result": "CONFIRMADA_SIMULADA"
}
```
Los valores permitidos para `result` son `CONFIRMADA_SIMULADA` y `RECHAZADA_SIMULADA`.

**Respuesta 200 — confirmada**
```json
{
  "donationId": "don_01HABC",
  "status": "CONFIRMADA_SIMULADA",
  "updatedAt": "2026-11-05T17:05:00.000Z"
}
```

**Respuesta 200 — rechazada**
```json
{
  "donationId": "don_01HABC",
  "status": "RECHAZADA_SIMULADA",
  "updatedAt": "2026-11-05T17:05:00.000Z"
}
```
**Reglas:** solo el propietario puede simular su donación y solo desde `PENDIENTE_SIMULACION`. El cambio de estado y el incremento del acumulado del proyecto se realizan en una transacción condicionada. Una solicitud repetida o transición inválida responde `409`. Una donación rechazada no incrementa el acumulado. Fuera del stage `academic`, esta ruta no debe desplegarse.

### GET `/v1/donations/me`
**Acceso:** grupo `DONANTE`, scope `api/donations.read`.

**Entrada**
- Query opcional: `limit`, `nextToken`.
- No acepta `donorSub` como parámetro.

**Respuesta 200**
```json
{
  "items": [
    {
      "donationId": "don_01HABC",
      "projectId": "prj_01HXYZ",
      "amountCents": 2500,
      "currency": "PEN",
      "status": "CONFIRMADA_SIMULADA",
      "createdAt": "2026-11-05T17:00:00.000Z",
      "updatedAt": "2026-11-05T17:05:00.000Z"
    }
  ],
  "nextToken": null
}
```
**Reglas:** consulta únicamente donaciones cuyo `donorSub` coincide con el `sub` autenticado.

## 3. Auditoría

### GET `/v1/audit`
**Acceso:** grupo `AUDITOR`, scope `api/audit.read`, usuario con MFA TOTP.

**Entrada**
- Query: `eventType` (opcional), `from` y `to` (fechas ISO 8601), `limit` y `nextToken` (paginación).

**Respuesta 200**
```json
{
  "items": [
    {
      "timestamp": "2026-11-05T17:05:00.000Z",
      "requestId": "req_01HREQ",
      "actorRef": "actor_7f3a",
      "action": "DONATION_SIMULATED",
      "resourceRef": "don_01HABC",
      "outcome": "SUCCESS"
    }
  ],
  "nextToken": null
}
```
**Reglas:** permite filtrar por tipo y rango de fechas. Solo AUDITOR puede consultar. No devuelve tokens, secretos, claves de idempotencia ni datos financieros sensibles.

## 4. Respuestas de error

Todas las rutas usan el mismo formato:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "El monto debe ser un entero entre 100 y 100000.",
  "requestId": "req_01HREQ"
}
```

| HTTP | `code` de referencia | Cuándo se utiliza |
|---|---|---|
| 400 | `VALIDATION_ERROR` | JSON inválido, campos requeridos ausentes, UUID inválido o monto fuera de límites. |
| 401 | `UNAUTHORIZED` | Token ausente, expirado, alterado, ID token usado como access token o `client_id` incorrecto. |
| 403 | `FORBIDDEN` | Rol insuficiente o usuario sin permiso para el recurso. |
| 404 | `NOT_FOUND` | Proyecto o donación inexistente; también se usa para no revelar recursos ajenos. |
| 409 | `CONFLICT` | Estado incompatible, clave idempotente reutilizada con otro payload o transición repetida. |
| 500 | `INTERNAL_ERROR` | Error inesperado; no se devuelve stack trace ni información interna. |

**Nota:** los nombres de propiedades y ejemplos JSON de este documento constituyen el contrato propuesto para la implementación; mantenerlos consistentes en backend, frontend y OpenAPI.
