CREATE TABLE IF NOT EXISTS usuario (
  id_usuario SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS negocio (
  id_negocio SERIAL PRIMARY KEY,
  id_usuario INTEGER UNIQUE NOT NULL REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT NOT NULL,
  telefono VARCHAR(20),
  direccion VARCHAR(150),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usuario_email ON usuario(email);
