import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import request from 'supertest';

process.env.DATABASE_URL = 'memory://';
process.env.JWT_SECRET = 'secreto-de-pruebas-racristyle-123456789';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const app = createApp();

let token;
let businessId;
let serviceId;
let employeeId;
let secondEmployeeId;

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
  const register = await request(app).post('/api/auth/register').send({
    nombre: 'Dueño Demo',
    email: 'demo@racristyle.test',
    password: 'DemoSegura123',
  });
  token = register.body.token;
  const business = await request(app)
    .put('/api/negocios/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nombre: 'Barbería Demo',
      descripcion: 'La mejor atención de San Carlos.',
      telefono: '8888-8888',
      direccion: 'Ciudad Quesada',
      diasAbiertos: [0, 1, 2, 3, 4, 5, 6],
    });
  businessId = business.body.negocio.id_negocio;
  const firstEmployee = await request(app)
    .post('/api/empleados')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Andrés Mora', especialidad: 'Barbero' });
  employeeId = firstEmployee.body.empleado.id_empleado;
  const secondEmployee = await request(app)
    .post('/api/empleados')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Daniel Vargas', especialidad: 'Estilista' });
  secondEmployeeId = secondEmployee.body.empleado.id_empleado;
});

after(async () => {
  await pool.end();
});

