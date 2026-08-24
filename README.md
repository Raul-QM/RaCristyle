# RaCristyle

Plataforma SaaS para que barberías, salones de belleza y spas administren su presencia
y reciban reservas en línea. El proyecto implementa los **Sprint 1, 2 y 3**:

- HU-01: registro de dueños, con correo único y contraseña protegida con bcrypt (12 rondas).
- HU-02: inicio de sesión mediante JWT con vigencia de 8 horas.
- HU-03: creación y actualización de la información del negocio.
- HU-04: publicación de servicios, precios y duración.
- HU-05: reserva pública con validación transaccional de disponibilidad.
- HU-06: confirmación por correo con código único y enlace seguro.
- HU-07: agenda privada para consultar y filtrar las citas del negocio.
- HU-08: cancelación administrativa de citas con liberación del horario.
- HU-09: edición segura de los servicios del negocio.

Las cancelaciones requieren un motivo y notifican al cliente por correo. Si la cita fue
cancelada, su enlace de confirmación queda invalidado y muestra ese motivo. Cada negocio también
puede personalizar su página pública mediante logo, colores y fondos.

Cada negocio configura su horario de apertura y cierre. Las reservas se validan tanto
en el navegador como en la API y la duración completa del servicio debe quedar dentro
de la jornada definida.

El dueño también registra su equipo. El cliente selecciona un profesional y recibe
únicamente horarios libres para esa persona; dos profesionales diferentes pueden
atender citas simultáneas.

El teléfono público del negocio enlaza directamente con WhatsApp mediante `wa.me`.
Los números locales de ocho dígitos reciben automáticamente el prefijo de Costa Rica
`506`, mientras que los números internacionales conservan su código de país.

## Confirmación por correo

Una solicitud queda `Pendiente` durante 15 minutos. Nodemailer envía un correo con los
datos de la reserva y un botón de confirmación. El enlace contiene un token aleatorio;
la base de datos almacena únicamente su hash SHA-256.

- Si el cliente confirma a tiempo, la cita cambia a `Confirmada`.
- Mientras está pendiente y vigente, el horario permanece reservado.
- Si vence, la cita se cancela y el horario vuelve a estar disponible.
- El plazo se configura con `BOOKING_CONFIRMATION_MINUTES`.

Para desarrollo use `MAIL_MODE=json`; la interfaz mostrará un botón de simulación. Para
envío real configure SMTP en `.env`:

```env
APP_URL=http://localhost:3000
BOOKING_CONFIRMATION_MINUTES=15
MAIL_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=correo@gmail.com
SMTP_PASS=contraseña-de-aplicacion
MAIL_FROM=RaCristyle <correo@gmail.com>
```

Con Gmail se utiliza una contraseña de aplicación, no la contraseña normal. En un
despliegue real, `APP_URL` debe ser una dirección accesible para el cliente.

## Tecnologías y versiones

| Capa                   | Tecnología                   | Versión         |
| ---------------------- | ---------------------------- | --------------- |
| Entorno de ejecución   | Node.js                      | 22 (>=20.19.0)  |
| Backend y API REST     | Express                      | 5.1.0           |
| Base de datos          | PostgreSQL                   | 16              |
| Controlador PostgreSQL | pg                           | 8.16.3          |
| Validación             | Zod                          | 4.0.14          |
| Autenticación          | jsonwebtoken                 | 9.0.2           |
| Contraseñas            | bcryptjs                     | 3.0.2           |
| Correo electrónico     | Nodemailer                   | 9.0.3           |
| Seguridad HTTP         | Helmet                       | 8.1.0           |
| Límite de solicitudes  | express-rate-limit           | 8.0.1           |
| Archivos               | Multer                       | 2.2.0           |
| Variables de entorno   | dotenv                       | 17.2.1          |
| Frontend               | HTML5, CSS3 y JavaScript ES  | Estándar web    |
| Contenedores           | Docker y Docker Compose      | Compose v2      |
| Calidad                | ESLint / Prettier            | 10.9.0 / 3.9.6  |
| Pruebas                | Node Test Runner / Supertest | Node 22 / 7.2.2 |
| BD de pruebas          | pg-mem                       | 3.0.14          |

## Requisitos

- Node.js 20.19.0 o superior (se recomienda Node.js 22).
- PostgreSQL 16 para ejecución sin Docker.
- Docker Desktop con Docker Compose v2 para la ejecución contenerizada.

## Ejecución local

1. Cree una base de datos PostgreSQL llamada `racristyle`.
2. Copie `.env.example` como `.env` y ajuste `DATABASE_URL` y `JWT_SECRET`.
3. Ejecute:

```bash
npm install
npm run db:migrate
npm start
```

4. Abra `http://localhost:3000`.

