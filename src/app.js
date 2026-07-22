import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/businesses.js';
import serviceRoutes from './routes/services.js';
import { errorHandler } from './lib/errors.js';

// Aplicación Express: cabeceras seguras, límite de solicitudes y rutas de la API.
export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'script-src': ["'self'"],
          'img-src': ["'self'", 'data:', 'blob:'],
        },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { error: 'Demasiadas solicitudes. Intenta de nuevo en un minuto.' },
    }),
  );
  app.use('/api/auth', authRoutes);
  app.use('/api/negocios', businessRoutes);
  app.use('/api/servicios', serviceRoutes);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(express.static('public'));
  app.use(errorHandler);
  return app;
}
