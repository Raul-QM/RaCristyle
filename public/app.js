import { requestApi } from './js/api.js';
import { $, $$, escapeHtml } from './js/dom.js';
import { buildWhatsappUrl, capitalizeFirst, formatMoney } from './js/formatters.js';

const state = {
  token: localStorage.getItem('racristyle_token'),
  businessId: localStorage.getItem('racristyle_business_id'),
  user: null,
  services: [],
  employees: [],
  creatingBusiness: false,
};
const updatesChannel =
  'BroadcastChannel' in window ? new BroadcastChannel('racristyle-updates') : null;

function notifyPublicPage() {
  if (!state.user?.id_negocio) return;
  updatesChannel?.postMessage({
    type: 'business-updated',
    businessId: String(state.user.id_negocio),
    timestamp: Date.now(),
  });
  localStorage.setItem('racristyle_last_update', `${state.user.id_negocio}:${Date.now()}`);
}

async function api(path, options = {}) {
  const headers = {
    ...(state.businessId ? { 'X-Business-Id': state.businessId } : {}),
    ...options.headers,
  };
  return requestApi(path, { ...options, headers }, state.token);
}

function setError(form, message = '') {
  $('.form-error', form).textContent = message;
}

let confirmDialogResolver = null;

function closeConfirmDialog(result) {
  const dialog = $('#confirm-dialog');
  if (dialog.open) dialog.close();
  confirmDialogResolver?.(result);
  confirmDialogResolver = null;
}

function confirmAction({ title, message, confirmText = 'Confirmar', danger = false }) {
  const dialog = $('#confirm-dialog');
  $('#confirm-dialog-title').textContent = title;
  $('#confirm-dialog-message').textContent = message;
  const acceptButton = $('#confirm-dialog-accept');
  acceptButton.textContent = confirmText;
  acceptButton.classList.toggle('confirm-dialog-confirm-danger', danger);
  dialog.showModal();
  return new Promise((resolve) => {
    confirmDialogResolver = resolve;
  });
}

$('#confirm-dialog-accept').addEventListener('click', () => closeConfirmDialog(true));
$('#confirm-dialog-cancel').addEventListener('click', () => closeConfirmDialog(false));
$('#confirm-dialog-close').addEventListener('click', () => closeConfirmDialog(false));
$('#confirm-dialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeConfirmDialog(false);
});

let cancellationDialogResolver = null;

function closeCancellationDialog(reason = null) {
  const dialog = $('#cancellation-dialog');
  if (dialog.open) dialog.close();
  cancellationDialogResolver?.(reason);
  cancellationDialogResolver = null;
}

function requestCancellationReason(code) {
  const dialog = $('#cancellation-dialog');
  const reason = $('#cancellation-reason');
  $('#cancellation-title').textContent = `Cancelar cita ${code}`;
  $('#cancellation-error').textContent = '';
  $('#cancellation-count').textContent = '0/500';
  reason.value = '';
  dialog.showModal();
  reason.focus();
  return new Promise((resolve) => {
    cancellationDialogResolver = resolve;
  });
}

$('#cancellation-reason').addEventListener('input', (event) => {
  $('#cancellation-count').textContent = `${event.target.value.length}/500`;
  $('#cancellation-error').textContent = '';
});
$('#cancellation-accept').addEventListener('click', () => {
  const reason = $('#cancellation-reason').value.trim();
  if (reason.length < 10) {
    $('#cancellation-error').textContent = 'Explica el motivo en al menos 10 caracteres.';
    return;
  }
  closeCancellationDialog(reason);
});
$('#cancellation-back').addEventListener('click', () => closeCancellationDialog());
$('#cancellation-close').addEventListener('click', () => closeCancellationDialog());
$('#cancellation-dialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  closeCancellationDialog();
});

function isFormComplete(form) {
  const fieldsComplete = $$('[required]', form).every(
    (field) => String(field.value).trim() !== '' && field.checkValidity(),
  );
  const daysComplete =
    form.id !== 'business-form' ||
    $$('input[name="diasAbiertos"]', form).some((field) => field.checked);
  return fieldsComplete && daysComplete;
}

function updateFormButton(form) {
  const button = $('button[type="submit"]', form);
  if (button) button.disabled = !isFormComplete(form);
}

['business-form', 'service-form', 'employee-form'].forEach((formId) => {
  const form = $(`#${formId}`);
  form.addEventListener('input', () => updateFormButton(form));
  form.addEventListener('change', () => updateFormButton(form));
  updateFormButton(form);
});

