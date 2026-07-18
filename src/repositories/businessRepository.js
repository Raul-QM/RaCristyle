import { query } from '../db.js';

export async function findBusinessIdByUserId(userId, requestedBusinessId = null) {
  const result = await query(
    `SELECT id_negocio FROM negocio
     WHERE id_usuario = $1 AND ($2::integer IS NULL OR id_negocio = $2)
     ORDER BY id_negocio LIMIT 1`,
    [userId, requestedBusinessId],
  );
  return result.rows[0]?.id_negocio ?? null;
}

export async function createBusiness(userId, business) {
  const result = await query(
    `INSERT INTO negocio (
       id_usuario, nombre, descripcion, telefono, direccion, hora_apertura, hora_cierre,
       dias_abiertos
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      business.nombre,
      business.descripcion,
      business.telefono,
      business.direccion,
      business.horaApertura,
      business.horaCierre,
      business.diasAbiertos.join(','),
    ],
  );
  return result.rows[0];
}

export async function updateBusiness(userId, businessId, business) {
  const result = await query(
    `UPDATE negocio SET nombre = $3, descripcion = $4, telefono = $5, direccion = $6,
       hora_apertura = $7, hora_cierre = $8, dias_abiertos = $9, actualizado_en = NOW()
     WHERE id_usuario = $1 AND id_negocio = $2 RETURNING *`,
    [
      userId,
      businessId,
      business.nombre,
      business.descripcion,
      business.telefono,
      business.direccion,
      business.horaApertura,
      business.horaCierre,
      business.diasAbiertos.join(','),
    ],
  );
  return result.rows[0] ?? null;
}

export async function updateBusinessBranding(userId, businessId, branding) {
  const result = await query(
    `UPDATE negocio
     SET logo_data = COALESCE($2, logo_data),
         fondo_tipo = $3,
         fondo_data = CASE
           WHEN $3 = 'personalizado' THEN COALESCE($4::text, fondo_data)
           ELSE NULL
         END,
         color_primario = $5,
         color_secundario = $6,
         personalizacion_completa = TRUE,
         actualizado_en = NOW()
     WHERE id_usuario = $1 AND id_negocio = $7
       AND ($3 <> 'personalizado' OR $4::text IS NOT NULL OR fondo_data IS NOT NULL)
     RETURNING id_negocio, logo_data, fondo_tipo, fondo_data,
               color_primario, color_secundario, personalizacion_completa`,
    [
      userId,
      branding.logoData,
      branding.fondoTipo,
      branding.fondoData,
      branding.colorPrimario,
      branding.colorSecundario,
      businessId,
    ],
  );
  return result.rows[0] ?? null;
}
