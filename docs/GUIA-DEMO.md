# Guía de demostración — Producción y defensa

## Entorno de presentación

El sistema desplegado está disponible en producción:

| Componente | Dirección |
| --- | --- |
| Aplicación pública | <https://ra-cristyle.vercel.app/> |
| API REST | <https://ra-cristyle.vercel.app/api> |
| Endpoint de salud | <https://ra-cristyle.vercel.app/api/health> |
| Página de reservas | <https://ra-cristyle.vercel.app/reservar.html> |

**Credenciales de demostración:**

| Campo | Valor |
| --- | --- |
| Correo | `demo@racristyle.local` |
| Contraseña | `DemoRacri123` |

## Recorrido de presentación (10–12 minutos)

### 1. Portada y problema que resuelve

Abra <https://ra-cristyle.vercel.app/> y presente la interfaz. RaCristyle permite que
barberías, salones de belleza y spas administren su presencia y reciban reservas en línea.

### 2. Registro e inicio de sesión

1. Pulse **Crear cuenta** y registre un dueño nuevo con nombre, correo y contraseña.
2. Muestre que un segundo registro con el mismo correo es rechazado.
3. Cierre sesión e ingrese con las credenciales de demostración para demostrar
   autenticación JWT y persistencia.

### 3. Creación y selección de varios negocios

1. Complete nombre, descripción, teléfono y dirección del primer negocio.
2. Vuelva al panel y registre un segundo negocio diferente.
3. Muestre que es posible alternar entre ambos sin mezclar servicios, trabajadores
   ni citas.

### 4. Configuración del negocio

1. Defina la hora de apertura y cierre del negocio.
2. Verifique que el teléfono enlaza directamente con WhatsApp mediante `wa.me`.
3. Los números de ocho dígitos reciben automáticamente el prefijo de Costa Rica `506`.

### 5. Personalización de la página pública

1. Acceda a la sección de personalización del negocio.
2. Suba un logo, ajuste colores de acento y seleccione un fondo.
3. Abra la página de reservas y compruebe que los cambios se reflejan inmediatamente.

### 6. Creación de servicios y trabajadores

1. Abra **Servicios** y agregue al menos dos, por ejemplo:
   - Corte clásico, ₡6 500, 30 minutos.
   - Barba premium, ₡4 500, 25 minutos.
2. Abra **Equipo** y registre dos profesionales, por ejemplo Andrés Mora y Daniel Vargas.
3. Verifique que los servicios y trabajadores aparecen en la página pública.

### 7. Página pública de reservas y selección de horario

1. Abra la página de reservas desde el enlace público del negocio.
2. Seleccione un servicio, una fecha futura y un profesional.
3. El sistema muestra únicamente las horas realmente disponibles en intervalos de
   15 minutos; la duración completa del servicio debe caber dentro del horario de
   atención del negocio.

### 8. Reserva y confirmación por correo

1. Complete nombre, teléfono y correo del cliente.
2. Envíe la reserva. La cita queda en estado **Pendiente** con código `RC-XXXXXXXX`.
3. En el panel de demostración, use el botón de simulación para revisar el contenido
   del correo. En producción, el correo se envía por SMTP real.
4. Confirme desde el enlace y muestre la pantalla de cita confirmada.

### 9. Comportamiento con cita ya confirmada

1. Intente usar el mismo enlace de confirmación una segunda vez.
2. El sistema responde indicando que la cita ya fue confirmada y no permite una
   segunda confirmación.

### 10. Consulta de agenda

1. Acceda a la sección **Agenda** del panel administrativo.
2. Muestre las citas listadas cronológicamente con fecha, horario, cliente, contacto,
   servicio, trabajador, precio, código y estado.
3. Filtre por fecha y por estado (Pendiente, Confirmada, Cancelada).
4. Verifique que el resumen refleja correctamente los totales del filtro actual.

### 11. Cancelación con motivo

1. Seleccione una cita pendiente o confirmada y pulse **Cancelar cita**.
2. Ingrese un motivo obligatorio (por ejemplo: "El cliente solicitó cambio de fecha").
3. La cita cambia a estado **Cancelada** y el horario vuelve a estar disponible.

### 12. Correo de cancelación y enlace cancelado

1. Revise el contenido del correo de cancelación, que incluye el motivo registrado.
2. Si el cliente intenta usar el enlace de confirmación original después de la
   cancelación, el sistema informa que la cita fue cancelada y muestra el motivo.

### 13. Múltiples profesionales y disponibilidad

1. Reserve una hora con un profesional y verifique que esa hora desaparece para esa
   persona, pero continúa disponible para otro integrante del equipo.
2. Dos profesionales distintos pueden atender citas a la misma hora.

## Qué mostrar durante la defensa

| Elemento | Qué demostrar |
| --- | --- |
| GitHub | Ramas de trabajo, Pull Requests, historial de commits, 41 pruebas aprobadas |
| Vercel | Despliegue automático desde main, dominio público, función serverless |
| Neon | PostgreSQL 16 en la nube, migraciones aplicadas, datos persistentes |

## Docker como respaldo local

Si Vercel no está disponible durante la presentación, Docker Compose levanta el
sistema completo en la máquina local:

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Abra `http://localhost:3000`. PostgreSQL queda en `localhost:5433`. No es necesario
ejecutar Docker si Vercel responde correctamente. Detenga con:

```bash
docker compose down
```

No use `docker compose down -v` a menos que desee eliminar la base de datos del
entorno Docker.

## Preguntas probables

- **¿Dónde se cifran las contraseñas?** En el backend con bcrypt y 12 rondas.
- **¿Cómo se evita la inyección SQL?** Todas las consultas usan parámetros `$1`, `$2`.
- **¿Cómo se evita la doble reserva?** Una transacción bloquea al profesional, calcula
  el fin según la duración y rechaza cualquier intervalo solapado.
- **¿La API está protegida?** JWT en rutas privadas, Helmet, validación Zod y límite
  de 100 solicitudes por minuto.
- **¿Se envía correo real?** Sí. Nodemailer usa SMTP y envía un botón con un token
  que vence en 15 minutos. El hash SHA-256 del token se almacena en la base de datos.
- **¿Cómo funciona multi-negocio?** Una misma cuenta administra varios negocios
  independientes. El JWT identifica al dueño y cada consulta filtra por negocio.
- **¿Qué pasa si el negocio está cerrado?** La reserva rechaza cualquier cita cuya
  duración completa no quepa dentro del horario de atención configurado.
- **¿Cómo se personaliza la página pública?** Logo, colores de acento y fondo se
  configuran por negocio y se reflejan inmediatamente en la página de reservas.

## Reparto sugerido

- **Raúl:** arquitectura, seguridad, Sprint 1, autenticación, despliegue en Vercel
  y Neon, GitHub Actions.
- **Cristian:** Sprint 2, 3 y 4, reservas, disponibilidad, agenda, cancelaciones,
  personalización, documentación y presentación de la demo.
