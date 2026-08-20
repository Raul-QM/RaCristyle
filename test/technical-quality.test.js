import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import request from 'supertest';

process.env.DATABASE_URL = 'memory://';
process.env.JWT_SECRET = 'secreto-de-pruebas-racristyle-123456789';
process.env.MAIL_MODE = 'json';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const { seedDemoData } = await import('../scripts/seed.js');
const app = createApp();

before(async () => {
  const migrations = (await fs.readdir('database')).filter((file) => file.endsWith('.sql')).sort();
  for (const migration of migrations) {
    await pool.query(await fs.readFile(`database/${migration}`, 'utf8'));
  }
});

after(async () => {
  await pool.end();
});

async function prepareBusiness(email = 'e2e@racristyle.test') {
  const registration = await request(app).post('/api/auth/register').send({
    nombre: 'Dueño E2E',
    email,
    password: 'SeguraE2E123',
  });
  assert.equal(registration.status, 201);
  const authorization = `Bearer ${registration.body.token}`;
  const business = await request(app)
    .post('/api/negocios')
    .set('Authorization', authorization)
    .send({
      nombre: 'Negocio E2E',
      descripcion: 'Negocio utilizado por la prueba integral automatizada.',
      telefono: '88881111',
      direccion: 'San Carlos',
      horaApertura: '08:00',
      horaCierre: '18:00',
      diasAbiertos: [0, 1, 2, 3, 4, 5, 6],
    });
  assert.equal(business.status, 201);
  const businessId = business.body.negocio.id_negocio;
  const headers = { Authorization: authorization, 'X-Business-Id': String(businessId) };
  return { authorization, businessId, headers };
}

test('E2E API completa registro, configuración, reserva, confirmación y cancelación', async () => {
  const { businessId, headers } = await prepareBusiness();
  const branding = await request(app)
    .put('/api/negocios/me/personalizacion')
    .set(headers)
    .field('fondoTipo', 'arena')
    .field('colorPrimario', '#8e42ff')
    .field('colorSecundario', '#171216');
  assert.equal(branding.status, 200);

  const service = await request(app).post('/api/servicios').set(headers).send({
    nombre: 'Servicio integral',
    descripcion: 'Servicio creado por la prueba E2E.',
    precio: 7500,
    duracion: 30,
  });
  const employee = await request(app).post('/api/empleados').set(headers).send({
    nombre: 'Trabajador E2E',
    especialidad: 'Especialista',
  });
  assert.equal(service.status, 201);
  assert.equal(employee.status, 201);

  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(10, 0, 0, 0);
  const booking = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: service.body.servicio.id_servicio,
    empleadoId: employee.body.empleado.id_empleado,
    clienteNombre: 'Cliente E2E',
    clienteEmail: 'cliente@racristyle.test',
    clienteTelefono: '88889999',
    fechaHora: start.toISOString(),
  });
  assert.equal(booking.status, 201);
  const confirmationUrl = new URL(booking.body.solicitud.enlaceDesarrollo);
  const token = confirmationUrl.searchParams.get('token');
  const confirmation = await request(app).post('/api/public/citas/confirmar').send({ token });
  assert.equal(confirmation.status, 200);
  assert.equal(confirmation.body.cita.estado, 'Confirmada');

  const agenda = await request(app).get('/api/citas').set(headers);
  assert.equal(agenda.status, 200);
  const appointment = agenda.body.citas.find(
    (item) => item.codigo_confirmacion === booking.body.solicitud.codigo_confirmacion,
  );
  assert.ok(appointment);
  const cancellation = await request(app)
    .patch(`/api/citas/${appointment.id_cita}/cancelar`)
    .set(headers)
    .send({ motivo: 'Cancelación controlada por la prueba E2E.' });
  assert.equal(cancellation.status, 200);

  const canceledConfirmation = await request(app)
    .post('/api/public/citas/confirmar')
    .send({ token });
  assert.equal(canceledConfirmation.status, 410);
  assert.match(canceledConfirmation.body.error, /cancelada/i);
});

test('seguridad rechaza JWT alterado, inyección de acceso y negocio ajeno', async () => {
  const owner = await prepareBusiness('seguridad1@racristyle.test');
  const otherOwner = await prepareBusiness('seguridad2@racristyle.test');

  const malformedToken = await request(app)
    .get('/api/citas')
    .set('Authorization', 'Bearer token.alterado.invalido');
  assert.equal(malformedToken.status, 401);

  const injection = await request(app).post('/api/auth/login').send({
    email: "' OR 1=1 --@example.com",
    password: "' OR 1=1 --",
  });
  assert.ok([400, 401].includes(injection.status));

  const foreignBusiness = await request(app)
    .get('/api/servicios')
    .set('Authorization', owner.authorization)
    .set('X-Business-Id', otherOwner.businessId);
  assert.ok([404, 409].includes(foreignBusiness.status));
});

test('seguridad aplica cabeceras HTTP y limita cuerpos JSON excesivos', async () => {
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers['x-content-type-options'], 'nosniff');
  assert.ok(health.headers['content-security-policy']);
  assert.equal(health.headers['x-powered-by'], undefined);

  const oversized = await request(app)
    .post('/api/auth/login')
    .send({ email: 'large@example.com', password: `A1a${'x'.repeat(110_000)}` });
  assert.equal(oversized.status, 413);
});

test('RNF-01 mantiene al menos el 95% de respuestas locales por debajo de dos segundos', async () => {
  const durations = [];
  for (let index = 0; index < 40; index += 1) {
    const started = performance.now();
    const response = await request(app).get('/api/health');
    durations.push(performance.now() - started);
    assert.equal(response.status, 200);
  }
  const underTwoSeconds = durations.filter((duration) => duration < 2000).length / durations.length;
  assert.ok(
    underTwoSeconds >= 0.95,
    `Solo ${(underTwoSeconds * 100).toFixed(1)}% respondió a tiempo.`,
  );
});

test('estrés básico atiende solicitudes concurrentes sin errores', async () => {
  const responses = await Promise.all(
    Array.from({ length: 25 }, () => request(app).get('/api/health')),
  );
  assert.ok(responses.every((response) => response.status === 200));
});

test('rate limiting bloquea el abuso después de 100 solicitudes por minuto', async () => {
  const isolatedApp = createApp();
  const responses = [];
  for (let index = 0; index < 101; index += 1) {
    responses.push(await request(isolatedApp).get('/api/health'));
  }
  assert.equal(responses[99].status, 200);
  assert.equal(responses[100].status, 429);
});

test('el seed es repetible y no duplica los datos de demostración', async () => {
  await seedDemoData({ databasePool: pool, closePool: false });
  await seedDemoData({ databasePool: pool, closePool: false });

  const users = await pool.query(
    "SELECT COUNT(*)::integer AS total FROM usuario WHERE email = 'demo@racristyle.local'",
  );
  const businesses = await pool.query(
    "SELECT COUNT(*)::integer AS total FROM negocio WHERE nombre = 'Barbería RaCristyle Demo'",
  );
  const appointments = await pool.query(
    "SELECT COUNT(*)::integer AS total FROM cita WHERE codigo_confirmacion LIKE 'RC-DEMO%'",
  );
  assert.equal(users.rows[0].total, 1);
  assert.equal(businesses.rows[0].total, 1);
  assert.equal(appointments.rows[0].total, 2);
});
