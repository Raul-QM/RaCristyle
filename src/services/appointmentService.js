import { HttpError } from '../lib/errors.js';
import { sendBookingCancellation } from '../lib/mailer.js';
import {
  cancelAppointment,
  findAppointmentState,
  findCancellationEmailData,
  markCancellationEmailSent,
} from '../repositories/appointmentRepository.js';

/**
 * Cancela una cita y notifica al cliente sin revertir la cancelación si el correo falla.
 * El horario debe liberarse aunque el proveedor de correo esté temporalmente indisponible.
 */
export async function cancelAppointmentWithReason(businessId, appointmentId, reason) {
  const appointment = await cancelAppointment(businessId, appointmentId, reason);
  if (!appointment) {
    const status = await findAppointmentState(businessId, appointmentId);
    if (!status) throw new HttpError(404, 'Cita no encontrada.');
    throw new HttpError(409, `La cita ya está ${status.toLowerCase()}.`);
  }

  const emailData = await findCancellationEmailData(businessId, appointmentId);
  let correoEnviado = true;
  try {
    await sendBookingCancellation(emailData);
    await markCancellationEmailSent(appointmentId);
  } catch (error) {
    correoEnviado = false;
    console.error('La cita se canceló, pero no fue posible notificar por correo:', error);
  }
  return { cita: emailData, correoEnviado };
}
