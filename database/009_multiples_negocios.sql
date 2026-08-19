ALTER TABLE negocio
  DROP CONSTRAINT IF EXISTS negocio_id_usuario_key,
  ADD COLUMN IF NOT EXISTS personalizacion_completa BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE negocio
SET personalizacion_completa = TRUE
WHERE logo_data IS NOT NULL
   OR fondo_tipo <> 'claro'
   OR color_primario <> '#d9ff43'
   OR color_secundario <> '#171713';

CREATE INDEX IF NOT EXISTS idx_negocio_usuario ON negocio(id_usuario);
