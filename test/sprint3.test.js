import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import request from 'supertest';

process.env.DATABASE_URL = 'memory://';
process.env.JWT_SECRET = 'secreto-de-pruebas-sprint3-racristyle-123456';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const app = createApp();

let token;
let businessId;
let serviceId;
let employeeId;
let firstAppointmentDate;

before(async () => {
  for (const migration of [
    'database/001_sprint1.sql',
    'database/002_sprint2.sql',
    'database/003_horario_negocio.sql',
    'database/004_empleados_disponibilidad.sql',
    'database/005_confirmacion_correo.sql',
    'database/006_dias_atencion.sql',
    'database/007_personalizacion_negocio.sql',
    'database/008_cancelacion_citas.sql',
    'database/009_multiples_negocios.sql',
  ]) {
    await pool.query(await fs.readFile(migration, 'utf8'));
  }

  const owner = await createOwner('Agenda Principal', 'agenda@racristyle.test');
  token = owner.token;
  businessId = owner.businessId;
  serviceId = owner.serviceId;
  employeeId = owner.employeeId;

  const otherOwner = await createOwner('Otro Negocio', 'otro@racristyle.test');
  firstAppointmentDate = futureAt(2, 10);
  await insertAppointment({
    businessId,
    serviceId,
    employeeId,
    customer: 'Ana Cliente',
    state: 'Confirmada',
    code: 'RC-S3A00001',
    start: firstAppointmentDate,
  });
  await insertAppointment({
    businessId,
    serviceId,
    employeeId,
    customer: 'Luis Cliente',
    state: 'Pendiente',
    code: 'RC-S3A00002',
    start: futureAt(3, 11),
  });
  await insertAppointment({
    businessId: otherOwner.businessId,
    serviceId: otherOwner.serviceId,
    employeeId: otherOwner.employeeId,
    customer: 'Cliente Ajeno',
    state: 'Confirmada',
    code: 'RC-S3A00003',
    start: futureAt(2, 12),
  });
});

after(async () => {
  await pool.end();
});

test('HU-07 exige autenticación para consultar la agenda', async () => {
  const response = await request(app).get('/api/citas');
  assert.equal(response.status, 401);
});

test('HU-07 muestra únicamente las citas del negocio autenticado', async () => {
  const response = await request(app).get('/api/citas').set('Authorization', `Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.citas.length, 2);
  assert.deepEqual(
    response.body.citas.map((appointment) => appointment.cliente_nombre),
    ['Ana Cliente', 'Luis Cliente'],
  );
  assert.equal(response.body.citas[0].servicio, 'Servicio Agenda Principal');
  assert.equal(response.body.citas[0].trabajador, 'Trabajador Agenda Principal');
  assert.equal(response.body.resumen.total, 2);
  assert.equal(response.body.resumen.confirmada, 1);
  assert.equal(response.body.resumen.pendiente, 1);
});

test('HU-07 filtra la agenda por estado y fecha', async () => {
  const byState = await request(app)
    .get('/api/citas')
    .query({ estado: 'Pendiente' })
    .set('Authorization', `Bearer ${token}`);
  assert.equal(byState.status, 200);
  assert.equal(byState.body.citas.length, 1);
  assert.equal(byState.body.citas[0].estado, 'Pendiente');

  const byDate = await request(app)
    .get('/api/citas')
    .query({ fecha: localDate(firstAppointmentDate) })
    .set('Authorization', `Bearer ${token}`);
  assert.equal(byDate.status, 200);
  assert.equal(byDate.body.citas.length, 1);
  assert.equal(byDate.body.citas[0].cliente_nombre, 'Ana Cliente');
});

test('HU-08 cancela una cita propia y libera el horario', async () => {
  const appointment = await pool.query(
    "SELECT id_cita FROM cita WHERE codigo_confirmacion = 'RC-S3A00001'",
  );
  const appointmentId = appointment.rows[0].id_cita;
  const cancelled = await request(app)
    .patch(`/api/citas/${appointmentId}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ motivo: 'El trabajador no estará disponible por una emergencia.' });
  assert.equal(cancelled.status, 200);
  assert.equal(cancelled.body.cita.estado, 'Cancelada');
  assert.equal(cancelled.body.correoEnviado, true);
  assert.equal(
    cancelled.body.cita.motivo_cancelacion,
    'El trabajador no estará disponible por una emergencia.',
  );

  const availability = await request(app)
    .get('/api/public/disponibilidad')
    .query({
      negocioId: businessId,
      servicioId: serviceId,
      empleadoId: employeeId,
      fecha: localDate(firstAppointmentDate),
    });
  assert.equal(availability.status, 200);
  assert.ok(availability.body.horarios.some((slot) => slot.valor.endsWith('T10:00:00')));

  const repeated = await request(app)
    .patch(`/api/citas/${appointmentId}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ motivo: 'Se mantiene el motivo de cancelación informado anteriormente.' });
  assert.equal(repeated.status, 409);
});

test('HU-08 no permite cancelar citas de otro negocio', async () => {
  const otherAppointment = await pool.query(
    "SELECT id_cita FROM cita WHERE codigo_confirmacion = 'RC-S3A00003'",
  );
  const response = await request(app)
    .patch(`/api/citas/${otherAppointment.rows[0].id_cita}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ motivo: 'Intento de cancelar una cita perteneciente a otro negocio.' });
  assert.equal(response.status, 404);
  const state = await pool.query(
    "SELECT estado FROM cita WHERE codigo_confirmacion = 'RC-S3A00003'",
  );
  assert.equal(state.rows[0].estado, 'Confirmada');
});

