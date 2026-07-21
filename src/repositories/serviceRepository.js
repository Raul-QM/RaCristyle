import { query } from '../db.js';

const serviceColumns = 'id_servicio, nombre, descripcion, precio, duracion_minutos, activo';

export async function listServicesByBusiness(businessId) {
  const result = await query(
    `SELECT ${serviceColumns}
     FROM servicio WHERE id_negocio = $1 ORDER BY creado_en DESC`,
    [businessId],
  );
  return result.rows;
}

export async function createService(businessId, service) {
  const result = await query(
    `INSERT INTO servicio (id_negocio, nombre, descripcion, precio, duracion_minutos)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${serviceColumns}`,
    [businessId, service.nombre, service.descripcion, service.precio, service.duracion],
  );
  return result.rows[0];
}

export async function updateService(businessId, serviceId, service) {
  const result = await query(
    `UPDATE servicio
     SET nombre = $1, descripcion = $2, precio = $3, duracion_minutos = $4
     WHERE id_servicio = $5 AND id_negocio = $6
     RETURNING ${serviceColumns}`,
    [service.nombre, service.descripcion, service.precio, service.duracion, serviceId, businessId],
  );
  return result.rows[0] ?? null;
}

export async function setServiceActive(businessId, serviceId, active) {
  const result = await query(
    `UPDATE servicio SET activo = $1
     WHERE id_servicio = $2 AND id_negocio = $3
     RETURNING ${serviceColumns}`,
    [active, serviceId, businessId],
  );
  return result.rows[0] ?? null;
}
