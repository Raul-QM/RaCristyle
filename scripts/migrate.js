import fs from 'node:fs/promises';
import path from 'node:path';
import { pool } from '../src/db.js';

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migracion (
      archivo VARCHAR(150) PRIMARY KEY,
      aplicada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const files = (await fs.readdir('database')).filter((name) => name.endsWith('.sql')).sort();

  for (const file of files) {
    const applied = await pool.query('SELECT 1 FROM migracion WHERE archivo = $1', [file]);
    if (applied.rowCount) continue;
    const sql = await fs.readFile(path.join('database', file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO migracion (archivo) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`Aplicada: ${file}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}
