import bcrypt from 'bcryptjs';
import { pathToFileURL } from 'node:url';
import { pool } from '../src/db.js';

const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@racristyle.local';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'DemoRacri123';

function nextDateAt(daysAhead, hour, minutes = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, minutes, 0, 0);
  return date;
}

async function findOrCreateUser(client) {
  const existing = await client.query('SELECT id_usuario FROM usuario WHERE email = $1', [
    DEMO_EMAIL,
  ]);
  if (existing.rowCount) return existing.rows[0].id_usuario;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const result = await client.query(
    `INSERT INTO usuario (nombre, email, password_hash)
     VALUES ($1, $2, $3) RETURNING id_usuario`,
    ['Dueño de demostración', DEMO_EMAIL, passwordHash],
  );
  return result.rows[0].id_usuario;
}

async function findOrCreateBusiness(client, userId) {
  const existing = await client.query(
    'SELECT id_negocio FROM negocio WHERE id_usuario = $1 AND nombre = $2',
    [userId, 'Barbería RaCristyle Demo'],
  );
  if (existing.rowCount) return existing.rows[0].id_negocio;

  const result = await client.query(
    `INSERT INTO negocio (
       id_usuario, nombre, descripcion, telefono, direccion, hora_apertura, hora_cierre,
       dias_abiertos, fondo_tipo, color_primario, color_secundario, personalizacion_completa
     ) VALUES ($1, $2, $3, $4, $5, '08:00', '18:00', '0,1,2,3,4,5,6',
               'arena', '#d9ff43', '#171713', TRUE)
     RETURNING id_negocio`,
    [
      userId,
      'Barbería RaCristyle Demo',
      'Negocio de demostración con servicios, trabajadores y citas de ejemplo.',
      '8888-1111',
      'Ciudad Quesada, San Carlos',
    ],
  );
  return result.rows[0].id_negocio;
}

async function findOrCreateService(client, businessId, service) {
  const existing = await client.query(
    'SELECT id_servicio FROM servicio WHERE id_negocio = $1 AND nombre = $2',
    [businessId, service.nombre],
  );
  if (existing.rowCount) return existing.rows[0].id_servicio;

  const result = await client.query(
    `INSERT INTO servicio (id_negocio, nombre, descripcion, precio, duracion_minutos)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_servicio`,
    [businessId, service.nombre, service.descripcion, service.precio, service.duracion],
  );
  return result.rows[0].id_servicio;
}

async function findOrCreateEmployee(client, businessId, employee) {
  const existing = await client.query(
    'SELECT id_empleado FROM empleado WHERE id_negocio = $1 AND nombre = $2',
    [businessId, employee.nombre],
  );
  if (existing.rowCount) return existing.rows[0].id_empleado;

  const result = await client.query(
    `INSERT INTO empleado (id_negocio, nombre, especialidad)
     VALUES ($1, $2, $3) RETURNING id_empleado`,
    [businessId, employee.nombre, employee.especialidad],
  );
  return result.rows[0].id_empleado;
}

async function createAppointmentIfMissing(client, appointment) {
  const existing = await client.query('SELECT 1 FROM cita WHERE codigo_confirmacion = $1', [
    appointment.codigo,
  ]);
  if (existing.rowCount) return;

  await client.query(
    `INSERT INTO cita (
       id_negocio, id_servicio, id_empleado, cliente_nombre, cliente_email,
       cliente_telefono, fecha_inicio, fecha_fin, estado, codigo_confirmacion,
       token_confirmacion_hash, confirmacion_expira, confirmado_en
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::varchar, $10, NULL, NULL,
               CASE WHEN $9::varchar = 'Confirmada' THEN NOW() ELSE NULL END)`,
    [
      appointment.businessId,
      appointment.serviceId,
      appointment.employeeId,
      appointment.customer,
      appointment.email,
      appointment.phone,
      appointment.start,
      appointment.end,
      appointment.status,
      appointment.codigo,
    ],
  );
}

export async function seedDemoData({ databasePool = pool, closePool = true } = {}) {
  const client = await databasePool.connect();
  try {
    await client.query('BEGIN');
    const userId = await findOrCreateUser(client);
    const businessId = await findOrCreateBusiness(client, userId);
    const classicCutId = await findOrCreateService(client, businessId, {
      nombre: 'Corte clásico',
      descripcion: 'Corte de cabello personalizado.',
      precio: 6000,
      duracion: 30,
    });
    await findOrCreateService(client, businessId, {
      nombre: 'Corte con barba',
      descripcion: 'Corte de cabello y arreglo completo de barba.',
      precio: 9000,
      duracion: 45,
    });
    const mateoId = await findOrCreateEmployee(client, businessId, {
      nombre: 'Mateo Vargas',
      especialidad: 'Barbero',
    });
    await findOrCreateEmployee(client, businessId, {
      nombre: 'Tomás Rojas',
      especialidad: 'Barbero y estilista',
    });

    const confirmedStart = nextDateAt(1, 10);
    const completedStart = nextDateAt(-1, 15);
    await createAppointmentIfMissing(client, {
      businessId,
      serviceId: classicCutId,
      employeeId: mateoId,
      customer: 'Andrea Jiménez',
      email: 'andrea@example.com',
      phone: '88882222',
      start: confirmedStart,
      end: new Date(confirmedStart.getTime() + 30 * 60_000),
      status: 'Confirmada',
      codigo: 'RC-DEMO0001',
    });
    await createAppointmentIfMissing(client, {
      businessId,
      serviceId: classicCutId,
      employeeId: mateoId,
      customer: 'Carlos Méndez',
      email: 'carlos@example.com',
      phone: '88883333',
      start: completedStart,
      end: new Date(completedStart.getTime() + 30 * 60_000),
      status: 'Completada',
      codigo: 'RC-DEMO0002',
    });
    await client.query('COMMIT');

    console.log('Datos de demostración preparados correctamente.');
    console.log(`Usuario: ${DEMO_EMAIL}`);
    console.log(`Contraseña: ${DEMO_PASSWORD}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    if (closePool) await databasePool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await seedDemoData();
}
