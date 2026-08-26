import { query } from '../db.js';

export async function listAppointments(businessId, filters) {
  const values = [businessId];
  const conditions = ['c.id_negocio = $1'];

  if (filters.fecha) {
    const dayStart = new Date(`${filters.fecha}T00:00:00`);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    values.push(dayStart, dayEnd);
    conditions.push(`c.fecha_inicio >= $${values.length - 1}`);
    conditions.push(`c.fecha_inicio < $${values.length}`);
  }
  if (filters.estado) {
    values.push(filters.estado);
    conditions.push(`c.estado = $${values.length}`);
  }

  const result = await query(
    `SELECT c.id_cita, c.cliente_nombre, c.cliente_email, c.cliente_telefono,
            c.fecha_inicio, c.fecha_fin, c.estado, c.codigo_confirmacion,
            c.motivo_cancelacion, c.cancelado_en,
            s.nombre AS servicio, s.precio,
            e.nombre AS trabajador
     FROM cita c
     JOIN servicio s ON s.id_servicio = c.id_servicio
     LEFT JOIN empleado e ON e.id_empleado = c.id_empleado
     WHERE ${conditions.join(' AND ')}
     ORDER BY c.fecha_inicio ASC, c.id_cita ASC`,
    values,
  );
  return result.rows;
}

export async function cancelAppointment(businessId, appointmentId, reason) {
  const result = await query(
    `UPDATE cita
     SET estado = 'Cancelada', motivo_cancelacion = $3, cancelado_en = NOW()
     WHERE id_cita = $1
       AND id_negocio = $2
       AND estado IN ('Pendiente', 'Confirmada')
     RETURNING id_cita, estado, codigo_confirmacion, fecha_inicio,
               cliente_nombre, cliente_email, motivo_cancelacion`,
    [appointmentId, businessId, reason],
  );
  return result.rows[0] ?? null;
}

export async function findCancellationEmailData(businessId, appointmentId) {
  const result = await query(
    `SELECT c.id_cita, c.estado, c.cliente_nombre, c.cliente_email, c.fecha_inicio,
            c.codigo_confirmacion, c.motivo_cancelacion,
            n.nombre AS negocio, n.logo_data, n.fondo_tipo, n.fondo_data,
            n.color_primario, n.color_secundario, u.email AS propietario_email,
            s.nombre AS servicio, e.nombre AS trabajador
     FROM cita c
     JOIN negocio n ON n.id_negocio = c.id_negocio
     JOIN usuario u ON u.id_usuario = n.id_usuario
     JOIN servicio s ON s.id_servicio = c.id_servicio
     LEFT JOIN empleado e ON e.id_empleado = c.id_empleado
     WHERE c.id_cita = $1 AND c.id_negocio = $2`,
    [appointmentId, businessId],
  );
  return result.rows[0] ?? null;
}

export async function markCancellationEmailSent(appointmentId) {
  await query('UPDATE cita SET cancelacion_correo_enviado_en = NOW() WHERE id_cita = $1', [
    appointmentId,
  ]);
}

export async function findAppointmentState(businessId, appointmentId) {
  const result = await query('SELECT estado FROM cita WHERE id_cita = $1 AND id_negocio = $2', [
    appointmentId,
    businessId,
  ]);
  return result.rows[0]?.estado ?? null;
}
