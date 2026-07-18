import { HttpError } from './errors.js';

/** Convierte los errores de Zod al formato uniforme que consume el frontend. */
export function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(
      400,
      'Revisa los datos ingresados.',
      result.error.issues.map((issue) => ({
        campo: issue.path.join('.'),
        mensaje: issue.message,
      })),
    );
  }
  return result.data;
}
