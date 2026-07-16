import { config } from './config.js';

let Pool;

if (config.databaseUrl === 'memory://') {
  const { newDb } = await import('pg-mem');
  const memoryDb = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = memoryDb.adapters.createPg();
  Pool = adapter.Pool;
} else {
  const pg = await import('pg');
  Pool = pg.default.Pool;
}

export const pool =
  config.databaseUrl === 'memory://'
    ? new Pool()
    : new Pool({
        connectionString: config.databaseUrl,
        ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      });

export async function query(text, params = []) {
  return pool.query(text, params);
}