function showAuth(mode) {
  $('#register-panel').hidden = mode !== 'register';
  $('#login-panel').hidden = mode !== 'login';
  $('#auth-dialog').showModal();
}

function setBusinessEditing(editing) {
  const form = $('#business-form');
  const hasBusiness = Boolean(state.user?.id_negocio);
  $$('input, textarea', form).forEach((field) => {
    field.disabled = hasBusiness && !editing;
  });
  const button = $('#save-business');
  if (hasBusiness && !editing) {
    button.type = 'button';
    button.disabled = false;
    button.dataset.mode = 'edit';
    button.textContent = 'Editar negocio →';
    $('#save-status').textContent = 'Pulsa Editar negocio para modificar la información.';
  } else {
    button.type = 'submit';
    button.dataset.mode = 'save';
    button.textContent = hasBusiness ? 'Guardar cambios →' : 'Guardar negocio →';
    updateFormButton(form);
  }
}

function showDashboard(isNew = false) {
  document.body.classList.add('app-mode');
  $('main').hidden = true;
  $('.nav').hidden = true;
  $('#dashboard').hidden = false;
  $('#aside-name').textContent = state.user.nombre;
  const businessSelect = $('#active-business');
  const businesses = state.user.negocios || [];
  businessSelect.innerHTML = businesses.length
    ? businesses
        .map(
          (business) =>
            `<option value="${business.id_negocio}">${escapeHtml(business.nombre)}</option>`,
        )
        .join('')
    : '<option value="">Sin negocios creados</option>';
  businessSelect.value = state.user.id_negocio || state.businessId || '';
  businessSelect.disabled = !businesses.length;
  const activeBusiness = businesses.find(
    (business) => String(business.id_negocio) === String(businessSelect.value),
  );
  const activeBusinessName = state.creatingBusiness
    ? 'Nuevo negocio'
    : activeBusiness?.nombre || 'Sin negocio';
  $('#active-business-name').textContent = activeBusinessName;
  $('#active-business-initial').textContent = activeBusinessName.charAt(0).toUpperCase();
  $('#business-picker-label').textContent = activeBusiness?.nombre || 'Seleccionar negocio';
  $('#business-picker-menu').innerHTML = businesses
    .map(
      (business) => `<button type="button" role="option"
        aria-selected="${String(business.id_negocio) === String(businessSelect.value)}"
        data-business-id="${business.id_negocio}" data-business-name="${escapeHtml(business.nombre)}">
        <span>${escapeHtml(business.nombre.charAt(0).toUpperCase())}</span>
        <b>${escapeHtml(business.nombre)}</b>
        <small>${String(business.id_negocio) === String(businessSelect.value) ? 'ACTIVO' : 'CAMBIAR'}</small>
      </button>`,
    )
    .join('');
  $('#business-picker-trigger').disabled = !businesses.length;
  $('#welcome').hidden = !isNew;
  const form = $('#business-form');
  const hasBusiness = Boolean(state.user.id_negocio);
  $('#business-view-title').textContent = 'Crea tu Negocio';
  $('#business-form-title').textContent = 'Configura tu Negocio';
  form.nombre.value = state.user.negocio_nombre || '';
  form.descripcion.value = state.user.descripcion || '';
  form.telefono.value = state.user.telefono || '';
  form.direccion.value = state.user.direccion || '';
  form.horaApertura.value = (state.user.hora_apertura || '08:00').slice(0, 5);
  form.horaCierre.value = (state.user.hora_cierre || '18:00').slice(0, 5);
  const openDays = String(state.user.dias_abiertos || '1,2,3,4,5,6').split(',');
  $$('input[name="diasAbiertos"]', form).forEach((input) => {
    input.checked = openDays.includes(input.value);
  });
  $('#description-count').textContent = form.descripcion.value.length;
  const brandingForm = $('#branding-form');
  brandingForm.hidden = !hasBusiness;
  brandingForm.fondoTipo.value = state.user.fondo_tipo || 'claro';
  brandingForm.colorPrimario.value = state.user.color_primario || '#d9ff43';
  brandingForm.colorSecundario.value = state.user.color_secundario || '#171713';
  updateBrandingPreview();
  $('#custom-background-field').hidden = brandingForm.fondoTipo.value !== 'personalizado';
  const logoPreview = $('#logo-preview');
  logoPreview.hidden = !state.user.logo_data;
  $('#logo-placeholder').hidden = Boolean(state.user.logo_data);
  if (state.user.logo_data) logoPreview.src = state.user.logo_data;
  setBusinessEditing(!hasBusiness);
  if (state.user.id_negocio) loadServices();
}

