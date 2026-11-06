# TASK.md — Plataforma de Donaciones Seguras (2026)

## Orden de desarrollo

### [ ] 1. Preparar el proyecto e infraestructura AWS
Configurar el repositorio y los entornos de desarrollo. Preparar la cuenta AWS Free plan y desplegar la infraestructura base con AWS SAM: Cognito, API Gateway HTTP API, Lambda, DynamoDB, S3 y CloudFront. Configurar IAM con mínimo privilegio, MFA para los integrantes y AWS Budgets.

### [ ] 2. Desarrollar el backend
Implementar la API REST con Node.js, TypeScript y AWS Lambda. Desarrollar los módulos de proyectos, donaciones, autenticación/autorización y auditoría. Implementar las reglas de negocio, validaciones, control de roles y propietarios, idempotencia, transacciones DynamoDB y simulación de donaciones. Documentar los contratos en `endpoints.md` y la persistencia en `data-model.md`.

### [ ] 3. Desarrollar el frontend
Implementar la SPA con React, TypeScript, Vite y Tailwind CSS. Construir las pantallas descritas en `screen.md`, integrar el inicio de sesión con Cognito y conectar los formularios y vistas con los endpoints del backend. Aplicar diseño responsive y criterios de accesibilidad.

### [ ] 4. Integrar, probar y publicar la plataforma
Integrar frontend, backend e infraestructura AWS. Ejecutar pruebas funcionales y de seguridad, incluyendo los casos T01–T14 de `requirements.md`. Configurar HTTPS, cabeceras de seguridad, logs y auditoría. Preparar la demostración, completar la documentación y eliminar los recursos AWS al finalizar la evaluación.

## Resultado esperado

Plataforma web funcional para consultar proyectos sociales, crear y publicar campañas según el rol, registrar intenciones de donación simuladas, consultar el historial propio y revisar eventos de auditoría. Todas las operaciones protegidas deben aplicar autenticación y autorización en backend bajo el modelo Zero Trust.

**Alcance académico:** las donaciones son simuladas. No se procesan pagos reales ni se almacenan datos de tarjetas o cuentas bancarias.
