import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

const app = createApp();

// Vercel importa la aplicación como una función serverless. En ejecución
// local y Docker se conserva el servidor HTTP tradicional y su cierre seguro.
if (!process.env.VERCEL) {
  const server = app.listen(config.port, () => {
    console.log(`RaCristyle disponible en http://localhost:${config.port}`);
  });

  async function shutdown() {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export default app;
