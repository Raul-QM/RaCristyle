import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { createToken, requireAuth } from '../lib/auth.js';
import { asyncHandler, HttpError } from '../lib/errors.js';
import { validate } from '../lib/validation.js';
import {
  createUser,
  emailExists,
  findUserByEmail,
  findUserProfile,
} from '../repositories/userRepository.js';

const router = Router();

const registerSchema = z.object({
  nombre: z.string().trim().min(3, 'Ingresa tu nombre completo.').max(100),
  email: z.string().trim().toLowerCase().email('El correo no es válido.').max(150),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .regex(/[A-Z]/, 'Incluye al menos una mayúscula.')
    .regex(/[a-z]/, 'Incluye al menos una minúscula.')
    .regex(/[0-9]/, 'Incluye al menos un número.'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('El correo no es válido.'),
  password: z.string().min(1, 'Ingresa tu contraseña.'),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const data = validate(registerSchema, req.body);
    if (await emailExists(data.email)) {
      throw new HttpError(409, 'Este correo ya está registrado.');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await createUser({ ...data, passwordHash });
    return res.status(201).json({ token: createToken(user), user });
  }),
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const data = validate(loginSchema, req.body);
    const user = await findUserByEmail(data.email);
    if (!user || !(await bcrypt.compare(data.password, user.password_hash))) {
      throw new HttpError(401, 'Correo o contraseña incorrectos.');
    }
    delete user.password_hash;
    return res.json({ token: createToken(user), user });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await findUserProfile(req.user.sub, req.get('x-business-id'));
    if (!user) throw new HttpError(404, 'Usuario no encontrado.');
    return res.json({ user });
  }),
);

export default router;