async function switchBusiness(businessId) {
  state.businessId = String(businessId);
  localStorage.setItem('racristyle_business_id', state.businessId);
  state.creatingBusiness = false;
  await loadSession();
  showView('business');
}

$('#business-picker-trigger').addEventListener('click', () => {
  const menu = $('#business-picker-menu');
  menu.hidden = !menu.hidden;
  $('#business-picker-trigger').setAttribute('aria-expanded', String(!menu.hidden));
});

$('#business-picker-menu').addEventListener('click', async (event) => {
  const option = event.target.closest('[data-business-id]');
  if (!option) return;
  $('#business-picker-menu').hidden = true;
  $('#business-picker-trigger').setAttribute('aria-expanded', 'false');
  if (String(option.dataset.businessId) === String(state.user.id_negocio)) return;
  const confirmed = await confirmAction({
    title: 'Cambiar de negocio',
    message: `Vas a cambiar al negocio ${option.dataset.businessName}. ¿Deseas continuar?`,
    confirmText: 'Cambiar negocio',
  });
  if (confirmed) await switchBusiness(option.dataset.businessId);
});

document.addEventListener('click', (event) => {
  if (event.target.closest('.business-select-shell')) return;
  $('#business-picker-menu').hidden = true;
  $('#business-picker-trigger').setAttribute('aria-expanded', 'false');
});

$('#new-business').addEventListener('click', () => {
  state.creatingBusiness = true;
  state.user = {
    id_usuario: state.user.id_usuario,
    nombre: state.user.nombre,
    email: state.user.email,
    negocios: state.user.negocios || [],
  };
  showDashboard();
  showView('business');
  $('#welcome').textContent =
    'Configura tu nuevo negocio. Podr\u00e1s alternar entre todos desde el men\u00fa.';
  $('#welcome').hidden = false;
  $('#business-form').nombre.focus();
});

function showView(view) {
  $$('.dashboard-view').forEach((element) => (element.hidden = true));
  $(`#${view}-view`).hidden = false;
  $$('[data-view]').forEach((button) =>
    button.classList.toggle('active', button.dataset.view === view),
  );
  if (view === 'services') loadServices();
  if (view === 'team') loadEmployees();
  if (view === 'booking') loadBookingPage();
  if (view === 'agenda') loadAppointments();
}

async function loadAppointments() {
  const form = $('#agenda-filters');
  const query = new URLSearchParams();
  if (form.fecha.value) query.set('fecha', form.fecha.value);
  if (form.estado.value) query.set('estado', form.estado.value);
  $('#agenda-error').textContent = '';

  try {
    const { citas, resumen } = await api(`/citas${query.size ? `?${query}` : ''}`);
    $('#agenda-total').textContent = resumen.total;
    $('#agenda-pending').textContent = resumen.pendiente;
    $('#agenda-confirmed').textContent = resumen.confirmada;
    $('#agenda-empty').hidden = citas.length > 0;
    $('#appointments-list').innerHTML = citas
      .map((appointment) => {
        const start = new Date(appointment.fecha_inicio);
        const end = new Date(appointment.fecha_fin);
        const date = capitalizeFirst(
          new Intl.DateTimeFormat('es-CR', {
            dateStyle: 'full',
            timeZone: 'America/Costa_Rica',
          }).format(start),
        );
        const time = new Intl.DateTimeFormat('es-CR', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Costa_Rica',
        }).format(start);
        const endTime = new Intl.DateTimeFormat('es-CR', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'America/Costa_Rica',
        }).format(end);
        const phone = escapeHtml(appointment.cliente_telefono);
        const canCancel = ['Pendiente', 'Confirmada'].includes(appointment.estado);
        return `<article class="appointment-card">
          <div class="appointment-date"><small>${escapeHtml(date)}</small><strong>${escapeHtml(time)}</strong><span>– ${escapeHtml(endTime)}</span></div>
          <div class="appointment-main">
            <div class="appointment-heading"><h2>${escapeHtml(appointment.servicio)}</h2><span class="appointment-status status-${appointment.estado.toLowerCase()}">${escapeHtml(appointment.estado)}</span></div>
            <p><b>Cliente:</b> ${escapeHtml(appointment.cliente_nombre)}</p>
            <p><b>Trabajador:</b> ${escapeHtml(appointment.trabajador || 'Sin asignar')}</p>
            <div class="appointment-contact">
              <a href="mailto:${escapeHtml(appointment.cliente_email)}">${escapeHtml(appointment.cliente_email)}</a>
              <a href="${buildWhatsappUrl(appointment.cliente_telefono, `Hola ${appointment.cliente_nombre}, te contactamos sobre tu cita ${appointment.codigo_confirmacion}.`)}" target="_blank">WhatsApp ${phone}</a>
            </div>
          </div>
          <div class="appointment-code"><small>CÓDIGO</small><strong>${escapeHtml(appointment.codigo_confirmacion)}</strong><small>${formatMoney(appointment.precio)}</small>${canCancel ? `<button class="button button-danger cancel-appointment" type="button" data-appointment-id="${appointment.id_cita}" data-appointment-code="${escapeHtml(appointment.codigo_confirmacion)}">Cancelar cita</button>` : ''}</div>
        </article>`;
      })
      .join('');
  } catch (error) {
    $('#agenda-error').textContent = error.message;
    $('#appointments-list').innerHTML = '';
    $('#agenda-empty').hidden = false;
  }
}