### Demo rápida sin instalar PostgreSQL

Para una presentación local puede ejecutar `npm run demo`. Este modo levanta una base
PostgreSQL compatible en memoria y aplica automáticamente las migraciones; los datos se
reinician al cerrar el proceso. La ejecución normal y el despliegue usan PostgreSQL 16.

## Ejecución completa con Docker

Esta opción levanta RaCristyle y PostgreSQL 16 en contenedores. Las migraciones se aplican
automáticamente antes de iniciar la aplicación y la información permanece guardada en el
volumen `racristyle_postgres_data`, aunque se detengan o reinicien los contenedores.

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Abra `http://localhost:3000`. PostgreSQL queda disponible para herramientas locales en
`localhost:5433`, con base `racristyle` y usuario `postgres`.
Los contenedores usan `TZ=America/Costa_Rica` para conservar correctamente las horas de las citas.

Para detener el proyecto sin perder información:

```bash
docker compose down
```

No use `docker compose down -v` salvo que quiera eliminar definitivamente la base de datos
del entorno Docker. Las credenciales y el correo pueden configurarse en `.env`; Compose
reemplaza `DATABASE_URL` para que la aplicación se conecte al servicio `db`.

## API

| Método | Ruta                               | Descripción                                                  |
| ------ | ---------------------------------- | ------------------------------------------------------------ |
| POST   | `/api/auth/register`               | Registra un dueño                                            |
| POST   | `/api/auth/login`                  | Inicia sesión                                                |
| GET    | `/api/auth/me`                     | Recupera la sesión y el negocio                              |
| PUT    | `/api/negocios/me`                 | Crea o actualiza el negocio                                  |
| PUT    | `/api/negocios/me/personalizacion` | Actualiza logo, colores y fondo público                      |
| GET    | `/api/health`                      | Verifica el servidor                                         |
| GET    | `/api/servicios`                   | Lista servicios del negocio                                  |
| POST   | `/api/servicios`                   | Crea un servicio                                             |
| GET    | `/api/public/negocios/:id`         | Muestra negocio y servicios al cliente                       |
| POST   | `/api/public/citas`                | Crea una solicitud de cita pendiente                         |
| POST   | `/api/public/citas/confirmar`      | Confirma una cita mediante token                             |
| GET    | `/api/public/disponibilidad`       | Lista horas libres por profesional                           |
| GET    | `/api/empleados`                   | Lista el equipo del negocio                                  |
| POST   | `/api/empleados`                   | Agrega un profesional                                        |
| GET    | `/api/citas`                       | Lista la agenda privada y permite filtrar por fecha o estado |
| PATCH  | `/api/citas/:id/cancelar`          | Cancela una cita propia pendiente o confirmada               |
| PUT    | `/api/servicios/:id`               | Edita un servicio perteneciente al negocio                   |
| PUT    | `/api/empleados/:id`               | Edita un trabajador perteneciente al negocio                 |

Las rutas privadas requieren `Authorization: Bearer <token>`. La API limita cada IP
a 100 solicitudes por minuto y aplica cabeceras seguras con Helmet.

## Arquitectura y calidad

La aplicación separa rutas HTTP, servicios de negocio y repositorios de acceso a datos. Consulte
[`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) para conocer las responsabilidades de cada capa y
las decisiones técnicas principales.

```bash
npm run quality
```

Este comando valida el código con ESLint, comprueba el formato con Prettier y ejecuta todas las
pruebas automatizadas.

## Evidencia de aceptación

Consulte `docs/SPRINT-1.md`, `docs/SPRINT-2.md` y `docs/SPRINT-3.md` para ver la trazabilidad entre
historias, criterios y pruebas.

## Credenciales de prueba

`npm run db:seed` crea datos de demostración (negocio, servicios y profesionales) junto con una
cuenta de dueño para iniciar sesión en el panel administrativo:

| Campo      | Valor                   |
| ---------- | ----------------------- |
| Correo     | `demo@racristyle.local` |
| Contraseña | `DemoRacri123`          |

El modo demo (`npm run demo`) genera estos mismos datos automáticamente en memoria, sin requerir
instalación previa de PostgreSQL.

## Integrantes y roles Scrum

| Integrante     | GitHub                                               | Rol Scrum |
| -------------- | ---------------------------------------------------- | --------- |
| Raul Q.M       | [@Raul-QM](https://github.com/Raul-QM)               | Developer |
| Cristian Rojas | [@Cristianrm2606](https://github.com/Cristianrm2606) | Developer |

Ambos integrantes participaron durante los tres sprints en análisis, desarrollo, revisión cruzada
entre ramas, pruebas e integración, alternando la implementación de las historias de usuario
HU-01 a HU-09.
