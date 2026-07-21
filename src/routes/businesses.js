import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { validate } from '../lib/validation.js';
import {
  createBusiness,
  findBusinessIdByUserId,
  updateBusiness,
  updateBusinessBranding,
} from '../repositories/businessRepository.js';

const router = Router();
const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 2 },
  fileFilter: (_req, file, callback) => {
    if (!acceptedImageTypes.has(file.mimetype)) {
      return callback(new HttpError(400, 'Las imágenes deben ser PNG, JPG o WebP.'));
    }
    return callback(null, true);
  },
});

const businessSchema = z
  .object({
    nombre: z.string().trim().min(2, 'Ingresa el nombre del negocio.').max(100),
    descripcion: z
      .string()
      .trim()
      .min(10, 'Describe el negocio en al menos 10 caracteres.')
      .max(700),
    telefono: z.string().trim().max(20).optional().default(''),
    direccion: z.string().trim().max(150).optional().default(''),
    horaApertura: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Selecciona la hora de apertura.')
      .default('08:00'),
    horaCierre: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Selecciona la hora de cierre.')
      .default('18:00'),
    diasAbiertos: z
      .array(z.coerce.number().int().min(0).max(6))
      .min(1, 'Selecciona al menos un día de atención.')
      .default([1, 2, 3, 4, 5, 6])
      .transform((days) => [...new Set(days)].sort()),
  })
  .refine((data) => data.horaApertura < data.horaCierre, {
    message: 'La hora de cierre debe ser posterior a la hora de apertura.',
    path: ['horaCierre'],
  });

const brandingSchema = z.object({
  fondoTipo: z.enum(['claro', 'arena', 'oscuro', 'personalizado']),
  colorPrimario: z.string().regex(/^#[0-9a-f]{6}$/i, 'Selecciona un color primario válido.'),
  colorSecundario: z.string().regex(/^#[0-9a-f]{6}$/i, 'Selecciona un color secundario válido.'),
});

function toDataUrl(file) {
  return file ? `data:${file.mimetype};base64,${file.buffer.toString('base64')}` : null;
}

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = validate(businessSchema, req.body);
    const negocio = await createBusiness(req.user.sub, data);
    return res.status(201).json({ negocio });
  }),
);

router.put(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = validate(businessSchema, req.body);
    const businessId = await findBusinessIdByUserId(req.user.sub, req.get('x-business-id'));
    const negocio = businessId
      ? await updateBusiness(req.user.sub, businessId, data)
      : await createBusiness(req.user.sub, data);
    return res.json({ negocio });
  }),
);

router.put(
  '/me/personalizacion',
  requireAuth,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'fondo', maxCount: 1 },
  ]),
  asyncHandler(async (req, res) => {
    const data = validate(brandingSchema, req.body);
    const logo = req.files?.logo?.[0];
    const background = req.files?.fondo?.[0];
    const businessId = await findBusinessIdByUserId(req.user.sub, req.get('x-business-id'));
    const personalizacion =
      businessId &&
      (await updateBusinessBranding(req.user.sub, businessId, {
        ...data,
        logoData: toDataUrl(logo),
        fondoData: toDataUrl(background),
      }));
    if (!personalizacion) {
      throw new HttpError(
        data.fondoTipo === 'personalizado' ? 400 : 409,
        data.fondoTipo === 'personalizado'
          ? 'Selecciona una imagen para el fondo personalizado.'
          : 'Primero debes configurar tu negocio.',
      );
    }
    return res.json({ personalizacion });
  }),
);

export default router;