async function loadEmployees() {
  const empty = $('#employees-empty');
  const list = $('#employees-list');
  $('#employees-error').textContent = '';
  if (!state.user.id_negocio) {
    empty.hidden = false;
    $('#continue-to-booking').hidden = true;
    list.innerHTML = '';
    return;
  }
  try {
    const { empleados } = await api('/empleados');
    state.employees = empleados;
    empty.hidden = empleados.length > 0;
    $('#continue-to-booking').hidden = !empleados.some((employee) => employee.activo);
    if (!empleados.length) {
      empty.innerHTML =
        '<span>◎</span><h2>Agrega a tu equipo</h2><p>Necesitas al menos un trabajador para recibir reservas.</p>';
    }
    list.innerHTML = empleados
      .map(
        (employee) => `
          <article class="service-card employee-card ${employee.activo ? '' : 'item-disabled'}">
            <div class="employee-avatar">${escapeHtml(employee.nombre.charAt(0).toUpperCase())}</div>
            <div>
              <h2>${escapeHtml(employee.nombre)}</h2>
              <p>${escapeHtml(employee.especialidad || 'Profesional del negocio')}</p>
            </div>
            <div class="service-meta"><span class="active-label">${employee.activo ? '● DISPONIBLE' : '○ DESHABILITADO'}</span><button class="button button-ghost edit-employee" type="button" data-employee-id="${employee.id_empleado}">Editar</button><button class="button button-ghost toggle-employee" type="button" data-employee-id="${employee.id_empleado}" data-active="${employee.activo}">${employee.activo ? 'Deshabilitar' : 'Habilitar'}</button></div>
          </article>`,
      )
      .join('');
  } catch (error) {
    empty.hidden = false;
    empty.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function loadServices() {
  const empty = $('#services-empty');
  const list = $('#services-list');
  $('#services-error').textContent = '';
  if (!state.user.id_negocio) {
    empty.innerHTML =
      '<span>01</span><h2>Completa primero tu negocio</h2><p>Guarda la identidad del negocio antes de crear servicios.</p>';
    empty.hidden = false;
    $('#continue-to-team').hidden = true;
    list.innerHTML = '';
    return;
  }
  try {
    const { servicios } = await api('/servicios');
    state.services = servicios;
    empty.hidden = servicios.length > 0;
    $('#continue-to-team').hidden = !servicios.some((service) => service.activo);
    if (!servicios.length) {
      empty.innerHTML =
        '<span>✦</span><h2>Tu catálogo comienza aquí</h2><p>Agrega el primer servicio que tus clientes podrán reservar.</p>';
    }
    list.innerHTML = servicios
      .map(
        (service) => `
          <article class="service-card ${service.activo ? '' : 'item-disabled'}">
            <div class="service-icon">✦</div>
            <div>
              <h2>${escapeHtml(service.nombre)}</h2>
              <p>${escapeHtml(service.descripcion || 'Servicio de ' + service.duracion_minutos + ' minutos')}</p>
            </div>
            <div class="service-meta">
              <div><small>PRECIO</small><b>${formatMoney(service.precio)}</b></div>
              <div><small>DURACIÓN</small><span>${service.duracion_minutos} min</span></div>
              <button class="button button-ghost edit-service" type="button" data-service-id="${service.id_servicio}">Editar</button>
              <button class="button button-ghost toggle-service" type="button" data-service-id="${service.id_servicio}" data-active="${service.activo}">${service.activo ? 'Deshabilitar' : 'Habilitar'}</button>
            </div>
          </article>`,
      )
      .join('');
  } catch (error) {
    empty.hidden = false;
    empty.innerHTML = `<p>${escapeHtml(error.message)}</p>`;
  }
}

async function loadBookingPage() {
  const publicLink = $('#booking-link');
  const stepButton = $('#booking-complete-step');
  const requirements = $('#booking-requirements');
  const hasBusiness = Boolean(state.user.id_negocio);
  let services = [];
  let employees = [];

  if (hasBusiness) {
    [{ servicios: services }, { empleados: employees }] = await Promise.all([
      api('/servicios'),
      api('/empleados'),
    ]);
  }

  const activeServices = services.filter((service) => service.activo);
  const activeEmployees = employees.filter((employee) => employee.activo);

  const steps = [
    { label: 'Negocio configurado', complete: hasBusiness, view: 'business' },
    {
      label: 'P\u00e1gina personalizada',
      complete: Boolean(state.user.personalizacion_completa),
      view: 'business',
    },
    {
      label: 'Al menos un servicio habilitado',
      complete: activeServices.length > 0,
      view: 'services',
    },
    {
      label: 'Al menos un trabajador habilitado',
      complete: activeEmployees.length > 0,
      view: 'team',
    },
  ];
  requirements.innerHTML = steps
    .map(
      (step) => `<article class="service-card">
        <div class="service-icon">${step.complete ? '✓' : '○'}</div>
        <div><h2>${step.label}</h2><p>${step.complete ? 'Completado' : 'Pendiente'}</p></div>
        <span class="active-label">${step.complete ? '● LISTO' : 'PENDIENTE'}</span>
      </article>`,
    )
    .join('');

  const pendingStep = steps.find((step) => !step.complete);
  if (!pendingStep) {
    $('#booking-link-title').textContent = 'Tu página de reservas está lista';
    $('#booking-link-help').textContent = 'Ábrela en otra pestaña y compártela con tus clientes.';
    publicLink.href = `/reservar.html?negocio=${state.user.id_negocio}`;
    publicLink.hidden = false;
    stepButton.hidden = true;
  } else {
    $('#booking-link-title').textContent = 'Completa los pasos anteriores';
    $('#booking-link-help').textContent = `Falta: ${pendingStep.label.toLowerCase()}.`;
    publicLink.hidden = true;
    publicLink.removeAttribute('href');
    stepButton.dataset.targetView = pendingStep.view;
    stepButton.hidden = false;
  }
}

async function loadSession(isNew = false) {
  try {
    const { user } = await api('/auth/me');
    state.user = user;
    state.businessId = user.id_negocio ? String(user.id_negocio) : null;
    if (state.businessId) localStorage.setItem('racristyle_business_id', state.businessId);
    else localStorage.removeItem('racristyle_business_id');
    showDashboard(isNew);
  } catch {
    localStorage.removeItem('racristyle_token');
    state.token = null;
  }
}

$$('[data-open]').forEach((button) =>
  button.addEventListener('click', () => showAuth(button.dataset.open)),
);
$$('[data-switch]').forEach((button) =>
  button.addEventListener('click', () => showAuth(button.dataset.switch)),
);
$('.dialog-close').addEventListener('click', () => $('#auth-dialog').close());

$$('.password-toggle').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $('input', button.parentElement);
    const willShow = input.type === 'password';
    input.type = willShow ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(willShow));
    button.setAttribute('aria-label', willShow ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });
});

