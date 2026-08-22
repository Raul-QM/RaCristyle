# Guía de demostración — Sprint 1 y Sprint 2

## Antes de la clase

Desde la carpeta del proyecto:

```bash
npm install
npm test
npm run demo
```

Abra `http://localhost:3000`. El modo demo no requiere PostgreSQL instalado y reinicia
los datos al cerrarse. Para un entorno real use PostgreSQL 16 según el README.

## Recorrido sugerido (6–8 minutos)

1. Presente la portada adaptable y explique el problema que resuelve RaCristyle.
2. Pulse **Crear cuenta** y registre un dueño con una contraseña como `Demo1234`.
3. Muestre que un segundo registro con el mismo correo es rechazado.
4. Complete nombre, descripción, teléfono y dirección del negocio.
5. Cierre sesión e ingrese de nuevo para demostrar autenticación y persistencia.
6. Abra **Equipo** y agregue dos profesionales, por ejemplo Andrés Mora y Daniel Vargas.
7. Abra **Servicios**, agregue por ejemplo:
   - Corte clásico, ₡6 500, 30 minutos.
   - Barba premium, ₡4 500, 25 minutos.
8. Pulse **Abrir página** y enseñe cómo el cliente elige profesional y solo puede
   seleccionar horas libres dentro del horario de atención.
9. Reserve una cita y destaque el estado pendiente, el código `RC-XXXXXXXX` y el
   enlace enviado por correo. En modo demo use el botón de simulación.
10. Confirme desde el enlace y muestre la pantalla de cita confirmada.
11. Muestre que la hora ocupada desaparece para ese profesional, pero continúa
    disponible para otro integrante del equipo.
12. Finalice ejecutando `npm test` y enseñando las 15 pruebas aprobadas.

## Reparto real sugerido

- **Raúl:** explica arquitectura, seguridad, Sprint 1 y autenticación.
- **Cristian:** revisa el ZIP, ejecuta las pruebas, propone o realiza cualquier ajuste
  propio y presenta Sprint 2 (servicios, reservas y control de disponibilidad).

## Preguntas probables

- **¿Dónde se cifran las contraseñas?** En el backend con bcrypt y 12 rondas.
- **¿Cómo se evita la inyección SQL?** Todas las consultas usan parámetros `$1`, `$2`.
- **¿Cómo se evita la doble reserva?** Una transacción bloquea al profesional, calcula
  el fin según la duración y rechaza cualquier intervalo solapado en su agenda.
- **¿La API está protegida?** JWT en rutas privadas, Helmet, validación Zod y límite de
  100 solicitudes por minuto.
- **¿Por qué el enlace usa un ID?** El subdominio corresponde a HU-10 del Sprint 4;
  Sprint 2 utiliza un enlace público funcional sin adelantar ese alcance.
- **¿Se envía correo real?** Sí. Nodemailer usa SMTP y envía un botón con un token que
  vence en 15 minutos. En la demo sin credenciales se ofrece una simulación equivalente.
