import { HttpError } from '../lib/errors.js';
import { findBusinessIdByUserId } from '../repositories/businessRepository.js';

/**
 * Obtiene el negocio del usuario autenticado y evita repetir esta regla en cada módulo.
 * @param {number} userId Identificador extraído del JWT.
 * @returns {Promise<number>} Identificador del negocio perteneciente al usuario.
 */
export async function requireBusinessId(userId, requestedBusinessId = null) {
  const businessId = await findBusinessIdByUserId(userId, requestedBusinessId);
  if (!businessId) {
    throw new HttpError(409, 'Primero debes completar la información de tu negocio.');
  }
  return businessId;
}