$('#register-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  setError(form);
  button.disabled = true;
  button.textContent = 'Creando cuenta...';
  try {
    const body = Object.fromEntries(new FormData(form));
    await api('/auth/register', { method: 'POST', body: JSON.stringify(body) });
    localStorage.removeItem('racristyle_token');
    state.token = null;
    const registeredEmail = body.email;
    form.reset();
    showAuth('login');
    $('#login-form').email.value = registeredEmail;
    $('#auth-success').textContent = '✓ Cuenta creada correctamente. Ahora inicia sesión.';
    $('#auth-success').hidden = false;
    $('#login-form').password.focus();
  } catch (error) {
    setError(form, error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Crear mi cuenta';
  }
});

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  setError(form);
  button.disabled = true;
  button.textContent = 'Ingresando...';
  try {
    $('#auth-success').hidden = true;
    const body = Object.fromEntries(new FormData(form));
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify(body) });
    state.token = data.token;
    localStorage.setItem('racristyle_token', state.token);
    $('#auth-dialog').close();
    await loadSession();
  } catch (error) {
    setError(form, error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Ingresar al panel';
  }
});

$('#business-form').descripcion.addEventListener('input', (event) => {
  $('#description-count').textContent = event.target.value.length;
});

$('#branding-form').addEventListener('change', (event) => {
  const form = event.currentTarget;
  $('#custom-background-field').hidden = form.fondoTipo.value !== 'personalizado';
});

