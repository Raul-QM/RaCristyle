# Sprint 3

## HU-07 — Visualizar citas programadas

Como administrador, quiero visualizar todas las citas programadas para gestionar la
agenda.

### Implementación

- Se agregó una sección privada **Agenda** al panel administrativo.
- La agenda muestra fecha, horario de inicio y fin, cliente, contacto, servicio,
  trabajador, precio, código y estado.
- Las citas se ordenan cronológicamente.
- El administrador puede filtrar por fecha y por estado.
- El resumen indica citas totales, pendientes y confirmadas del filtro actual.
- La API obtiene el negocio desde el JWT; nunca acepta un identificador de negocio
  proporcionado por el navegador para esta consulta.

### API

`GET /api/citas`

Filtros opcionales:

- `fecha=AAAA-MM-DD`
- `estado=Pendiente|Confirmada|Cancelada|Completada`

### Pruebas

La suite comprueba que:

1. La agenda requiere autenticación.
2. Cada dueño visualiza únicamente citas de su negocio.
3. Los filtros de fecha y estado funcionan correctamente.

## HU-08 — Cancelar citas

Como administrador, quiero cancelar citas cuando sea necesario.

### Implementación

- Las citas pendientes o confirmadas muestran la acción **Cancelar cita**.
- La API valida el JWT y la pertenencia de la cita al negocio autenticado.
- Una cita cancelada libera inmediatamente el horario para nuevas reservas.
- No se permite cancelar nuevamente una cita cancelada ni modificar una cita completada.
- La agenda actualiza el estado y sus contadores después de la cancelación.

### API

`PATCH /api/citas/:id/cancelar`

## HU-09 — Editar información administrativa

La historia solicita editar los servicios ofrecidos. Para completar el flujo
administrativo, la misma experiencia permite actualizar también el negocio y sus
trabajadores.

### Implementación

- Cada servicio del catálogo administrativo incluye la acción **Editar**.
- El formulario carga el nombre, descripción, precio y duración actuales.
- La API valida los mismos límites utilizados al crear un servicio.
- Solo el dueño del negocio puede modificar sus propios servicios.
- Los cambios se reflejan inmediatamente en el catálogo administrativo y público.
- El formulario del negocio cambia explícitamente a **Editar negocio** después de su
  creación y conserva el mismo registro.
- Cada trabajador incluye una acción **Editar** para modificar nombre y especialidad.
- Agregar un servicio o trabajador no obliga a avanzar: se puede registrar varios y
  luego usar el botón **Continuar**.
- Servicios y trabajadores pueden deshabilitarse sin borrar el historial de citas.
- Los elementos deshabilitados desaparecen de la reserva pública, permanecen en el
  panel administrativo y pueden habilitarse nuevamente.

### API

`PUT /api/servicios/:id`

`PUT /api/negocios/me`

`PUT /api/empleados/:id`

`PATCH /api/servicios/:id/estado`

`PATCH /api/empleados/:id/estado`
