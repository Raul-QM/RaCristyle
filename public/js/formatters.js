export function capitalizeFirst(value) {
  return value.replace(/^./u, (letter) => letter.toLocaleUpperCase('es-CR'));
}

export function formatMoney(value) {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildWhatsappUrl(phone, message = '') {
  let digits = String(phone || '').replace(/\D/g, '');
  if (digits.length === 8) digits = `506${digits}`;
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
}

export function formatPhone(phone) {
  const value = String(phone || '').trim();
  const digits = value.replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : value;
}
