import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { validate } from '../lib/validation.js';
import {
  createEmployee,
  listEmployeesByBusiness,
  setEmployeeActive,
  updateEmployee,
} from '../repositories/employeeRepository.js';
import { requireBusinessId } from '../services/businessService.js';

const router = Router();
const idSchema = z.coerce.number().int().positive();
const stateSchema = z.object({ activo: z.boolean() });

const employeeSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresa el nombre del profesional.').max(100),
  especialidad: z.string().trim().max(120).optional().default(''),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    return res.json({ empleados: await listEmployeesByBusiness(businessId) });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = validate(employeeSchema, req.body);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    return res.status(201).json({ empleado: await createEmployee(businessId, data) });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const employeeId = validate(idSchema, req.params.id);
    const data = validate(employeeSchema, req.body);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    const empleado = await updateEmployee(businessId, employeeId, data);
    if (!empleado) throw new HttpError(404, 'Trabajador no encontrado.');
    return res.json({ empleado });
  }),
);

router.patch(
  '/:id/estado',
  asyncHandler(async (req, res) => {
    const employeeId = validate(idSchema, req.params.id);
    const { activo } = validate(stateSchema, req.body);
    const businessId = await requireBusinessId(req.user.sub, req.get('x-business-id'));
    const empleado = await setEmployeeActive(businessId, employeeId, activo);
    if (!empleado) throw new HttpError(404, 'Trabajador no encontrado.');
    return res.json({ empleado });
  }),
);

export default router;
