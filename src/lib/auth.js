import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function createToken(user) {
  return jwt.sign({ sub: user.id_usuario, email: user.email }, config.jwtSecret, {
    expiresIn: '8h',
  });
}

export function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Debes iniciar sesión.' });
  }

  try {
    req.user = jwt.verify(token, config.jwtSecret);
    return next();
  } catch {
    return res.status(401).json({ error: 'La sesión no es válida o expiró.' });
  }
}
