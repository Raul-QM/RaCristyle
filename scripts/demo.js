import fs from 'node:fs/promises';

process.env.DATABASE_URL = 'memory://';
process.env.JWT_SECRET ||= 'clave-segura-para-demostracion-racristyle';

const { pool } = await import('../src/db.js');
const { createApp } = await import('../src/app.js');
const { config } = await import('../src/config.js');

const migrations = (await fs.readdir('database')).filter((file) => file.endsWith('.sql')).sort();

for (const migration of migrations) {
  await pool.query(await fs.readFile(`database/${migration}`, 'utf8'));
}

const server = createApp().listen(config.port, () => {
  console.log(`Demo RaCristyle disponible en http://localhost:${config.port}`);
  console.log('Los datos de este modo se reinician al cerrar el servidor.');
  console.log('Presiona Ctrl+C para detenerlo.');
});

const keepAlive = setInterval(() => {}, 60_000);

async function shutdown() {
  console.log('\nCerrando demo de RaCristyle...');
  clearInterval(keepAlive);
  await new Promise((resolve) => server.close(resolve));
  await pool.end();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
