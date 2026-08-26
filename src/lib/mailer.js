import nodemailer from 'nodemailer';
import { config } from '../config.js';

// El ejecutor de pruebas de Node define esta variable en sus procesos hijos.
// Así las pruebas nunca envían mensajes reales aunque el .env local use SMTP.
const isTestRun = Boolean(process.env.NODE_TEST_CONTEXT);
const useSmtp = config.mail.mode === 'smtp' && !isTestRun;

const transporter = useSmtp
  ? nodemailer.createTransport({
      pool: true,
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: {
        user: config.mail.user,
        pass: config.mail.pass,
      },
    })
  : nodemailer.createTransport({ jsonTransport: true });

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function capitalizeFirst(value) {
  return value.replace(/^./u, (letter) => letter.toLocaleUpperCase('es-CR'));
}

function getSenderAddress() {
  if (config.mail.user) return config.mail.user;
  const match = config.mail.from.match(/<([^>]+)>/);
  return match?.[1] || config.mail.from;
}

/**
 * Conserva una única cuenta SMTP, pero presenta cada mensaje con la identidad
 * del negocio y dirige las respuestas al correo verificado de su propietario.
 */
export function buildBusinessSender(business, replyTo) {
  const safeBusinessName = String(business || 'RaCristyle')
    .replace(/[\r\n]/g, ' ')
    .trim();
  return {
    from: { name: safeBusinessName, address: getSenderAddress() },
    ...(replyTo ? { replyTo } : {}),
  };
}

function buildEmailBranding(branding = {}) {
  const validColor = (value, fallback) => (/^#[0-9a-f]{6}$/i.test(value || '') ? value : fallback);
  const primary = validColor(branding.color_primario, '#d9ff43');
  const secondary = validColor(branding.color_secundario, '#171713');
  const backgrounds = { claro: '#f4f1e8', arena: '#d8c7a5', oscuro: '#24241f' };
  const background = backgrounds[branding.fondo_tipo] || backgrounds.claro;
  const attachments = [];
  let logo = '';
  const match = branding.logo_data?.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/s);
  if (match) {
    const extension = match[1] === 'image/jpeg' ? 'jpg' : match[1].split('/')[1];
    attachments.push({
      filename: `logo-negocio.${extension}`,
      content: Buffer.from(match[2], 'base64'),
      contentType: match[1],
      contentDisposition: 'inline',
      cid: 'business-logo',
    });
    logo =
      '<img src="cid:business-logo" alt="Logo del negocio" width="64" height="64" style="display:block;width:64px;height:64px;object-fit:cover;border-radius:50%;margin-bottom:14px" />';
  }
  return { primary, secondary, background, attachments, logo };
}

