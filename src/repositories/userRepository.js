import { query } from '../db.js';

export async function emailExists(email) {
  const result = await query('SELECT 1 FROM usuario WHERE email = $1', [email]);
  return result.rowCount > 0;
}

export async function createUser({ nombre, email, passwordHash }) {
  const result = await query(
    `INSERT INTO usuario (nombre, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id_usuario, nombre, email, creado_en`,
    [nombre, email, passwordHash],
  );
  return result.rows[0];
}

export async function findUserByEmail(email) {
  const result = await query(
    `SELECT id_usuario, nombre, email, password_hash, creado_en
     FROM usuario WHERE email = $1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findUserProfile(userId, requestedBusinessId = null) {
  const [userResult, businessesResult] = await Promise.all([
    query('SELECT id_usuario, nombre, email FROM usuario WHERE id_usuario = $1', [userId]),
    query(
      `SELECT id_negocio, nombre AS negocio_nombre, descripcion, telefono, direccion,
              hora_apertura, hora_cierre, dias_abiertos, logo_data, fondo_tipo, fondo_data,
              color_primario, color_secundario, personalizacion_completa
       FROM negocio WHERE id_usuario = $1 ORDER BY creado_en, id_negocio`,
      [userId],
    ),
  ]);
  const user = userResult.rows[0];
  if (!user) return null;
  const businesses = businessesResult.rows;
  const selected =
    businesses.find((business) => business.id_negocio === Number(requestedBusinessId)) ||
    businesses[0] ||
    {};
  return {
    ...user,
    ...selected,
    negocios: businesses.map(({ id_negocio, negocio_nombre, personalizacion_completa }) => ({
      id_negocio,
      nombre: negocio_nombre,
      personalizacion_completa,
    })),
  };
}
