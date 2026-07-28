import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/errors.js';
import { validate } from '../lib/validation.js';
import {
  confirmBooking,
  getAvailableSlots,
  getPublicBusiness,
  requestBooking,
} from '../services/publicBookingService.js';

const router = Router();
const idSchema = z.coerce.number().int().positive();
const bookingSchema = z.object({
  negocioId: z.coerce.number().int().positive(),
  servicioId: z.coerce.number().int().positive(),
  empleadoId: z.coerce.number().int().positive(),
  clienteNombre: z.string().trim().min(3, 'Ingresa tu nombre completo.').max(100),
  clienteEmail: z.string().trim().toLowerCase().email('El correo no es válido.').max(150),
  clienteTelefono: z.string().trim().min(8, 'Ingresa un teléfono válido.').max(20),
  fechaHora: z.string().datetime({ local: true, message: 'Selecciona una fecha y hora válida.' }),
});
const availabilitySchema = z.object({
  negocioId: z.coerce.number().int().positive(),
  servicioId: z.coerce.number().int().positive(),
  empleadoId: z.coerce.number().int().positive(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha válida.'),
});
const confirmationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/i, 'El enlace de confirmación no es válido.'),
});

router.get(
  '/negocios/:id',
  asyncHandler(async (req, res) => {
    const businessId = validate(idSchema, req.params.id);
    return res.json(await getPublicBusiness(businessId));
  }),
);

router.get(
  '/disponibilidad',
  asyncHandler(async (req, res) => {
    const data = validate(availabilitySchema, req.query);
    return res.json(await getAvailableSlots(data));
  }),
);

router.post(
  '/citas/confirmar',
  asyncHandler(async (req, res) => {
    const { token } = validate(confirmationSchema, req.body);
    return res.json(await confirmBooking(token));
  }),
);

router.post(
  '/citas',
  asyncHandler(async (req, res) => {
    const data = validate(bookingSchema, req.body);
    return res.status(201).json({ solicitud: await requestBooking(data) });
  }),
);

export default router;
