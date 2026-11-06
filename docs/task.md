# TASK.md — Plataforma de Donaciones Seguras (2026)

### [ ] 1. Preparar el proyecto
- [ ] 1.1 Crear el proyecto con React, TypeScript y Vite.
- [ ] 1.2 Configurar Tailwind CSS y las herramientas de desarrollo.
- [ ] 1.3 Organizar las carpetas de frontend, backend e infraestructura.
- [ ] 1.4 Preparar los comandos para ejecutar y compilar la aplicación.

### [ ] 2. Configurar los servicios de AWS
- [ ] 2.1 Preparar la cuenta y región de AWS.
- [ ] 2.2 Configurar Cognito, API Gateway, Lambda y DynamoDB.
- [ ] 2.3 Crear los recursos mediante AWS SAM.
- [ ] 2.4 Configurar permisos mínimos y control de costos.

### [ ] 3. Implementar autenticación y seguridad Zero Trust
- [ ] 3.1 Configurar el inicio y cierre de sesión con Amazon Cognito.
- [ ] 3.2 Definir los perfiles de visitante, donante, gestor y auditor.
- [ ] 3.3 Validar la identidad y los permisos en cada operación protegida.
- [ ] 3.4 Verificar la propiedad de los datos y bloquear accesos no autorizados.

### [ ] 4. Desarrollar la gestión de campañas
- [ ] 4.1 Crear y consultar campañas.
- [ ] 4.2 Permitir que los gestores creen y publiquen campañas.
- [ ] 4.3 Mostrar únicamente campañas publicadas en el catálogo público.
- [ ] 4.4 Mostrar el objetivo y el monto recaudado de cada campaña.

### [ ] 5. Desarrollar las donaciones simuladas
- [ ] 5.1 Permitir que los donantes registren una intención de donación.
- [ ] 5.2 Validar la campaña y el monto ingresado.
- [ ] 5.3 Simular la confirmación o el rechazo de la donación.
- [ ] 5.4 Evitar registros duplicados y actualizar los acumulados correctamente.
- [ ] 5.5 Permitir que cada donante consulte únicamente su historial.

### [ ] 6. Construir la interfaz web
- [ ] 6.1 Crear las páginas de inicio y catálogo de campañas.
- [ ] 6.2 Crear las pantallas de inicio de sesión y registro de donaciones.
- [ ] 6.3 Crear las vistas de historial y administración de campañas.
- [ ] 6.4 Mostrar mensajes de confirmación, error y aviso de simulación.

### [ ] 7. Publicar y supervisar la aplicación
- [ ] 7.1 Publicar el frontend en S3 y distribuirlo mediante CloudFront.
- [ ] 7.2 Configurar HTTPS y mantener privado el bucket S3.
- [ ] 7.3 Registrar la actividad del backend en CloudWatch.
- [ ] 7.4 Revisar los eventos de seguridad y actividad en AWS.

### [ ] 8. Probar y finalizar el proyecto
- [ ] 8.1 Probar el acceso según los perfiles y permisos.
- [ ] 8.2 Probar la creación de campañas y las donaciones simuladas.
- [ ] 8.3 Verificar que no existan accesos indebidos ni donaciones duplicadas.
- [ ] 8.4 Actualizar la documentación y preparar la demostración.
- [ ] 8.5 Eliminar los recursos de AWS que no sean necesarios.
