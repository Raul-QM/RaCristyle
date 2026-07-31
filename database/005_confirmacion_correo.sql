ALTER TABLE cita
  ADD COLUMN IF NOT EXISTS token_confirmacion_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS confirmacion_expira TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS confirmado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS correo_enviado_en TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_cita_token_confirmacion
  ON cita(token_confirmacion_hash)
  WHERE token_confirmacion_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cita_pendiente_expiracion
  ON cita(confirmacion_expira)
  WHERE estado = 'Pendiente';