test('la cancelación exige motivo y bloquea el enlace de confirmación', async () => {
  const requested = await request(app)
    .post('/api/public/citas')
    .send({
      negocioId: businessId,
      servicioId: serviceId,
      empleadoId: employeeId,
      clienteNombre: 'Cliente Cancelado',
      clienteEmail: 'cancelado@example.com',
      clienteTelefono: '87776666',
      fechaHora: futureAt(4, 14).toISOString(),
    });
  assert.equal(requested.status, 201);
  const tokenFromEmail = new URL(requested.body.solicitud.enlaceDesarrollo).searchParams.get(
    'token',
  );
  const appointment = await pool.query('SELECT id_cita FROM cita WHERE codigo_confirmacion = $1', [
    requested.body.solicitud.codigo_confirmacion,
  ]);

  const withoutReason = await request(app)
    .patch(`/api/citas/${appointment.rows[0].id_cita}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ motivo: 'Corto' });
  assert.equal(withoutReason.status, 400);

  const reason = 'El local permanecerá cerrado por mantenimiento extraordinario.';
  const cancelled = await request(app)
    .patch(`/api/citas/${appointment.rows[0].id_cita}/cancelar`)
    .set('Authorization', `Bearer ${token}`)
    .send({ motivo: reason });
  assert.equal(cancelled.status, 200);

  const confirmation = await request(app)
    .post('/api/public/citas/confirmar')
    .send({ token: tokenFromEmail });
  assert.equal(confirmation.status, 410);
  assert.equal(confirmation.body.error, 'Tu cita fue cancelada por el negocio.');
  assert.equal(confirmation.body.details.motivo, reason);
});

test('HU-09 edita un servicio propio y actualiza el catálogo público', async () => {
  const updated = await request(app)
    .put(`/api/servicios/${serviceId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      nombre: 'Corte premium actualizado',
      descripcion: 'Incluye corte, lavado y acabado.',
      precio: 7500,
      duracion: 45,
    });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.servicio.nombre, 'Corte premium actualizado');
  assert.equal(Number(updated.body.servicio.precio), 7500);
  assert.equal(updated.body.servicio.duracion_minutos, 45);

  const publicCatalog = await request(app).get(`/api/public/negocios/${businessId}`);
  assert.equal(publicCatalog.status, 200);
  assert.equal(publicCatalog.body.servicios[0].nombre, 'Corte premium actualizado');
  assert.equal(publicCatalog.body.servicios[0].duracion_minutos, 45);
});