function updateBrandingPreview() {
  const form = $('#branding-form');
  const primary = form.colorPrimario.value.toUpperCase();
  const secondary = form.colorSecundario.value.toUpperCase();
  $('#primary-color-value').textContent = primary;
  $('#secondary-color-value').textContent = secondary;
  $('#branding-preview').style.setProperty('--preview-primary', primary);
  $('#branding-preview').style.setProperty('--preview-secondary', secondary);
  $('#branding-preview-name').textContent = state.user?.negocio_nombre || 'Tu negocio';
}

$('#branding-form').addEventListener('input', updateBrandingPreview);

$('#business-logo').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    $('#branding-form .form-error').textContent = 'El logo no puede superar 2 MB.';
    event.target.value = '';
    return;
  }
  const preview = $('#logo-preview');
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  $('#logo-placeholder').hidden = true;
});

$('#business-background').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file && file.size > 2 * 1024 * 1024) {
    $('#branding-form .form-error').textContent = 'El fondo no puede superar 2 MB.';
    event.target.value = '';
  }
});

$('#branding-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  setError(form);
  button.disabled = true;
  button.textContent = 'Guardando diseño...';
  try {
    const formData = new FormData(form);
    const { personalizacion } = await api('/negocios/me/personalizacion', {
      method: 'PUT',
      body: formData,
    });
    state.user = { ...state.user, ...personalizacion };
    state.user.negocios = (state.user.negocios || []).map((business) =>
      business.id_negocio === state.user.id_negocio
        ? { ...business, personalizacion_completa: true }
        : business,
    );
    notifyPublicPage();
    $('#branding-status').textContent = '✓ Diseño actualizado correctamente.';
  } catch (error) {
    setError(form, error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Guardar diseño →';
  }
});

$('#save-business').addEventListener('click', (event) => {
  if (event.currentTarget.dataset.mode !== 'edit') return;
  event.preventDefault();
  setBusinessEditing(true);
  $('#save-status').textContent = 'Edita los campos y pulsa Guardar cambios.';
  $('#business-form').nombre.focus();
});

$('#business-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!isFormComplete(form)) {
    setError(form, 'Completa correctamente todos los campos y selecciona al menos un día abierto.');
    form.reportValidity();
    updateFormButton(form);
    return;
  }
  const button = $('button[type="submit"]', form);
  setError(form);
  button.disabled = true;
  button.textContent = 'Guardando...';
  try {
    const wasExisting = Boolean(state.user.id_negocio);
    const formData = new FormData(form);
    const body = Object.fromEntries(formData);
    body.diasAbiertos = formData.getAll('diasAbiertos').map(Number);
    const { negocio } = await api(state.creatingBusiness ? '/negocios' : '/negocios/me', {
      method: state.creatingBusiness ? 'POST' : 'PUT',
      body: JSON.stringify(body),
    });
    state.businessId = String(negocio.id_negocio);
    localStorage.setItem('racristyle_business_id', state.businessId);
    state.creatingBusiness = false;
    const existingBusinesses = state.user.negocios || [];
    state.user.negocios = existingBusinesses.some(
      (business) => business.id_negocio === negocio.id_negocio,
    )
      ? existingBusinesses.map((business) =>
          business.id_negocio === negocio.id_negocio
            ? { ...business, nombre: negocio.nombre }
            : business,
        )
      : [
          ...existingBusinesses,
          {
            id_negocio: negocio.id_negocio,
            nombre: negocio.nombre,
            personalizacion_completa: false,
          },
        ];
    state.user = { ...state.user, negocio_nombre: negocio.nombre, ...negocio };
    $('#branding-form').hidden = false;
    notifyPublicPage();
    $('#save-status').textContent = '✓ Información guardada correctamente.';
    $('#welcome').hidden = true;
    $('#business-view-title').textContent = 'Crea tu Negocio';
    $('#business-form-title').textContent = 'Configura tu Negocio';
    setBusinessEditing(false);
    if (!wasExisting) {
      showDashboard();
      showView('business');
      $('#branding-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#branding-status').textContent = 'Personaliza la p\u00e1gina para continuar.';
    }
  } catch (error) {
    setError(form, error.message);
  } finally {
    updateFormButton(form);
    if (button.dataset.mode === 'save') {
      button.textContent = state.user?.id_negocio ? 'Guardar cambios →' : 'Guardar negocio →';
    }
  }
});

