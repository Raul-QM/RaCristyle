import crypto from 'node:crypto';
import { config } from '../config.js';
import { HttpError } from '../lib/errors.js';
import { sendBookingConfirmation } from '../lib/mailer.js';
import {
  cancelAppointmentAfterMailFailure,
  expirePendingAppointments,
  findActiveService,
  findAppointmentByTokenForUpdate,
  findAvailabilityContext,
  findEmployeeAndBusinessForUpdate,
  findPublicBusiness,
  hasAppointmentCollision,
  insertPendingAppointment,
  listOccupiedIntervals,
  markConfirmationEmailSent,
  updateAppointmentStatus,
  withTransaction,
} from '../repositories/publicBookingRepository.js';

const MINIMUM_NOTICE_MS = 5 * 60_000;
const SLOT_INTERVAL_MINUTES = 15;
const COSTA_RICA_OFFSET = '-06:00';

function toMinutes(time) {
  const [hours, minutes] = time.slice(0, 5).split(':').map(Number);
  return hours * 60 + minutes;
}

function getOpenDays(value) {
  return String(value).split(',').map(Number);
}

function intervalsOverlap(start, end, occupiedStart, occupiedEnd) {
  return start < occupiedEnd && end > occupiedStart;
}

export async function getPublicBusiness(businessId) {
  const business = await findPublicBusiness(businessId);
  if (!business) throw new HttpError(404, 'Negocio no encontrado.');
  return business;
}

/**
 * Genera espacios de 15 minutos que permiten completar el servicio dentro de la jornada.
 * Excluye horas pasadas y cualquier intervalo ocupado por una cita vigente.
 * @param {{negocioId: number, servicioId: number, empleadoId: number, fecha: string}} data
 * @param {Date} now Reloj inyectable para mantener determinista el cálculo.
 * @returns {Promise<{horarios: Array<{valor: string, etiqueta: string}>, cerrado?: boolean}>}
 */
export async function getAvailableSlots(data, now = new Date()) {
  const context = await findAvailabilityContext(data);
  if (!context.business) throw new HttpError(404, 'Negocio no encontrado.');
  if (!context.service || !context.employee) {
    throw new HttpError(404, 'Servicio o trabajador no disponible.');
  }

  const dayStart = new Date(`${data.fecha}T00:00:00`);
  if (!getOpenDays(context.business.dias_abiertos).includes(dayStart.getDay())) {
    return { horarios: [], cerrado: true };
  }

  const dayEnd = new Date(`${data.fecha}T23:59:59`);
  await expirePendingAppointments(data.empleadoId);
  const occupied = await listOccupiedIntervals(data.empleadoId, dayStart, dayEnd);
  const opening = toMinutes(context.business.hora_apertura);
  const closing = toMinutes(context.business.hora_cierre);
  const duration = context.service.duracion_minutos;
  const horarios = [];

  for (let minute = opening; minute + duration <= closing; minute += SLOT_INTERVAL_MINUTES) {
    const start = new Date(dayStart);
    start.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
    const end = new Date(start.getTime() + duration * 60_000);
    if (start.getTime() < now.getTime() + MINIMUM_NOTICE_MS) continue;

    const collision = occupied.some((appointment) =>
      intervalsOverlap(
        start,
        end,
        new Date(appointment.fecha_inicio),
        new Date(appointment.fecha_fin),
      ),
    );
    if (!collision) {
      horarios.push({
        valor: `${data.fecha}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}:00`,
        etiqueta: new Intl.DateTimeFormat('es-CR', {
          hour: 'numeric',
          minute: '2-digit',
        }).format(start),
      });
    }
  }
  return { horarios };
}

/**
 * Confirma de forma atómica el token y libera el horario cuando ya venció.
 * @param {string} token Token aleatorio recibido por correo.
 * @returns {Promise<{cita: object, yaConfirmada: boolean}>}
 */
export async function confirmBooking(token) {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const result = await withTransaction(async (client) => {
    const appointment = await findAppointmentByTokenForUpdate(client, tokenHash);
    if (!appointment) throw new HttpError(404, 'El enlace de confirmación no es válido.');
    if (appointment.estado === 'Confirmada') {
      return { cita: appointment, yaConfirmada: true };
    }
    if (appointment.estado === 'Cancelada' && appointment.motivo_cancelacion) {
      throw new HttpError(410, 'Tu cita fue cancelada por el negocio.', {
        motivo: appointment.motivo_cancelacion,
        codigo: appointment.codigo_confirmacion,
        negocio: appointment.negocio,
        logo_data: appointment.logo_data,
        fondo_tipo: appointment.fondo_tipo,
        fondo_data: appointment.fondo_data,
        color_primario: appointment.color_primario,
        color_secundario: appointment.color_secundario,
      });
    }
    if (
      appointment.estado !== 'Pendiente' ||
      new Date(appointment.confirmacion_expira).getTime() <= Date.now()
    ) {
      if (appointment.estado === 'Pendiente') {
        await updateAppointmentStatus(client, appointment.id_cita, 'Cancelada');
      }
      return { expired: true };
    }
    const confirmed = await updateAppointmentStatus(client, appointment.id_cita, 'Confirmada');
    return { cita: { ...appointment, ...confirmed }, yaConfirmada: false };
  });
  if (result.expired) throw new HttpError(410, 'El enlace venció y el horario fue liberado.');
  return result;
}

