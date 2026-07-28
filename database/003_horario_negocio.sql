ALTER TABLE negocio
  ADD COLUMN IF NOT EXISTS hora_apertura TIME NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS hora_cierre TIME NOT NULL DEFAULT '18:00';

ALTER TABLE negocio
  DROP CONSTRAINT IF EXISTS negocio_horario_valido;

ALTER TABLE negocio
  ADD CONSTRAINT negocio_horario_valido CHECK (hora_apertura < hora_cierre);
