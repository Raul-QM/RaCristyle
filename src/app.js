import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import businessRoutes from './routes/businesses.js';
import serviceRoutes from './routes/services.js';
import publicRoutes from './routes/public.js';
import employeeRoutes from './routes/employees.js';
import appointmentRoutes from './routes/appointments.js';
import { errorHandler } from './lib/errors.js';

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
  app.use('/api/public', publicRoutes);
  app.use('/api/empleados', employeeRoutes);
  app.use('/api/citas', appointmentRoutes);
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use(express.static('public'));
  app.use(errorHandler);
  return app;
}

// Entrada que Vercel detecta en src/app.js para ejecutar Express como función
// serverless. La fábrica permanece exportada para pruebas y ejecución local.
export default createApp();
