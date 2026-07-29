import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import request from 'supertest';

process.env.DATABASE_URL = 'memory://';
process.env.JWT_SECRET = 'secreto-de-pruebas-racristyle-123456789';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db.js');
const app = createApp();

before(async () => {
  for (const migration of [
    'database/001_sprint1.sql',
    'database/003_horario_negocio.sql',
    'database/006_dias_atencion.sql',
    'database/007_personalizacion_negocio.sql',
    'database/009_multiples_negocios.sql',
  ]) {
    await pool.query(await fs.readFile(migration, 'utf8'));
  }
});

after(async () => {
  await pool.end();
});

test('HU-01 registra un dueño y no expone el hash', async () => {
  const response = await request(app).post('/api/auth/register').send({
    nombre: 'Raúl Quesada',
    email: 'raul@example.com',
    password: 'Segura123',
  });

  assert.equal(response.status, 201);
  assert.ok(response.body.token);
  assert.equal(response.body.user.email, 'raul@example.com');
  assert.equal(response.body.user.password_hash, undefined);
});

test('HU-01 rechaza un correo ya registrado', async () => {
  const response = await request(app).post('/api/auth/register').send({
    nombre: 'Otro Usuario',
    email: 'RAUL@example.com',
    password: 'Segura123',
  });

  assert.equal(response.status, 409);
  assert.match(response.body.error, /correo/i);
});

test('HU-02 rechaza credenciales incorrectas y acepta las correctas', async () => {
  const invalid = await request(app).post('/api/auth/login').send({
    email: 'raul@example.com',
    password: 'Incorrecta123',
  });
  assert.equal(invalid.status, 401);

  const valid = await request(app).post('/api/auth/login').send({
    email: 'raul@example.com',
    password: 'Segura123',
  });
  assert.equal(valid.status, 200);
  assert.ok(valid.body.token);
});

test('HU-03 crea y actualiza el negocio del usuario autenticado', async () => {
  const login = await request(app).post('/api/auth/login').send({
    email: 'raul@example.com',
    password: 'Segura123',
  });
  const authorization = `Bearer ${login.body.token}`;

  const created = await request(app)
    .put('/api/negocios/me')
    .set('Authorization', authorization)
    .send({
      nombre: 'Barbería Central',
      descripcion: 'Cortes modernos con atención personalizada.',
      telefono: '8888-1111',
      direccion: 'Ciudad Quesada',
    });
  assert.equal(created.status, 200);
  assert.equal(created.body.negocio.nombre, 'Barbería Central');

  const updated = await request(app)
    .put('/api/negocios/me')
    .set('Authorization', authorization)
    .send({
      nombre: 'RaCri Barber',
      descripcion: 'Una experiencia de cuidado realmente diferente.',
      telefono: '8888-2222',
      direccion: 'San Carlos',
    });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.negocio.nombre, 'RaCri Barber');

  const me = await request(app).get('/api/auth/me').set('Authorization', authorization);
  assert.equal(me.body.user.negocio_nombre, 'RaCri Barber');
});

test('una misma cuenta administra varios negocios de forma independiente', async () => {
  const login = await request(app).post('/api/auth/login').send({
    email: 'raul@example.com',
    password: 'Segura123',
  });
  const authorization = `Bearer ${login.body.token}`;
  const second = await request(app).post('/api/negocios').set('Authorization', authorization).send({
    nombre: 'Spa del Norte',
    descripcion: 'Un segundo negocio administrado desde la misma cuenta.',
    telefono: '8888-3333',
    direccion: 'San Carlos',
  });
  assert.equal(second.status, 201);

  const profile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', authorization)
    .set('X-Business-Id', second.body.negocio.id_negocio);
  assert.equal(profile.status, 200);
  assert.equal(profile.body.user.negocio_nombre, 'Spa del Norte');
  assert.equal(profile.body.user.negocios.length, 2);
});

test('las rutas privadas rechazan solicitudes sin JWT', async () => {
  const response = await request(app).put('/api/negocios/me').send({
    nombre: 'Sin autorización',
    descripcion: 'Este registro nunca debe ser almacenado.',
  });
  assert.equal(response.status, 401);
});