test('HU-04 agrega un servicio con precio y duración', async () => {
  const created = await request(app)
    .post('/api/servicios')
    .set('Authorization', `Bearer ${token}`)
    .send({
      nombre: 'Corte clásico',
      descripcion: 'Corte y acabado profesional.',
      precio: 6500,
      duracion: 30,
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.servicio.nombre, 'Corte clásico');
  assert.equal(created.body.servicio.duracion_minutos, 30);
  serviceId = created.body.servicio.id_servicio;

  const listed = await request(app).get('/api/servicios').set('Authorization', `Bearer ${token}`);
  assert.equal(listed.status, 200);
  assert.equal(listed.body.servicios.length, 1);
});

test('HU-04 rechaza precios y duraciones inválidas', async () => {
  const response = await request(app)
    .post('/api/servicios')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Inválido', precio: 0, duracion: 1 });
  assert.equal(response.status, 400);
});

test('la página pública expone negocio y catálogo activo', async () => {
  const response = await request(app).get(`/api/public/negocios/${businessId}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.negocio.nombre, 'Barbería Demo');
  assert.equal(response.body.servicios[0].nombre, 'Corte clásico');
});

test('HU-05 crea una cita pendiente y HU-06 la confirma mediante token', async () => {
  const future = futureAt(1, 10).toISOString();
  const response = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Cliente Prueba',
    clienteEmail: 'cliente@example.com',
    clienteTelefono: '88887777',
    fechaHora: future,
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.solicitud.estado, 'Pendiente');
  assert.match(response.body.solicitud.codigo_confirmacion, /^RC-[A-F0-9]{8}$/);
  assert.equal(response.body.solicitud.servicio, 'Corte clásico');
  assert.ok(response.body.solicitud.enlaceDesarrollo);

  const confirmationToken = new URL(response.body.solicitud.enlaceDesarrollo).searchParams.get(
    'token',
  );
  const confirmed = await request(app)
    .post('/api/public/citas/confirmar')
    .send({ token: confirmationToken });
  assert.equal(confirmed.status, 200);
  assert.equal(confirmed.body.cita.estado, 'Confirmada');
  assert.equal(
    confirmed.body.cita.codigo_confirmacion,
    response.body.solicitud.codigo_confirmacion,
  );
  assert.equal(confirmed.body.cita.cliente_nombre, 'Cliente Prueba');
  assert.equal(confirmed.body.cita.cliente_telefono, '88887777');
  assert.equal(confirmed.body.cita.profesional, 'Andrés Mora');

  const repeatedConfirmation = await request(app)
    .post('/api/public/citas/confirmar')
    .send({ token: confirmationToken });
  assert.equal(repeatedConfirmation.status, 200);
  assert.equal(repeatedConfirmation.body.yaConfirmada, true);
  assert.equal(repeatedConfirmation.body.cita.estado, 'Confirmada');
});

test('HU-06 rechaza un token de confirmación inválido', async () => {
  const response = await request(app)
    .post('/api/public/citas/confirmar')
    .send({ token: 'a'.repeat(64) });
  assert.equal(response.status, 404);
});

test('HU-05 impide una doble reserva en un horario solapado', async () => {
  const future = futureAt(2, 10);
  const first = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Primer Cliente',
    clienteEmail: 'primero@example.com',
    clienteTelefono: '88881111',
    fechaHora: future.toISOString(),
  });
  assert.equal(first.status, 201);

  const overlap = new Date(future.getTime() + 10 * 60_000);
  const second = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Segundo Cliente',
    clienteEmail: 'segundo@example.com',
    clienteTelefono: '88882222',
    fechaHora: overlap.toISOString(),
  });
  assert.equal(second.status, 409);
  assert.match(second.body.error, /disponible/i);
});

test('HU-05 rechaza reservas fuera del horario de atención', async () => {
  const response = await request(app)
    .post('/api/public/citas')
    .send({
      negocioId: businessId,
      servicioId: serviceId,
      empleadoId: employeeId,
      clienteNombre: 'Cliente Madrugada',
      clienteEmail: 'madrugada@example.com',
      clienteTelefono: '88883333',
      fechaHora: futureAt(3, 2).toISOString(),
    });

  assert.equal(response.status, 409);
  assert.match(response.body.error, /atiende de 08:00 a 18:00/i);
});

test('HU-05 explica cuando falta una hora disponible y valida el teléfono nacional', async () => {
  const baseBooking = {
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Cliente Validación',
    clienteEmail: 'validacion@example.com',
    clienteTelefono: '88887777',
  };

  const missingTime = await request(app).post('/api/public/citas').send(baseBooking);
  assert.equal(missingTime.status, 400);
  assert.match(missingTime.body.details[0].mensaje, /hora disponible/i);

  const invalidPhone = await request(app)
    .post('/api/public/citas')
    .send({
      ...baseBooking,
      clienteTelefono: '+50688887777',
      fechaHora: futureAt(10, 10).toISOString(),
    });
  assert.equal(invalidPhone.status, 400);
  assert.match(invalidPhone.body.details[0].mensaje, /exactamente 8 dígitos/i);
});

test('HU-05 conserva en producción la hora civil seleccionada en Costa Rica', async () => {
  const selectedDate = localDate(futureAt(20, 11));
  const response = await request(app)
    .post('/api/public/citas')
    .send({
      negocioId: businessId,
      servicioId: serviceId,
      empleadoId: secondEmployeeId,
      clienteNombre: 'Cliente Zona Horaria',
      clienteEmail: 'zona-horaria@example.com',
      clienteTelefono: '88886666',
      fechaHora: `${selectedDate}T11:00:00`,
    });

  assert.equal(response.status, 201);
  const displayedHour = new Intl.DateTimeFormat('es-CR', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Costa_Rica',
  }).format(new Date(response.body.solicitud.fecha_inicio));
  assert.equal(displayedHour, '11');
});

test('la disponibilidad solo muestra horas abiertas y oculta las ocupadas', async () => {
  const date = futureAt(4, 0).toISOString().slice(0, 10);
  const query = {
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    fecha: date,
  };
  const before = await request(app).get('/api/public/disponibilidad').query(query);
  assert.equal(before.status, 200);
  assert.ok(before.body.horarios.length > 0);
  assert.ok(
    before.body.horarios.every((slot) => {
      const hour = new Date(slot.valor).getHours();
      return hour >= 8 && hour < 18;
    }),
  );

  const selectedSlot = before.body.horarios[0].valor;
  const booked = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Cliente Horario',
    clienteEmail: 'horario@example.com',
    clienteTelefono: '88884444',
    fechaHora: selectedSlot,
  });
  assert.equal(booked.status, 201);

  const after = await request(app).get('/api/public/disponibilidad').query(query);
  assert.ok(!after.body.horarios.some((slot) => slot.valor === selectedSlot));
});

test('dos profesionales pueden recibir citas a la misma hora', async () => {
  const slot = futureAt(5, 11).toISOString();
  const first = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Cliente Uno',
    clienteEmail: 'uno-capacidad@example.com',
    clienteTelefono: '88885555',
    fechaHora: slot,
  });
  const second = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: secondEmployeeId,
    clienteNombre: 'Cliente Dos',
    clienteEmail: 'dos-capacidad@example.com',
    clienteTelefono: '88886666',
    fechaHora: slot,
  });
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
});

test('HU-05 no muestra horarios ni permite reservar en un día cerrado', async () => {
  const closedDate = futureAt(8, 10);
  const closedDay = closedDate.getDay();
  const openDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => day !== closedDay);
  await pool.query('UPDATE negocio SET dias_abiertos = $1 WHERE id_negocio = $2', [
    openDays.join(','),
    businessId,
  ]);

  const availability = await request(app)
    .get('/api/public/disponibilidad')
    .query({
      negocioId: businessId,
      servicioId: serviceId,
      empleadoId: employeeId,
      fecha: localDate(closedDate),
    });
  assert.equal(availability.status, 200);
  assert.equal(availability.body.cerrado, true);
  assert.deepEqual(availability.body.horarios, []);

  const booking = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Cliente Día Cerrado',
    clienteEmail: 'cerrado@example.com',
    clienteTelefono: '88887777',
    fechaHora: closedDate.toISOString(),
  });
  assert.equal(booking.status, 409);

  await pool.query('UPDATE negocio SET dias_abiertos = $1 WHERE id_negocio = $2', [
    '0,1,2,3,4,5,6',
    businessId,
  ]);
});

test('HU-06 libera el horario cuando la confirmación vence', async () => {
  const date = futureAt(6, 0).toISOString().slice(0, 10);
  const availabilityQuery = {
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    fecha: date,
  };
  const before = await request(app).get('/api/public/disponibilidad').query(availabilityQuery);
  const selectedSlot = before.body.horarios[0].valor;
  const pending = await request(app).post('/api/public/citas').send({
    negocioId: businessId,
    servicioId: serviceId,
    empleadoId: employeeId,
    clienteNombre: 'Cliente Sin Confirmar',
    clienteEmail: 'expira@example.com',
    clienteTelefono: '88889999',
    fechaHora: selectedSlot,
  });
  assert.equal(pending.status, 201);

  await pool.query(
    `UPDATE cita SET confirmacion_expira = NOW() - INTERVAL '1 minute'
     WHERE id_cita = $1`,
    [pending.body.solicitud.id_cita],
  );
  const expiredToken = new URL(pending.body.solicitud.enlaceDesarrollo).searchParams.get('token');
  const expiredConfirmation = await request(app)
    .post('/api/public/citas/confirmar')
    .send({ token: expiredToken });
  assert.equal(expiredConfirmation.status, 410);
  const after = await request(app).get('/api/public/disponibilidad').query(availabilityQuery);
  assert.ok(after.body.horarios.some((slot) => slot.valor === selectedSlot));
  const state = await pool.query('SELECT estado FROM cita WHERE id_cita = $1', [
    pending.body.solicitud.id_cita,
  ]);
  assert.equal(state.rows[0].estado, 'Cancelada');
});

function futureAt(daysAhead, hour, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
