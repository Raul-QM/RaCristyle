# Sprint 4 — Despliegue y publicación en Internet

**Meta:** publicar RaCristyle mediante una URL accesible desde Internet, desplegando
el frontend, la API REST y la base de datos en servicios en la nube.

## Historia terminada

### HU-10 (8 SP) — Publicación del sistema mediante una URL accesible desde Internet

- Frontend y backend Express se despliegan en Vercel como función serverless.
- PostgreSQL 16 se despliega en Neon como base de datos administrada.
- Cada negocio tiene una página pública accesible mediante el parámetro `?negocio=<id>`.
- El sistema completo está disponible en una dirección pública estable.
- Las variables de entorno se administran en Vercel y no se almacenan en Git.

### Criterios de aceptación

1. La aplicación está accesible desde cualquier navegador mediante HTTPS.
2. La API REST responde en `/api` con los mismos endpoints que en desarrollo local.
3. La página de reservas de cada negocio se abre con `/reservar.html?negocio=<id>`.
4. Los datos persisten en PostgreSQL 16 después de cada solicitud.
5. Las migraciones se aplican correctamente en la base de datos de producción.
6. El endpoint de salud confirma que el sistema está operativo.

### Implementación técnica

#### Vercel (frontend y backend)

| Componente | Descripción |
| --- | --- |
| Framework | Express 5.1 ejecutado como función serverless |
| Archivos estáticos | Servidos desde `public/` mediante `express.static` |
| Rutas API | Prefijo `/api` manejado por Express en la misma función |
| Dominio | `ra-cristyle.vercel.app` con certificado SSL automático |
| Despliegue | Automático al hacer push a la rama `main` |

Vercel detecta `src/app.js` como punto de entrada y ejecuta Express como función
serverless. La fábrica `createApp()` permanece exportada para pruebas y ejecución local.

#### Neon (PostgreSQL 16)

| Componente | Descripción |
| --- | --- |
| Motor | PostgreSQL 16 |
| Conexión | Pool con SSL habilitado |
| Migraciones | Aplicadas manualmente o al inicio del servidor |
| Zona horaria | America/Costa_Rica |

#### Variables de entorno

Las siguientes variables se configuran en Vercel y en el archivo `.env` para desarrollo
local. Nunca se almacenan valores secretos en el repositorio.

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL |
| `DATABASE_SSL` | Habilita o deshabilita SSL en la conexión |
| `JWT_SECRET` | Clave secreta para firmar tokens JWT (mínimo 32 caracteres en producción) |
| `APP_URL` | Dirección pública de la aplicación |
| `BOOKING_CONFIRMATION_MINUTES` | Minutos de vigencia del enlace de confirmación |
| `MAIL_MODE` | Modo de envío de correo (`smtp` o `json`) |
| `SMTP_HOST` | Servidor SMTP saliente |
| `SMTP_PORT` | Puerto del servidor SMTP |
| `SMTP_SECURE` | Conexión segura SMTP |
| `SMTP_USER` | Usuario del servidor SMTP |
| `SMTP_PASS` | Contraseña del servidor SMTP |
| `MAIL_FROM` | Dirección remitente de los correos |

### Endpoint de salud

```
GET https://ra-cristyle.vercel.app/api/health
```

Respuesta:

```json
{ "status": "ok" }
```

Este endpoint confirma que la función serverless está activa y que la aplicación
responde correctamente.

### Acceso público a cada negocio

La página de reservas de un negocio específico se accede mediante:

```
/reservar.html?negocio=<id>
```

Donde `<id>` es el identificador numérico del negocio. El cliente no necesita
iniciar sesión para ver la información del negocio, los servicios disponibles
y realizar una reserva.

### Smoke tests realizados

Se ejecutaron las siguientes verificaciones manuales contra la aplicación desplegada
en Vercel para confirmar que la HU-10 cumple con todos los criterios:

| Prueba | Resultado |
| --- | --- |
| Página principal carga correctamente | Aprobada |
| Registro de un nuevo dueño funciona | Aprobada |
| Inicio de sesión con credenciales válidas | Aprobada |
| Persistencia de datos al recargar | Aprobada |
| Reserva pública se crea correctamente | Aprobada |
| Correo de confirmación se envía | Aprobada |
| Confirmación de cita mediante enlace | Aprobada |
| Confirmación repetida indica que ya fue confirmada | Aprobada |
| Cancelación con motivo registra el motivo | Aprobada |
| Enlace de cita cancelada informa la cancelación | Aprobada |
| Agenda muestra las citas con filtros | Aprobada |
| Varias reservas para el mismo horario con distintos profesionales | Aprobada |
| Reserva fuera del horario de atención es rechazada | Aprobada |

### Resultado final

**HU-10: Aprobada.** El sistema está publicado, accesible y funcional en producción.

### Docker como alternativa local

Docker Compose permanece como alternativa para ejecución local. No es necesario
durante la presentación si Vercel está disponible. El comando de respaldo:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Los contenedores usan `TZ=America/Costa_Rica` para conservar correctamente las
horas de las citas. PostgreSQL queda disponible en `localhost:5433`.

## Definition of Done verificable

- Frontend y backend desplegados en Vercel con dominio público.
- PostgreSQL 16 operativo en Neon con datos persistentes.
- Endpoint de salud respondiendo con `{ "status": "ok" }`.
- Página de reservas accesible mediante `?negocio=<id>`.
- Variables de entorno configuradas sin exponer valores secretos.
- Smoke tests aprobados contra la aplicación en producción.
- Docker Compose disponible como respaldo local.
- Documentación de los cuatro sprints completa.
