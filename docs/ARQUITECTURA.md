# Arquitectura de RaCristyle

El proyecto sigue una separación por responsabilidades para evitar mezclar HTTP, reglas del
negocio y acceso a PostgreSQL.

```text
Navegador
  └─ public/                    Interfaz y módulos compartidos
       └─ API HTTP
            └─ src/routes/     Rutas, validación y códigos HTTP
                 └─ src/services/       Reglas y casos de uso
                      └─ src/repositories/ Consultas SQL
                           └─ src/db.js   Pool de PostgreSQL
```

## Responsabilidades

- `src/routes`: valida entradas con Zod y traduce resultados a respuestas HTTP. No contiene SQL.
- `src/services`: implementa reglas que coordinan varias operaciones, como disponibilidad,
  confirmación y reserva transaccional.
- `src/repositories`: concentra consultas parametrizadas y operaciones de persistencia.
- `src/lib`: contiene infraestructura transversal de autenticación, correo, errores y validación.
- `public/js`: comparte utilidades de API, DOM y formato entre las páginas del frontend.
- `database`: conserva migraciones ordenadas y reproducibles.
- `test`: verifica los criterios de aceptación de cada sprint mediante la API.

## Decisiones relevantes

- Las reservas se crean dentro de una transacción y bloquean al trabajador seleccionado para
  reducir conflictos concurrentes.
- Los enlaces de confirmación guardan únicamente el hash SHA-256 del token.
- Una reserva pendiente conserva el espacio durante el plazo configurado y se cancela al vencer.
- Todas las consultas reciben parámetros separados del SQL para evitar inyección.
- La zona horaria se fija en `America/Costa_Rica` en Node.js y PostgreSQL.

## Calidad automática

```bash
npm run lint
npm run format:check
npm test
```

El comando `npm run quality` ejecuta las tres verificaciones en ese orden.
