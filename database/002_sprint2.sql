CREATE TABLE IF NOT EXISTS servicio (
  id_servicio SERIAL PRIMARY KEY,
  id_negocio INTEGER NOT NULL REFERENCES negocio(id_negocio) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion VARCHAR(300),
  precio NUMERIC(10,2) NOT NULL CHECK (precio > 0),
  duracion_minutos INTEGER NOT NULL CHECK (duracion_minutos BETWEEN 5 AND 480),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cita (
  id_cita SERIAL PRIMARY KEY,
  id_negocio INTEGER NOT NULL REFERENCES negocio(id_negocio) ON DELETE CASCADE,
  id_servicio INTEGER NOT NULL REFERENCES servicio(id_servicio),
  cliente_nombre VARCHAR(100) NOT NULL,
  cliente_email VARCHAR(150) NOT NULL,
  cliente_telefono VARCHAR(20) NOT NULL,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin TIMESTAMPTZ NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'Confirmada'
    CHECK (estado IN ('Pendiente', 'Confirmada', 'Cancelada', 'Completada')),
  codigo_confirmacion VARCHAR(12) UNIQUE NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_servicio_negocio ON servicio(id_negocio);
CREATE INDEX IF NOT EXISTS idx_cita_disponibilidad
  ON cita(id_negocio, fecha_inicio, fecha_fin)
  WHERE estado <> 'Cancelada';
