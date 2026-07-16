import 'dotenv/config';

process.env.TZ ||= 'America/Costa_Rica';

export const config = {
  port: Number(process.env.PORT || 3000),
  timezone: process.env.TZ,
  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/racristyle',
  databaseSsl:
    process.env.DATABASE_SSL === 'true' ||
    (process.env.NODE_ENV === 'production' && process.env.DATABASE_SSL !== 'false'),
  jwtSecret: process.env.JWT_SECRET || 'clave-local-racristyle-solo-para-desarrollo',
  isProduction: process.env.NODE_ENV === 'production',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  confirmationMinutes: Number(process.env.BOOKING_CONFIRMATION_MINUTES || 15),
  mail: {
    mode: process.env.MAIL_MODE || 'json',
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 465),
    secure: process.env.SMTP_SECURE !== 'false',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'RaCristyle <no-reply@racristyle.local>',
  },
};

if (config.isProduction && config.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres en producción.');
}

if (!Number.isInteger(config.confirmationMinutes) || config.confirmationMinutes < 1) {
  throw new Error('BOOKING_CONFIRMATION_MINUTES debe ser un entero positivo.');
}

if (config.mail.mode === 'smtp' && (!config.mail.host || !config.mail.user || !config.mail.pass)) {
  throw new Error('SMTP_HOST, SMTP_USER y SMTP_PASS son obligatorios cuando MAIL_MODE=smtp.');
}