export async function sendBookingConfirmation({
  to,
  customer,
  business,
  service,
  professional,
  price,
  date,
  code,
  token,
  branding,
  replyTo,
}) {
  const theme = buildEmailBranding(branding);
  const confirmationUrl = `${config.appUrl}/confirmar.html?token=${encodeURIComponent(token)}`;
  const formattedDate = capitalizeFirst(
    new Intl.DateTimeFormat('es-CR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(date)),
  );
  const formattedPrice = new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(price);

  const info = await transporter.sendMail({
    ...buildBusinessSender(business, replyTo),
    to,
    attachments: theme.attachments,
    // El código vuelve único el asunto y evita que Gmail agrupe mensajes
    // parecidos ocultando el botón como contenido repetido.
    subject: `Confirma tu cita ${code} en ${business}`,
    text:
      `Hola ${customer}. Confirma tu cita en ${business}: ${service} con ${professional}, ` +
      `${formattedDate}, ${formattedPrice}. Código ${code}. ` +
      `El enlace vence en ${config.confirmationMinutes} minutos: ${confirmationUrl}`,
    html: `
      <div style="background:${theme.background};padding:32px;font-family:Arial,sans-serif;color:#171713">
        <div style="max-width:560px;margin:auto;background:#fffefa;border:1px solid #d7d2c7">
          <div style="background:${theme.secondary};color:white;padding:24px;border-bottom:6px solid ${theme.primary}">
            ${theme.logo}
            <div style="font-size:11px;letter-spacing:2px;color:${theme.primary}">${escapeHtml(business)}</div>
            <h1 style="margin:8px 0 0;font-family:Georgia,serif">Confirma tu cita</h1>
          </div>
          <div style="padding:28px">
            <p>Hola <b>${escapeHtml(customer)}</b>, recibimos tu solicitud en
              <b>${escapeHtml(business)}</b>.</p>
            <a href="${confirmationUrl}" style="display:block;padding:15px;background:${theme.primary};color:${theme.secondary};text-align:center;text-decoration:none;font-weight:bold;border:1px solid ${theme.secondary};margin:20px 0">
              Confirmar cita
            </a>
            <table style="width:100%;border-collapse:collapse;margin:20px 0">
              <tr><td style="padding:9px;border-bottom:1px solid #eee">Servicio</td><td style="padding:9px;text-align:right;border-bottom:1px solid #eee"><b>${escapeHtml(service)}</b></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #eee">Trabajador</td><td style="padding:9px;text-align:right;border-bottom:1px solid #eee"><b>${escapeHtml(professional)}</b></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #eee">Fecha</td><td style="padding:9px;text-align:right;border-bottom:1px solid #eee"><b>${escapeHtml(formattedDate)}</b></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #eee">Precio</td><td style="padding:9px;text-align:right;border-bottom:1px solid #eee"><b>${escapeHtml(formattedPrice)}</b></td></tr>
              <tr><td style="padding:9px">Código</td><td style="padding:9px;text-align:right"><b>${escapeHtml(code)}</b></td></tr>
            </table>
            <p style="font-size:12px;color:#77766f;margin-top:18px">
              Este enlace vence en ${config.confirmationMinutes} minutos. Si no solicitaste
              esta cita, ignora el mensaje y el horario se liberará automáticamente.
            </p>
          </div>
        </div>
      </div>`,
  });

  return {
    messageId: info.messageId,
    confirmationUrl,
    simulated: !useSmtp,
  };
}

/** Envía al cliente el motivo registrado por el negocio al cancelar su cita. */
export async function sendBookingCancellation({
  cliente_email: to,
  cliente_nombre: customer,
  negocio: business,
  servicio: service,
  trabajador,
  fecha_inicio: date,
  codigo_confirmacion: code,
  motivo_cancelacion: reason,
  logo_data,
  fondo_tipo,
  color_primario,
  color_secundario,
  propietario_email: replyTo,
}) {
  const theme = buildEmailBranding({ logo_data, fondo_tipo, color_primario, color_secundario });
  const formattedDate = capitalizeFirst(
    new Intl.DateTimeFormat('es-CR', {
      dateStyle: 'full',
      timeStyle: 'short',
    }).format(new Date(date)),
  );
  const subject = `Cita ${code} cancelada por ${business}`;
  const text =
    `Hola ${customer}. Tu cita ${code} para ${service} con ${trabajador}, ` +
    `${formattedDate}, fue cancelada por ${business}. Motivo: ${reason}`;
  const info = await transporter.sendMail({
    ...buildBusinessSender(business, replyTo),
    to,
    subject,
    text,
    attachments: theme.attachments,
    html: `
      <div style="background:${theme.background};padding:32px;font-family:Arial,sans-serif;color:#171713">
        <div style="max-width:560px;margin:auto;background:#fffefa;border:1px solid #d7d2c7">
          <div style="background:${theme.secondary};color:white;padding:24px;border-bottom:6px solid ${theme.primary}">
            ${theme.logo}
            <div style="font-size:11px;letter-spacing:2px;color:${theme.primary}">${escapeHtml(business)}</div>
            <h1 style="margin:8px 0 0;font-family:Georgia,serif">Tu cita fue cancelada</h1>
          </div>
          <div style="padding:28px">
            <p>Hola <b>${escapeHtml(customer)}</b>, el negocio canceló tu cita.</p>
            <table style="width:100%;border-collapse:collapse;margin:20px 0">
              <tr><td style="padding:9px;border-bottom:1px solid #eee">Servicio</td><td style="padding:9px;text-align:right;border-bottom:1px solid #eee"><b>${escapeHtml(service)}</b></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #eee">Trabajador</td><td style="padding:9px;text-align:right;border-bottom:1px solid #eee"><b>${escapeHtml(trabajador || 'Sin asignar')}</b></td></tr>
              <tr><td style="padding:9px;border-bottom:1px solid #eee">Fecha</td><td style="padding:9px;text-align:right;border-bottom:1px solid #eee"><b>${escapeHtml(formattedDate)}</b></td></tr>
              <tr><td style="padding:9px">Código</td><td style="padding:9px;text-align:right"><b>${escapeHtml(code)}</b></td></tr>
            </table>
            <div style="padding:18px;background:${theme.background};border-left:5px solid ${theme.primary}">
              <b>Motivo de cancelación</b>
              <p style="margin:8px 0 0">${escapeHtml(reason)}</p>
            </div>
          </div>
        </div>
      </div>`,
  });
  return { messageId: info.messageId, simulated: !useSmtp };
}
