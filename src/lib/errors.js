export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function errorHandler(error, _req, res, _next) {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'La imagen no puede superar 2 MB.' });
  }
  if (error?.code === 'LIMIT_FILE_COUNT' || error?.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ error: 'Solo se permite un logo y una imagen de fondo.' });
  }
  if (error?.code === '23505') {
    return res.status(409).json({ error: 'El registro ya existe.' });
  }

  const status = error.status || 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({
    error: status >= 500 ? 'Ocurrió un error interno.' : error.message,
    ...(error.details ? { details: error.details } : {}),
  });
}
