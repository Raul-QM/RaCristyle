# Lista de comprobación — Entrega y defensa

Use esta lista para verificar el estado del proyecto antes de la defensa.

## Sistema desplegado

- [ ] URL pública disponible: <https://ra-cristyle.vercel.app/>
- [ ] Endpoint de salud respondiendo: <https://ra-cristyle.vercel.app/api/health>
- [ ] Credenciales de demostración funcionando (`demo@racristyle.local` / `DemoRacri123`)

## Funcionalidades verificadas

- [ ] Registro de un nuevo dueño con validación de correo único
- [ ] Inicio de sesión con JWT y persistencia de sesión
- [ ] Creación y selección de varios negocios independientes
- [ ] Configuración del negocio (horarios, teléfono, dirección)
- [ ] Personalización por negocio (logo, colores, fondo)
- [ ] Creación de servicios con precios y duración
- [ ] Creación de trabajadores con especialidad
- [ ] Página pública de reservas accesible por negocio
- [ ] Selección de fecha, horario y trabajador con disponibilidad real
- [ ] Reserva con validación de horario y profesional
- [ ] Correo de confirmación enviado con código y enlace
- [ ] Confirmación de cita mediante enlace
- [ ] Confirmación repetida indicando que la cita ya fue confirmada
- [ ] Cancelación con motivo obligatorio
- [ ] Correo de cancelación con el motivo registrado
- [ ] Enlace de cita cancelada sin posibilidad de confirmación
- [ ] Agenda privada con filtros por fecha y estado
- [ ] Gestión de varios negocios desde una misma cuenta

## Documentación

- [ ] README completo con instrucciones, API y tecnologías
- [ ] Documentación Sprint 1 (`docs/SPRINT-1.md`)
- [ ] Documentación Sprint 2 (`docs/SPRINT-2.md`)
- [ ] Documentación Sprint 3 (`docs/SPRINT-3.md`)
- [ ] Documentación Sprint 4 (`docs/SPRINT-4.md`)
- [ ] Guía de demostración actualizada (`docs/GUIA-DEMO.md`)
- [ ] Arquitectura del sistema (`docs/ARQUITECTURA.md`)
- [ ] Documento final de cierre preparado

## Repositorio y ramas

- [ ] Rama `main` estable y sin conflictos
- [ ] Ramas de trabajo documentadas en Pull Requests
- [ ] Historial de commits claro y coherente

## Calidad del código

- [ ] 41 pruebas automatizadas aprobadas (`npm run quality`)
- [ ] ESLint sin errores
- [ ] Prettier sin inconsistencias de formato

## Infraestructura

- [ ] Vercel desplegado y funcionando
- [ ] Neon con PostgreSQL 16 operativo
- [ ] Docker como respaldo local disponible

## Preparación para la presentación

- [ ] GitHub con Pull Requests y código fuente visible
- [ ] Vercel con la aplicación funcionando en producción
- [ ] Neon con la base de datos en la nube
- [ ] Correo configurado para envío real (o simulación para demo)
- [ ] Documento final de integración preparado
