import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler } from '../lib/errors.js';
import { validate } from '../lib/validation.js';
import { listAppointments } from '../repositories/appointmentRepository.js';
import { cancelAppointmentWithReason } from '../services/appointmentService.js';
import { requireBusinessId } from '../services/businessService.js';

const router = Router();
const idSchema = z.coerce.number().int().positive();
const cancellationSchema = z.object({
  motivo: z
    .string()
    .trim()
    .min(10, 'Explica el motivo de la cancelación en al menos 10 caracteres.')
    .max(500, 'El motivo no puede superar 500 caracteres.'),
});

const filtersSchema = z.object({
  fecha: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Selecciona una fecha válida.')
    .optional(),
  estado: z.enum(['Pendiente', 'Confirmada', 'Cancelada', 'Completada']).optional(),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filters = validate(filtersSchema, req.query);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    const citas = await listAppointments(businessId, filters);

    const resumen = citas.reduce(
      (counts, appointment) => {
        counts.total += 1;
        const key = appointment.estado.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
        return counts;
      },
      { total: 0, pendiente: 0, confirmada: 0, cancelada: 0, completada: 0 },
    );

    return res.json({ citas, resumen });
  }),
);

router.patch(
  '/:id/cancelar',
  asyncHandler(async (req, res) => {
    const appointmentId = validate(idSchema, req.params.id);
    const { motivo } = validate(cancellationSchema, req.body);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    return res.json(await cancelAppointmentWithReason(businessId, appointmentId, motivo));
  }),
);

export default router;