$$('[data-view]').forEach((button) =>
  button.addEventListener('click', () => showView(button.dataset.view)),
);

$('#open-service-form').addEventListener('click', () => {
  if (!state.user.id_negocio) {
    showView('business');
    $('#save-status').textContent = 'Primero guarda la información del negocio.';
    return;
  }
  $('#service-form').hidden = false;
  $('#service-form').removeAttribute('data-editing-id');
  $('#service-form-title').textContent = 'Nuevo servicio';
  $('#save-service').textContent = 'Agregar servicio →';
  $('#services-empty').hidden = true;
  $('#service-form').nombre.focus();
});

$('#cancel-service').addEventListener('click', () => {
  $('#service-form').reset();
  $('#service-form').removeAttribute('data-editing-id');
  $('#service-form-title').textContent = 'Nuevo servicio';
  $('#save-service').textContent = 'Agregar servicio →';
  $('#service-form').hidden = true;
  loadServices();
});

$('#services-list').addEventListener('click', async (event) => {
  const toggleButton = event.target.closest('.toggle-service');
  if (toggleButton) {
    const isActive = toggleButton.dataset.active === 'true';
    const action = isActive ? 'deshabilitar' : 'habilitar';
    const confirmed = await confirmAction({
      title: `${isActive ? 'Deshabilitar' : 'Habilitar'} servicio`,
      message: `¿Deseas ${action} este servicio? El catálogo público se actualizará automáticamente.`,
      confirmText: isActive ? 'Deshabilitar' : 'Habilitar',
      danger: isActive,
    });
    if (!confirmed) return;
    toggleButton.disabled = true;
    try {
      await api(`/servicios/${toggleButton.dataset.serviceId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !isActive }),
      });
      notifyPublicPage();
      await loadServices();
    } catch (error) {
      $('#services-error').textContent = error.message;
      toggleButton.disabled = false;
    }
    return;
  }
  const button = event.target.closest('.edit-service');
  if (!button) return;
  const service = state.services.find(
    (item) => String(item.id_servicio) === button.dataset.serviceId,
  );
  if (!service) return;
  const form = $('#service-form');
  form.dataset.editingId = service.id_servicio;
  form.nombre.value = service.nombre;
  form.descripcion.value = service.descripcion || '';
  form.precio.value = service.precio;
  form.duracion.value = service.duracion_minutos;
  updateFormButton(form);
  $('#service-form-title').textContent = 'Editar servicio';
  $('#save-service').textContent = 'Guardar cambios →';
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.nombre.focus();
});

$('#service-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!isFormComplete(form)) {
    setError(form, 'Completa correctamente todos los campos del servicio.');
    form.reportValidity();
    updateFormButton(form);
    return;
  }
  const button = $('button[type="submit"]', form);
  setError(form);
  button.disabled = true;
  button.textContent = 'Agregando...';
  try {
    const body = Object.fromEntries(new FormData(form));
    const editingId = form.dataset.editingId;
    await api(editingId ? `/servicios/${editingId}` : '/servicios', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    notifyPublicPage();
    form.reset();
    form.duracion.value = 30;
    form.removeAttribute('data-editing-id');
    $('#service-form-title').textContent = 'Nuevo servicio';
    $('#save-service').textContent = 'Agregar servicio →';
    form.hidden = true;
    await loadServices();
  } catch (error) {
    setError(form, error.message);
  } finally {
    button.disabled = false;
    button.textContent = form.dataset.editingId ? 'Guardar cambios →' : 'Agregar servicio →';
  }
});

$('#continue-to-team').addEventListener('click', () => {
  showView('team');
});

$('#continue-to-booking').addEventListener('click', () => {
  showView('booking');
});

$('#open-employee-form').addEventListener('click', () => {
  if (!state.user.id_negocio) {
    showView('business');
    $('#save-status').textContent = 'Primero guarda la información del negocio.';
    return;
  }
  $('#employee-form').hidden = false;
  $('#employee-form').removeAttribute('data-editing-id');
  $('#employee-form-title').textContent = 'Agregar trabajador';
  $('#save-employee').textContent = 'Agregar al equipo →';
  $('#employees-empty').hidden = true;
  $('#employee-form').nombre.focus();
});

$('#booking-complete-step').addEventListener('click', (event) => {
  const targetView = event.currentTarget.dataset.targetView;
  showView(targetView);
  if (targetView === 'services') $('#open-service-form').click();
  if (targetView === 'team') $('#open-employee-form').click();
});

$('#agenda-filters').addEventListener('submit', (event) => {
  event.preventDefault();
  loadAppointments();
});

$('#clear-agenda-filters').addEventListener('click', () => {
  $('#agenda-filters').reset();
  loadAppointments();
});

$('#refresh-agenda').addEventListener('click', loadAppointments);

$('#appointments-list').addEventListener('click', async (event) => {
  const button = event.target.closest('.cancel-appointment');
  if (!button) return;
  const reason = await requestCancellationReason(button.dataset.appointmentCode);
  if (!reason) return;
  button.disabled = true;
  button.textContent = 'Cancelando...';
  try {
    const result = await api(`/citas/${button.dataset.appointmentId}/cancelar`, {
      method: 'PATCH',
      body: JSON.stringify({ motivo: reason }),
    });
    await loadAppointments();
    $('#agenda-error').textContent = result.correoEnviado
      ? 'La cita fue cancelada y el cliente recibió el motivo por correo.'
      : 'La cita fue cancelada, pero no se pudo enviar el correo al cliente.';
  } catch (error) {
    $('#agenda-error').textContent = error.message;
    button.disabled = false;
    button.textContent = 'Cancelar cita';
  }
});

$('#cancel-employee').addEventListener('click', () => {
  $('#employee-form').reset();
  $('#employee-form').removeAttribute('data-editing-id');
  $('#employee-form-title').textContent = 'Agregar trabajador';
  $('#save-employee').textContent = 'Agregar al equipo →';
  $('#employee-form').hidden = true;
  loadEmployees();
});

$('#employees-list').addEventListener('click', async (event) => {
  const toggleButton = event.target.closest('.toggle-employee');
  if (toggleButton) {
    const isActive = toggleButton.dataset.active === 'true';
    const action = isActive ? 'deshabilitar' : 'habilitar';
    const confirmed = await confirmAction({
      title: `${isActive ? 'Deshabilitar' : 'Habilitar'} trabajador`,
      message: `¿Deseas ${action} este trabajador? La página de reservas se actualizará automáticamente.`,
      confirmText: isActive ? 'Deshabilitar' : 'Habilitar',
      danger: isActive,
    });
    if (!confirmed) return;
    toggleButton.disabled = true;
    try {
      await api(`/empleados/${toggleButton.dataset.employeeId}/estado`, {
        method: 'PATCH',
        body: JSON.stringify({ activo: !isActive }),
      });
      notifyPublicPage();
      await loadEmployees();
    } catch (error) {
      $('#employees-error').textContent = error.message;
      toggleButton.disabled = false;
    }
    return;
  }
  const button = event.target.closest('.edit-employee');
  if (!button) return;
  const employee = state.employees.find(
    (item) => String(item.id_empleado) === button.dataset.employeeId,
  );
  if (!employee) return;
  const form = $('#employee-form');
  form.dataset.editingId = employee.id_empleado;
  form.nombre.value = employee.nombre;
  form.especialidad.value = employee.especialidad || '';
  updateFormButton(form);
  $('#employee-form-title').textContent = 'Editar trabajador';
  $('#save-employee').textContent = 'Guardar cambios →';
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.nombre.focus();
});

$('#employee-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!isFormComplete(form)) {
    setError(form, 'Completa correctamente todos los campos del trabajador.');
    form.reportValidity();
    updateFormButton(form);
    return;
  }
  const button = $('button[type="submit"]', form);
  setError(form);
  button.disabled = true;
  button.textContent = form.dataset.editingId ? 'Guardando...' : 'Agregando...';
  try {
    const body = Object.fromEntries(new FormData(form));
    const editingId = form.dataset.editingId;
    await api(editingId ? `/empleados/${editingId}` : '/empleados', {
      method: editingId ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    notifyPublicPage();
    form.reset();
    form.removeAttribute('data-editing-id');
    $('#employee-form-title').textContent = 'Agregar trabajador';
    $('#save-employee').textContent = 'Agregar al equipo →';
    form.hidden = true;
    await loadEmployees();
  } catch (error) {
    setError(form, error.message);
  } finally {
    updateFormButton(form);
    button.textContent = form.dataset.editingId ? 'Guardar cambios →' : 'Agregar al equipo →';
  }
});

$('#logout').addEventListener('click', async () => {
  const confirmed = await confirmAction({
    title: 'Cerrar sesión',
    message: '¿Seguro que deseas salir de tu espacio de trabajo?',
    confirmText: 'Cerrar sesión',
  });
  if (!confirmed) return;
  localStorage.removeItem('racristyle_token');
  location.href = '/';
});

if (state.token) loadSession();
