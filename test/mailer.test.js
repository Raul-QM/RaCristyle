import test from 'node:test';
import assert from 'node:assert/strict';

const { buildBusinessSender } = await import('../src/lib/mailer.js');

test('los correos muestran la identidad del negocio y responden al propietario', () => {
  const sender = buildBusinessSender('Barbería Central', 'dueno@example.com');

  assert.equal(sender.from.name, 'Barbería Central');
  assert.match(sender.from.address, /^[^\s@]+@[^\s@]+$/);
  assert.equal(sender.replyTo, 'dueno@example.com');
});

test('el remitente elimina saltos de línea del nombre visible', () => {
  const sender = buildBusinessSender('Spa Central\r\nCopia', 'spa@example.com');

  assert.equal(sender.from.name, 'Spa Central  Copia');
});
