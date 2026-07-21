import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { validate } from '../lib/validation.js';
import {
  createService,
  listServicesByBusiness,
  setServiceActive,
  updateService,
} from '../repositories/serviceRepository.js';
import { requireBusinessId } from '../services/businessService.js';

const router = Router();
const idSchema = z.coerce.number().int().positive();
const stateSchema = z.object({ activo: z.boolean() });

const serviceSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa el nombre del servicio.').max(100),
  descripcion: z.string().trim().max(300).optional().default(''),
  precio: z.coerce.number().positive('El precio debe ser mayor que cero.').max(10_000_000),
  duracion: z.coerce
    .number()
    .int()
    .min(5, 'La duración mínima es de 5 minutos.')
    .max(480, 'La duración máxima es de 480 minutos.'),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    return res.json({ servicios: await listServicesByBusiness(businessId) });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = validate(serviceSchema, req.body);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    return res.status(201).json({ servicio: await createService(businessId, data) });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const serviceId = validate(idSchema, req.params.id);
    const data = validate(serviceSchema, req.body);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    const servicio = await updateService(businessId, serviceId, data);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado.');
    return res.json({ servicio });
  }),
);

router.patch(
  '/:id/estado',
  asyncHandler(async (req, res) => {
    const serviceId = validate(idSchema, req.params.id);
    const { activo } = validate(stateSchema, req.body);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    const servicio = await setServiceActive(businessId, serviceId, activo);
    if (!servicio) throw new HttpError(404, 'Servicio no encontrado.');
    return res.json({ servicio });
  }),
);

export default router;