function validateBusinessHours(start, end, business) {
  if (!getOpenDays(business.dias_abiertos).includes(start.getDay())) {
    throw new HttpError(409, 'El negocio está cerrado el día seleccionado.');
  }
  const opening = toMinutes(business.hora_apertura);
  const closing = toMinutes(business.hora_cierre);
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  if (
    startMinutes < opening ||
    endMinutes > closing ||
    start.toDateString() !== end.toDateString()
  ) {
    throw new HttpError(
      409,
      `El negocio atiende de ${business.hora_apertura.slice(0, 5)} a ${business.hora_cierre.slice(0, 5)}. Elige un horario dentro de esa jornada.`,
    );
  }
}

/**
 * Reserva el intervalo bajo bloqueo transaccional y envía la confirmación después del commit.
 * Si el correo falla, cancela la cita para que el horario vuelva a quedar disponible.
 * @param {object} data Datos de la solicitud previamente validados por la ruta.
 * @returns {Promise<object>} Solicitud pendiente junto con sus datos de presentación.
 */
export async function requestBooking(data) {
  // Los horarios públicos representan hora civil de Costa Rica. El sufijo
  // evita que entornos UTC como Vercel interpreten 11:00 como 11:00 UTC.
  const hasExplicitOffset = /(?:Z|[+-]\d{2}:\d{2})$/i.test(data.fechaHora);
  const start = new Date(
    hasExplicitOffset ? data.fechaHora : `${data.fechaHora}${COSTA_RICA_OFFSET}`,
  );
  if (Number.isNaN(start.getTime())) throw new HttpError(400, 'La fecha no es válida.');
  if (start.getTime() < Date.now() + MINIMUM_NOTICE_MS) {
    throw new HttpError(400, 'La cita debe reservarse con al menos 5 minutos de anticipación.');
  }

  const reservation = await withTransaction(async (client) => {
    const business = await findEmployeeAndBusinessForUpdate(
      client,
      data.empleadoId,
      data.negocioId,
    );
    if (!business) throw new HttpError(404, 'Trabajador no encontrado.');
    const service = await findActiveService(client, data.servicioId, data.negocioId);
    if (!service) throw new HttpError(404, 'Servicio no encontrado.');

    const end = new Date(start.getTime() + service.duracion_minutos * 60_000);
    validateBusinessHours(start, end, business);
    if (await hasAppointmentCollision(client, data.empleadoId, start, end)) {
      throw new HttpError(409, 'Ese horario ya no está disponible. Elige otro.');
    }

    const confirmationCode = `RC-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const confirmationToken = crypto.randomBytes(32).toString('hex');
    const appointment = await insertPendingAppointment(client, {
      ...data,
      start,
      end,
      confirmationCode,
      confirmationTokenHash: crypto.createHash('sha256').update(confirmationToken).digest('hex'),
      confirmationExpires: new Date(Date.now() + config.confirmationMinutes * 60_000),
    });
    return { appointment, business, service, confirmationToken };
  });

  let mail;
  try {
    mail = await sendBookingConfirmation({
      to: data.clienteEmail,
      customer: data.clienteNombre,
      business: reservation.business.negocio_nombre,
      branding: reservation.business,
      service: reservation.service.nombre,
      professional: reservation.business.empleado_nombre,
      price: reservation.service.precio,
      date: start,
      code: reservation.appointment.codigo_confirmacion,
      token: reservation.confirmationToken,
      replyTo: reservation.business.propietario_email,
    });
    await markConfirmationEmailSent(reservation.appointment.id_cita);
  } catch (error) {
    await cancelAppointmentAfterMailFailure(reservation.appointment.id_cita);
    console.error('No fue posible enviar el correo de confirmación:', error);
    throw new HttpError(
      502,
      'No pudimos enviar el correo. El horario fue liberado; intenta nuevamente.',
    );
  }

  return {
    ...reservation.appointment,
    servicio: reservation.service.nombre,
    precio: reservation.service.precio,
    profesional: reservation.business.empleado_nombre,
    negocio: reservation.business.negocio_nombre,
    minutosParaConfirmar: config.confirmationMinutes,
    ...(mail.simulated ? { enlaceDesarrollo: mail.confirmationUrl } : {}),
  };
}
