# Sprint 2 — Servicios y reservas funcionales

**Meta:** permitir que el dueño publique servicios y que un cliente reserve un horario
disponible, recibiendo confirmación inmediata.

## Historias terminadas

### HU-04 (8 SP) — Agregar servicios y precios

- El dueño autenticado agrega nombre, descripción, precio y duración.
- Precio y duración se validan en navegador, API y base de datos.
- El catálogo está aislado por negocio y solo muestra servicios activos.
- El panel genera el enlace público de reservas al existir al menos un servicio.

### HU-05 (8 SP) — Reservar una cita

- El cliente consulta información y servicios sin iniciar sesión.
- El formulario solicita servicio, fecha, hora, nombre, teléfono y correo.
- La fecha debe ser futura y el servicio debe pertenecer al negocio.
- El dueño configura una hora de apertura y una hora de cierre.
- La reserva completa, incluida la duración del servicio, debe caber dentro del
  horario de atención; una cita a las 2:00 a. m. es rechazada si el negocio está cerrado.
- El dueño registra los profesionales del negocio y su especialidad.
- El cliente elige servicio, profesional y fecha; el sistema muestra únicamente
  las horas realmente disponibles, en intervalos de 15 minutos.
- La validación detecta solapamientos por profesional usando inicio y fin del servicio.
- Dos profesionales distintos pueden atender citas a la misma hora.
- La verificación y el registro ocurren en una transacción que bloquea el negocio,
  evitando reservas simultáneas para el mismo espacio.
- Un choque de horario devuelve HTTP 409 y solicita elegir otro horario.

### HU-06 (5 SP) — Confirmación de la reserva

- La cita queda creada inicialmente con estado `Pendiente`.
- El cliente recibe por correo servicio, fecha, precio, profesional, código único y
  un botón para confirmar.
- La cita cambia a `Confirmada` únicamente al validar el token del correo.
- El token vence en 15 minutos y en la base de datos se almacena solo su hash SHA-256.
- Mientras está vigente bloquea temporalmente el horario; al vencer, la cita se cancela
  y el espacio vuelve a estar disponible.
- El código usa el formato `RC-XXXXXXXX` y queda almacenado junto con la reserva.
- El teléfono público del negocio abre un enlace real de WhatsApp.
- Después de confirmar, el cliente puede escribir al negocio mediante WhatsApp.

## Definition of Done verificable

- Migración incremental `002_sprint2.sql` con relaciones, restricciones e índices.
- API validada y consultas parametrizadas.
- Pruebas funcionales para creación, validación, reserva, confirmación, tokens inválidos
  y vencidos, liberación de horarios, doble reserva, capacidad con varios profesionales
  y rechazo de citas fuera del horario de atención.
- Diseño adaptable para panel administrativo y página pública de reservas.
- Modo demo ejecutable sin infraestructura con `npm run demo`.
- Documentación técnica y trazabilidad actualizadas.

La aceptación del Product Owner, revisión del compañero y validación presencial en
dispositivo móvil deben registrarse durante la Sprint Review.
