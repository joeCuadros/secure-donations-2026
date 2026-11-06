# SCREEN.md — Pantallas del frontend

| Ruta de frontend | descripcion |
|---|---|
| `/login` | Pantalla de inicio de sesión con formulario de correo electrónico y contraseña, botón para iniciar sesión, enlace para recuperar contraseña y mensajes de validación o error. La autenticación se realiza mediante Amazon Cognito con Authorization Code + PKCE. |
| `/projects` | Catálogo público de proyectos en tarjetas. Cada tarjeta muestra título, finalidad, meta en soles, monto confirmado y botón para ver el detalle. Incluye estado vacío cuando no hay proyectos publicados. |
| `/projects/:projectId` | Detalle de un proyecto con título, descripción, finalidad, meta, monto confirmado, indicador de progreso y botón para iniciar una donación si el usuario inició sesión como DONANTE. |
| `/donations/new/:projectId` | Formulario para registrar una intención de donación al proyecto seleccionado. Incluye monto en soles, validación del mínimo y máximo, botón para continuar y aviso de que no se realizará un cobro real. |
| `/donations/:donationId/simulate` | Pantalla de simulación académica con resumen del proyecto y monto, botones para simular confirmación o rechazo y aviso visible: «Simulación académica: no se ha realizado ningún cobro». |
| `/donations/me` | Historial personal del donante en una tabla o lista con proyecto, fecha, importe y estado de cada donación. Solo muestra registros del usuario autenticado. |
| `/manager/projects/new` | Formulario para que GESTOR registre un proyecto con título, descripción, finalidad y objetivo en soles. Incluye validación y botón para guardar como borrador. |
| `/manager/projects` | Panel de GESTOR con listado de sus proyectos, estado de cada uno y acciones para revisar y publicar proyectos en estado BORRADOR. |
| `/manager/projects/:projectId` | Vista de gestión de un proyecto con sus datos, meta, monto confirmado, estado y acción para publicar cuando cumpla las validaciones. |
| `/auditor/events` | Panel de AUDITOR con tabla de eventos de auditoría, filtros por tipo y rango de fechas, paginación y detalle de actor seudonimizado, acción, recurso, resultado y fecha. |
| `/unauthorized` | Pantalla de acceso denegado que informa que el usuario no tiene permisos para ingresar a la ruta solicitada y ofrece volver al catálogo o a su página principal. |
| `/*` | Pantalla 404 para rutas frontend inexistentes, con mensaje de página no encontrada y enlace para volver al catálogo de proyectos. |
