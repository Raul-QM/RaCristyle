import { requestApi } from './js/api.js';
import { $ } from './js/dom.js';
import { buildWhatsappUrl, capitalizeFirst, formatMoney } from './js/formatters.js';
const params = new URLSearchParams(location.search);
const businessId = params.get('negocio');
let services = [];
let employees = [];
let businessHours = null;
let businessPhone = '';
let businessOpenDays = [];
let businessReloading = false;
let businessReloadPending = false;
let businessSnapshot = '';
const updatesChannel =
  'BroadcastChannel' in window ? new BroadcastChannel('racristyle-updates') : null;

function circularFavicon(image) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><clipPath id="c"><circle cx="32" cy="32" r="30"/></clipPath></defs><image href="${image}" width="64" height="64" preserveAspectRatio="xMidYMid slice" clip-path="url(#c)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

async function api(path, options = {}) {
  return requestApi(path, options);
}

async function loadBusiness({ announce = false } = {}) {
  if (businessReloading) {
    businessReloadPending = true;
    return;
  }
  if (!businessId) {
    $('.booking-card').innerHTML =
      '<div class="booking-error"><h2>Enlace incompleto</h2><p>Solicita al negocio su enlace correcto de reservas.</p></div>';
    return;
  }
  businessReloading = true;
  try {
    const data = await api(`/public/negocios/${businessId}`);
    const nextSnapshot = JSON.stringify(data);
    if (nextSnapshot === businessSnapshot) return;
    businessSnapshot = nextSnapshot;
    services = data.servicios;
    employees = data.empleados;
    const branding = data.negocio;
    if (!branding.personalizacion_completa) {
      $('.booking-card').innerHTML =
        '<div class="booking-error"><h2>P\u00e1gina en preparaci\u00f3n</h2><p>Este negocio todav\u00eda no ha publicado su dise\u00f1o.</p></div>';
      return;
    }
    document.body.style.setProperty('--business-primary', branding.color_primario || '#d9ff43');
    document.body.style.setProperty('--business-secondary', branding.color_secundario || '#171713');
    document.body.dataset.background = branding.fondo_tipo || 'claro';
    const intro = $('.business-intro');
    intro.style.backgroundImage =
      branding.fondo_tipo === 'personalizado' && branding.fondo_data
        ? `linear-gradient(rgba(0,0,0,.58), rgba(0,0,0,.58)), url("${branding.fondo_data}")`
        : '';
    const businessLogo = $('#public-business-logo');
    businessLogo.hidden = !branding.logo_data;
    if (branding.logo_data) {
      businessLogo.src = branding.logo_data;
      $('#public-favicon').href = circularFavicon(branding.logo_data);
    }
    $('#public-business-brand-name').textContent = branding.nombre;
    $('#business-name').textContent = data.negocio.nombre;
    $('#business-description').textContent = data.negocio.descripcion;
    $('#business-address').textContent = data.negocio.direccion || 'Consulta con el negocio';
    businessPhone = data.negocio.telefono || '';
    const phoneLink = $('#business-phone');
    phoneLink.textContent = businessPhone || 'No indicado';
    if (businessPhone) {
      phoneLink.href = buildWhatsappUrl(
        businessPhone,
        `Hola, quisiera información sobre ${data.negocio.nombre}.`,
      );
    } else {
      phoneLink.removeAttribute('href');
    }
    businessHours = {
      opening: data.negocio.hora_apertura.slice(0, 5),
      closing: data.negocio.hora_cierre.slice(0, 5),
    };
    businessOpenDays = String(data.negocio.dias_abiertos || '1,2,3,4,5,6')
      .split(',')
      .map(Number);
    $('#business-hours').textContent = `${businessHours.opening} – ${businessHours.closing}`;
    document.title = `Reservar en ${data.negocio.nombre}`;
    const select = $('#booking-form').servicioId;
    const selectedService = select.value;
    select.innerHTML = '<option value="">Selecciona un servicio</option>';
    services.forEach((service) => {
      const option = document.createElement('option');
      option.value = service.id_servicio;
      option.textContent = `${service.nombre} · ${formatMoney(service.precio)}`;
      select.append(option);
    });
    if (services.some((service) => String(service.id_servicio) === selectedService)) {
      select.value = selectedService;
    }
    const employeeSelect = $('#booking-form').empleadoId;
    const selectedEmployee = employeeSelect.value;
    employeeSelect.innerHTML = '<option value="">Elige quién te atenderá</option>';
    employees.forEach((employee) => {
      const option = document.createElement('option');
      option.value = employee.id_empleado;
      option.textContent = employee.especialidad
        ? `${employee.nombre} · ${employee.especialidad}`
        : employee.nombre;
      employeeSelect.append(option);
    });
    if (employees.some((employee) => String(employee.id_empleado) === selectedEmployee)) {
      employeeSelect.value = selectedEmployee;
    }
    const submitButton = $('button[type="submit"]', $('#booking-form'));
    submitButton.disabled = !services.length || !employees.length;
    if (!services.length) {
      select.innerHTML = '<option value="">No hay servicios disponibles</option>';
      $('button[type="submit"]', $('#booking-form')).disabled = true;
    }
    if (!employees.length) {
      employeeSelect.innerHTML = '<option value="">No hay trabajadores disponibles</option>';
    }
    select.dispatchEvent(new Event('change'));
    if (announce) {
      $('#availability-help').textContent =
        'La información del negocio se actualizó automáticamente.';
    }
  } catch (error) {
    if (!businessSnapshot) {
      $('.booking-card').innerHTML =
        `<div class="booking-error"><h2>No encontramos este negocio</h2><p>${error.message}</p></div>`;
    } else {
      console.warn('No se pudo sincronizar temporalmente la página de reservas.', error);
    }
  } finally {
    businessReloading = false;
    if (businessReloadPending) {
      businessReloadPending = false;
      queueMicrotask(() => loadBusiness({ announce: true }));
    }
  }
}

