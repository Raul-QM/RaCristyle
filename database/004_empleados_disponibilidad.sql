CREATE TABLE IF NOT EXISTS empleado (
  id_empleado SERIAL PRIMARY KEY,
  id_negocio INTEGER NOT NULL REFERENCES negocio(id_negocio) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  especialidad VARCHAR(120),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE cita
  ADD COLUMN IF NOT EXISTS id_empleado INTEGER REFERENCES empleado(id_empleado);

CREATE INDEX IF NOT EXISTS idx_empleado_negocio ON empleado(id_negocio);
CREATE INDEX IF NOT EXISTS idx_cita_empleado_disponibilidad
  ON cita(id_empleado, fecha_inicio, fecha_fin)
  WHERE estado <> 'Cancelada';