test('HU-09 rechaza datos inválidos y servicios de otro negocio', async () => {
  const invalid = await request(app)
    .put(`/api/servicios/${serviceId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'X', precio: 0, duracion: 1 });
  assert.equal(invalid.status, 400);

  const otherService = await pool.query(
    "SELECT id_servicio FROM servicio WHERE nombre = 'Servicio Otro Negocio'",
  );
  const foreign = await request(app)
    .put(`/api/servicios/${otherService.rows[0].id_servicio}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Intento ajeno', precio: 9000, duracion: 60 });
  assert.equal(foreign.status, 404);
});

test('HU-09 edita la información del negocio y sus trabajadores', async () => {
  const business = await request(app)
    .put('/api/negocios/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nombre: 'Agenda Principal Renovada',
      descripcion: 'Descripción comercial actualizada para los clientes.',
      telefono: '88889999',
      direccion: 'Ciudad Quesada',
      horaApertura: '09:00',
      horaCierre: '19:00',
      diasAbiertos: [1, 2, 3, 4, 5, 6],
    });
  assert.equal(business.status, 200);
  assert.equal(business.body.negocio.id_negocio, businessId);
  assert.equal(business.body.negocio.nombre, 'Agenda Principal Renovada');

  const employee = await request(app)
    .put(`/api/empleados/${employeeId}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Trabajador Renovado', especialidad: 'Barbero premium' });
  assert.equal(employee.status, 200);
  assert.equal(employee.body.empleado.nombre, 'Trabajador Renovado');

  const publicPage = await request(app).get(`/api/public/negocios/${businessId}`);
  assert.equal(publicPage.body.negocio.nombre, 'Agenda Principal Renovada');
  assert.equal(publicPage.body.empleados[0].nombre, 'Trabajador Renovado');
});

test('el negocio personaliza colores, fondo y logo de su página pública', async () => {
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const response = await request(app)
    .put('/api/negocios/me/personalizacion')
    .set('Authorization', `Bearer ${token}`)
    .field('fondoTipo', 'personalizado')
    .field('colorPrimario', '#bada55')
    .field('colorSecundario', '#202020')
    .attach('logo', onePixelPng, { filename: 'logo.png', contentType: 'image/png' })
    .attach('fondo', onePixelPng, { filename: 'fondo.png', contentType: 'image/png' });
  assert.equal(response.status, 200);
  assert.equal(response.body.personalizacion.fondo_tipo, 'personalizado');

  const publicPage = await request(app).get(`/api/public/negocios/${businessId}`);
  assert.equal(publicPage.body.negocio.color_primario, '#bada55');
  assert.equal(publicPage.body.negocio.color_secundario, '#202020');
  assert.match(publicPage.body.negocio.logo_data, /^data:image\/png;base64,/);
  assert.match(publicPage.body.negocio.fondo_data, /^data:image\/png;base64,/);
});

test('HU-09 no permite editar trabajadores de otro negocio', async () => {
  const otherEmployee = await pool.query(
    "SELECT id_empleado FROM empleado WHERE nombre = 'Trabajador Otro Negocio'",
  );
  const response = await request(app)
    .put(`/api/empleados/${otherEmployee.rows[0].id_empleado}`)
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Intento ajeno', especialidad: 'No autorizado' });
  assert.equal(response.status, 404);
});

test('HU-09 deshabilita y rehabilita servicios sin borrar su historial', async () => {
  const disabled = await request(app)
    .patch(`/api/servicios/${serviceId}/estado`)
    .set('Authorization', `Bearer ${token}`)
    .send({ activo: false });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.servicio.activo, false);

  const publicWithoutService = await request(app).get(`/api/public/negocios/${businessId}`);
  assert.equal(publicWithoutService.body.servicios.length, 0);
  const history = await pool.query('SELECT COUNT(*) AS total FROM cita WHERE id_servicio = $1', [
    serviceId,
  ]);
  assert.ok(Number(history.rows[0].total) > 0);

  const enabled = await request(app)
    .patch(`/api/servicios/${serviceId}/estado`)
    .set('Authorization', `Bearer ${token}`)
    .send({ activo: true });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.servicio.activo, true);
});

test('HU-09 deshabilita trabajadores para impedir reservas nuevas y permite reactivarlos', async () => {
  const disabled = await request(app)
    .patch(`/api/empleados/${employeeId}/estado`)
    .set('Authorization', `Bearer ${token}`)
    .send({ activo: false });
  assert.equal(disabled.status, 200);
  assert.equal(disabled.body.empleado.activo, false);

  const publicWithoutEmployee = await request(app).get(`/api/public/negocios/${businessId}`);
  assert.equal(publicWithoutEmployee.body.empleados.length, 0);
  const adminEmployees = await request(app)
    .get('/api/empleados')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(adminEmployees.body.empleados[0].activo, false);

  const enabled = await request(app)
    .patch(`/api/empleados/${employeeId}/estado`)
    .set('Authorization', `Bearer ${token}`)
    .send({ activo: true });
  assert.equal(enabled.status, 200);
  assert.equal(enabled.body.empleado.activo, true);
});

async function createOwner(name, email) {
  const register = await request(app).post('/api/auth/register').send({
    nombre: name,
    email,
    password: 'Segura123',
  });
  const ownerToken = register.body.token;
  const business = await request(app)
    .put('/api/negocios/me')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({
      nombre: name,
      descripcion: `Descripción completa de ${name}.`,
      telefono: '88888888',
      direccion: 'San Carlos',
      diasAbiertos: [0, 1, 2, 3, 4, 5, 6],
    });
  const service = await request(app)
    .post('/api/servicios')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ nombre: `Servicio ${name}`, precio: 5000, duracion: 30 });
  const employee = await request(app)
    .post('/api/empleados')
    .set('Authorization', `Bearer ${ownerToken}`)
    .send({ nombre: `Trabajador ${name}`, especialidad: 'Especialista' });
  return {
    token: ownerToken,
    businessId: business.body.negocio.id_negocio,
    serviceId: service.body.servicio.id_servicio,
    employeeId: employee.body.empleado.id_empleado,
  };
}

async function insertAppointment({
  businessId: appointmentBusinessId,
  serviceId: appointmentServiceId,
  employeeId: appointmentEmployeeId,
  customer,
  state,
  code,
  start,
}) {
  const end = new Date(start.getTime() + 30 * 60_000);
  await pool.query(
    `INSERT INTO cita (
       id_negocio, id_servicio, id_empleado, cliente_nombre, cliente_email,
       cliente_telefono, fecha_inicio, fecha_fin, estado, codigo_confirmacion
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      appointmentBusinessId,
      appointmentServiceId,
      appointmentEmployeeId,
      customer,
      `${code.toLowerCase()}@example.com`,
      '88887777',
      start,
      end,
      state,
      code,
    ],
  );
}

function futureAt(daysAhead, hour) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