$('#booking-form').servicioId.addEventListener('change', (event) => {
  const service = services.find((item) => String(item.id_servicio) === event.target.value);
  const card = $('#selected-service');
  card.hidden = !service;
  if (service) {
    card.innerHTML = `<span>${service.duracion_minutos} min</span><b>${formatMoney(service.precio)}</b><p>${service.descripcion || 'Servicio disponible para reserva.'}</p>`;
  }
  loadAvailability();
});

const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
$('#booking-form').fecha.min = today.toISOString().slice(0, 10);
$('#booking-form').fecha.addEventListener('change', (event) => {
  const selectedDate = event.target.value;
  if (selectedDate) {
    const selectedDay = new Date(`${selectedDate}T12:00:00`).getDay();
    if (!businessOpenDays.includes(selectedDay)) {
      event.target.value = '';
      $('#booking-form').fechaHora.disabled = true;
      $('#booking-form').fechaHora.innerHTML =
        '<option value="">El negocio está cerrado ese día</option>';
      $('#availability-help').textContent =
        'Ese día no está dentro de los días de atención. Selecciona otra fecha.';
      return;
    }
  }
  loadAvailability();
});
$('#booking-form').empleadoId.addEventListener('change', loadAvailability);

async function loadAvailability() {
  const form = $('#booking-form');
  const timeSelect = form.fechaHora;
  const serviceId = form.servicioId.value;
  const employeeId = form.empleadoId.value;
  const date = form.fecha.value;
  timeSelect.disabled = true;

  if (!serviceId || !employeeId || !date) {
    timeSelect.innerHTML = '<option value="">Selecciona servicio, trabajador y fecha</option>';
    return;
  }

  timeSelect.innerHTML = '<option value="">Consultando disponibilidad...</option>';
  try {
    const query = new URLSearchParams({
      negocioId: businessId,
      servicioId: serviceId,
      empleadoId: employeeId,
      fecha: date,
    });
    const { horarios, cerrado } = await api(`/public/disponibilidad?${query}`);
    if (!horarios.length) {
      timeSelect.innerHTML = `<option value="">${cerrado ? 'El negocio está cerrado ese día' : 'No hay horas disponibles ese día'}</option>`;
      $('#availability-help').textContent = cerrado
        ? 'Selecciona uno de los días de atención del negocio.'
        : 'Este trabajador no tiene espacios disponibles para la fecha seleccionada.';
      return;
    }
    timeSelect.innerHTML = '<option value="">Selecciona una hora disponible</option>';
    horarios.forEach((slot) => {
      const option = document.createElement('option');
      option.value = slot.valor;
      option.textContent = slot.etiqueta;
      timeSelect.append(option);
    });
    timeSelect.disabled = false;
    $('#availability-help').textContent =
      `Horarios disponibles entre ${businessHours.opening} y ${businessHours.closing}.`;
  } catch (error) {
    timeSelect.innerHTML = '<option value="">No fue posible cargar las horas</option>';
    $('#availability-help').textContent = error.message;
  }
}

$('#booking-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const errorElement = $('.form-error', form);
  const button = $('button[type="submit"]', form);
  errorElement.textContent = '';
  if (!form.fechaHora.value) {
    errorElement.textContent =
      'No hay una hora seleccionada. Elige una fecha con horarios disponibles dentro de la jornada del negocio.';
    return;
  }
  button.disabled = true;
  button.textContent = 'Verificando disponibilidad...';
  try {
    const body = Object.fromEntries(new FormData(form));
    body.negocioId = businessId;
    const { solicitud } = await api('/public/citas', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    $('#confirmation-code').textContent = solicitud.codigo_confirmacion;
    $('#confirmation-service').textContent =
      `${solicitud.servicio} con ${solicitud.profesional} · ${formatMoney(solicitud.precio)}`;
    $('#confirmation-date').textContent = capitalizeFirst(
      new Intl.DateTimeFormat('es-CR', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'America/Costa_Rica',
      }).format(new Date(solicitud.fecha_inicio)),
    );
    $('#pending-message').textContent =
      `Enviamos el enlace a ${solicitud.cliente_email}. Tienes ${solicitud.minutosParaConfirmar} minutos para confirmar antes de que el horario se libere.`;
    const devLink = $('#dev-confirmation-link');
    if (solicitud.enlaceDesarrollo) {
      devLink.href = solicitud.enlaceDesarrollo;
      devLink.hidden = false;
    } else {
      devLink.hidden = true;
    }
    $('#booking-form-panel').hidden = true;
    $('#confirmation-panel').hidden = false;
  } catch (error) {
    errorElement.textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = 'Solicitar mi cita →';
  }
});

$('#new-booking').addEventListener('click', () => {
  $('#booking-form').reset();
  $('#selected-service').hidden = true;
  $('#confirmation-panel').hidden = true;
  $('#booking-form-panel').hidden = false;
});

loadBusiness();

updatesChannel?.addEventListener('message', (event) => {
  if (
    event.data?.type === 'business-updated' &&
    String(event.data.businessId) === String(businessId)
  ) {
    loadBusiness({ announce: true });
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === 'racristyle_last_update' && event.newValue?.startsWith(`${businessId}:`)) {
    loadBusiness({ announce: true });
  }
});

window.addEventListener('focus', () => loadBusiness({ announce: true }));

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) loadBusiness({ announce: true });
});

// Respaldo moderado para otros dispositivos o navegadores que no comparten eventos.
setInterval(() => {
  if (!document.hidden) loadBusiness();
}, 30_000);
