import { $ } from './js/dom.js';
import { buildWhatsappUrl, capitalizeFirst, formatPhone } from './js/formatters.js';

const token = new URLSearchParams(location.search).get('token');

function circularFavicon(image) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="30"/></clipPath></defs><image href="${image}" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function applyBranding(branding = {}) {
  document.body.style.setProperty('--business-primary', branding.color_primario || '#d9ff43');
  document.body.style.setProperty('--business-secondary', branding.color_secundario || '#171713');
  const backgrounds = { claro: '#f4f1e8', arena: '#d8c7a5', oscuro: '#24241f' };
  document.body.style.backgroundColor = backgrounds[branding.fondo_tipo] || backgrounds.claro;
  document.body.style.backgroundImage =
    branding.fondo_tipo === 'personalizado' && branding.fondo_data
      ? `linear-gradient(rgba(0,0,0,.35), rgba(0,0,0,.35)), url("${branding.fondo_data}")`
      : '';
  if (branding.negocio) {
    $('#confirmation-business').textContent = branding.negocio;
    document.title = `Confirmar cita | ${branding.negocio}`;
  }
  if (branding.logo_data) {
    const logo = $('#confirmation-logo');
    logo.src = branding.logo_data;
    logo.hidden = false;
    $('#confirmation-favicon').href = circularFavicon(branding.logo_data);
  }
}

async function confirmBooking() {
  const errorElement = $('.form-error');
  if (!token) {
    $('#confirmation-status-title').textContent = 'Enlace incompleto';
    $('#confirmation-status-message').textContent = '';
    errorElement.textContent = 'El enlace de confirmación está incompleto.';
    return;
  }

  try {
    const response = await fetch('/api/public/citas/confirmar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      applyBranding(data.details);
      if (data.details?.motivo) {
        $('.confirmation-check').textContent = '×';
        $('#confirmation-status-title').textContent = 'Tu cita fue cancelada';
        $('#confirmation-status-message').textContent = `Motivo: ${data.details.motivo}`;
        return;
      }
      throw new Error(data.error || 'No fue posible confirmar la cita.');
    }

    const appointment = data.cita;
    applyBranding(appointment);
    if (data.yaConfirmada) {
      $('.confirmation-check').textContent = '✓';
      $('#confirmation-status-title').textContent = 'Esta cita ya fue confirmada';
      $('#confirmation-status-message').textContent =
        'No necesitas confirmarla nuevamente. Tu cita continúa reservada.';
      errorElement.textContent = '';
      return;
    }
    $('#confirmed-code').textContent = appointment.codigo_confirmacion;
    $('#confirmed-business').textContent = appointment.negocio;
    $('#confirmed-service').textContent = appointment.servicio;
    $('#confirmed-professional').textContent = appointment.profesional;
    $('#confirmed-date').textContent = capitalizeFirst(
      new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'America/Costa_Rica',
      }).format(new Date(appointment.fecha_inicio)),
    );
    const whatsapp = $('#confirmed-whatsapp');
    if (appointment.negocio_telefono) {
      const appointmentDate = new Date(appointment.fecha_inicio);
      const date = capitalizeFirst(
        new Intl.DateTimeFormat('es-CR', {
          dateStyle: 'full',
          timeZone: 'America/Costa_Rica',
        }).format(appointmentDate),
      );
      const time = new Intl.DateTimeFormat('es-CR', {
        timeStyle: 'short',
        timeZone: 'America/Costa_Rica',
      }).format(appointmentDate);
      const message = [
        'Hola, confirmé mi cita:',
        `Código: ${appointment.codigo_confirmacion}`,
        `Cliente: ${appointment.cliente_nombre}`,
        `Teléfono: ${formatPhone(appointment.cliente_telefono)}`,
        `Servicio: ${appointment.servicio}`,
        `Trabajador: ${appointment.profesional}`,
        `Día: ${date}`,
        `Hora: ${time}`,
      ].join('\n');
      whatsapp.href = buildWhatsappUrl(appointment.negocio_telefono, message);
      whatsapp.hidden = false;
    }
    $('#confirm-ready').hidden = true;
    $('#confirm-success').hidden = false;
  } catch (error) {
    $('#confirmation-status-title').textContent = 'No pudimos confirmar la cita';
    $('#confirmation-status-message').textContent = '';
    errorElement.textContent = error.message;
  }
}

confirmBooking();
