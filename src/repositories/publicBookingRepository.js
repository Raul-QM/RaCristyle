import { pool, query } from '../db.js';

/**
 * Ejecuta una unidad de trabajo atómica y garantiza liberar la conexión.
 * @param {(client: import('pg').PoolClient) => Promise<unknown>} work
 * @returns {Promise<unknown>} Resultado producido dentro de la transacción.
 */
export async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw error;
  } finally {
    client.release();
  }
}

export async function findPublicBusiness(businessId) {
  const [business, services, employees] = await Promise.all([
    query(
      `SELECT id_negocio, nombre, descripcion, telefono, direccion,
              hora_apertura, hora_cierre, dias_abiertos, logo_data,
              fondo_tipo, fondo_data, color_primario, color_secundario,
              personalizacion_completa
       FROM negocio WHERE id_negocio = $1`,
      [businessId],
    ),
    query(
      `SELECT id_servicio, nombre, descripcion, precio, duracion_minutos
       FROM servicio WHERE id_negocio = $1 AND activo = TRUE ORDER BY nombre`,
      [businessId],
    ),
    query(
      `SELECT id_empleado, nombre, especialidad
       FROM empleado WHERE id_negocio = $1 AND activo = TRUE ORDER BY nombre`,
      [businessId],
    ),
  ]);
  if (!business.rowCount) return null;
  return { negocio: business.rows[0], servicios: services.rows, empleados: employees.rows };
}

export async function findAvailabilityContext({ negocioId, servicioId, empleadoId }) {
  const [business, service, employee] = await Promise.all([
    query('SELECT hora_apertura, hora_cierre, dias_abiertos FROM negocio WHERE id_negocio = $1', [
      negocioId,
    ]),
    query(
      `SELECT duracion_minutos FROM servicio
       WHERE id_servicio = $1 AND id_negocio = $2 AND activo = TRUE`,
      [servicioId, negocioId],
    ),
    query(
      `SELECT id_empleado FROM empleado
       WHERE id_empleado = $1 AND id_negocio = $2 AND activo = TRUE`,
      [empleadoId, negocioId],
    ),
  ]);
  return {
    business: business.rows[0] ?? null,
    service: service.rows[0] ?? null,
    employee: employee.rows[0] ?? null,
  };
}

export async function expirePendingAppointments(employeeId) {
  await query(
    `UPDATE cita SET estado = 'Cancelada'
     WHERE id_empleado = $1 AND estado = 'Pendiente' AND confirmacion_expira <= NOW()`,
    [employeeId],
  );
}

export async function listOccupiedIntervals(employeeId, dayStart, dayEnd) {
  const result = await query(
    `SELECT fecha_inicio, fecha_fin FROM cita
     WHERE id_empleado = $1
       AND (estado = 'Confirmada' OR (estado = 'Pendiente' AND confirmacion_expira > NOW()))
       AND fecha_inicio >= $2 AND fecha_inicio <= $3`,
    [employeeId, dayStart, dayEnd],
  );
  return result.rows;
}

export async function findAppointmentByTokenForUpdate(client, tokenHash) {
  const result = await client.query(
    `SELECT c.id_cita, c.estado, c.confirmacion_expira, c.codigo_confirmacion,
            c.fecha_inicio, c.cliente_nombre, c.cliente_telefono, c.motivo_cancelacion,
            s.nombre AS servicio,
            e.nombre AS profesional, n.nombre AS negocio, n.telefono AS negocio_telefono,
            n.logo_data, n.fondo_tipo, n.fondo_data, n.color_primario, n.color_secundario
     FROM cita c
     JOIN servicio s ON s.id_servicio = c.id_servicio
     JOIN empleado e ON e.id_empleado = c.id_empleado
     JOIN negocio n ON n.id_negocio = c.id_negocio
     WHERE c.token_confirmacion_hash = $1
     FOR UPDATE`,
    [tokenHash],
  );
  return result.rows[0] ?? null;
}

export async function updateAppointmentStatus(client, appointmentId, status) {
  const result = await client.query(
    `UPDATE cita
     SET estado = $2::varchar,
         confirmado_en = CASE WHEN $2::varchar = 'Confirmada' THEN NOW() ELSE confirmado_en END
     WHERE id_cita = $1
     RETURNING id_cita, estado, codigo_confirmacion, fecha_inicio`,
    [appointmentId, status],
  );
  return result.rows[0];
}

export async function findEmployeeAndBusinessForUpdate(client, employeeId, businessId) {
  const result = await client.query(
    `SELECT e.id_empleado, e.nombre AS empleado_nombre,
            n.nombre AS negocio_nombre, n.hora_apertura, n.hora_cierre, n.dias_abiertos,
            n.logo_data, n.fondo_tipo, n.fondo_data, n.color_primario, n.color_secundario,
            u.email AS propietario_email
     FROM empleado e
     JOIN negocio n ON n.id_negocio = e.id_negocio
     JOIN usuario u ON u.id_usuario = n.id_usuario
     WHERE e.id_empleado = $1 AND e.id_negocio = $2 AND e.activo = TRUE
     FOR UPDATE`,
    [employeeId, businessId],
  );
  return result.rows[0] ?? null;
}

export async function findActiveService(client, serviceId, businessId) {
  const result = await client.query(
    `SELECT id_servicio, nombre, precio, duracion_minutos
     FROM servicio WHERE id_servicio = $1 AND id_negocio = $2 AND activo = TRUE`,
    [serviceId, businessId],
  );
  return result.rows[0] ?? null;
}

export async function hasAppointmentCollision(client, employeeId, start, end) {
  const result = await client.query(
    `SELECT 1 FROM cita
     WHERE id_empleado = $1
       AND (estado = 'Confirmada' OR (estado = 'Pendiente' AND confirmacion_expira > NOW()))
       AND fecha_inicio < $3 AND fecha_fin > $2
     LIMIT 1`,
    [employeeId, start, end],
  );
  return result.rowCount > 0;
}

export async function insertPendingAppointment(client, booking) {
  const result = await client.query(
    `INSERT INTO cita (
       id_negocio, id_servicio, id_empleado, cliente_nombre, cliente_email,
       cliente_telefono, fecha_inicio, fecha_fin, codigo_confirmacion,
       estado, token_confirmacion_hash, confirmacion_expira
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Pendiente', $10, $11)
     RETURNING id_cita, cliente_nombre, cliente_email, cliente_telefono,
               fecha_inicio, fecha_fin, estado, codigo_confirmacion, confirmacion_expira`,
    [
      booking.negocioId,
      booking.servicioId,
      booking.empleadoId,
      booking.clienteNombre,
      booking.clienteEmail,
      booking.clienteTelefono,
      booking.start,
      booking.end,
      booking.confirmationCode,
      booking.confirmationTokenHash,
      booking.confirmationExpires,
    ],
  );
  return result.rows[0];
}

export async function markConfirmationEmailSent(appointmentId) {
  await query('UPDATE cita SET correo_enviado_en = NOW() WHERE id_cita = $1', [appointmentId]);
}

export async function cancelAppointmentAfterMailFailure(appointmentId) {
  await query("UPDATE cita SET estado = 'Cancelada' WHERE id_cita = $1", [appointmentId]);
}
