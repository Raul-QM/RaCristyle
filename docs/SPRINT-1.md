# Sprint 1 — Registro e información del negocio

**Meta:** permitir que un dueño cree su cuenta, ingrese de forma segura y configure la
identidad básica de su negocio.

## Historias terminadas

### HU-01 (5 SP) — Registro del dueño

- El formulario valida nombre, formato del correo y fortaleza de contraseña.
- El backend normaliza el correo y rechaza duplicados con HTTP 409.
- La contraseña se almacena con bcrypt y 12 rondas; nunca se devuelve en la respuesta.
- Al registrarse, el usuario recibe una sesión y continúa a la configuración.

### HU-02 (5 SP) — Inicio de sesión

- Las credenciales se contrastan de forma segura con el hash.
- Un acceso válido produce un JWT de ocho horas.
- Credenciales incorrectas responden HTTP 401 sin revelar qué dato falló.
- La sesión persiste al recargar y puede cerrarse desde el panel.

### HU-03 (8 SP) — Configurar el negocio

- El dueño registra nombre, descripción, teléfono y dirección.
- La operación es idempotente: el mismo formulario crea o actualiza el negocio.
- Cada negocio queda relacionado de forma única con su dueño.
- La interfaz ofrece confirmación visual de guardado.

## Definition of Done verificable

- Funciones integradas y sin conflictos.
- Validación tanto en navegador como en servidor.
- Consultas PostgreSQL parametrizadas para evitar inyección SQL.
- Contraseñas con bcrypt (12 rondas) y sesiones JWT.
- Límite de 100 solicitudes por minuto y cabeceras HTTP seguras.
- Interfaz adaptable mediante puntos de corte para escritorio, tableta y móvil.
- Migración versionada en `database/001_sprint1.sql`.
- Instrucciones de ejecución y endpoints documentados en el README.

La aceptación del Product Owner y la revisión presencial del equipo se registran durante
la Sprint Review, porque requieren intervención humana.
