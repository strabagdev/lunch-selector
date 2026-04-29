## Registro de almuerzo

MVP en Next.js para seleccionar almuerzos diarios por persona, con administraci&oacute;n de personas, d&iacute;as de men&uacute;, opciones por d&iacute;a y reportes.

## Base actual

- App Router listo con rutas p&uacute;blicas y administrativas.
- Sin autenticaci&oacute;n.
- Prisma configurado para PostgreSQL.
- Modelo inicial pensado para despliegue futuro en Railway.

## Modelo de datos

- `Person`: personas que pueden seleccionar almuerzo.
- `MenuDay`: un d&iacute;a de men&uacute; por fecha.
- `MenuOption`: opciones disponibles para un `MenuDay`.
- `LunchSelection`: selecci&oacute;n de una persona para un d&iacute;a.

Reglas incluidas en el esquema:

- Una persona solo puede tener una selecci&oacute;n por d&iacute;a: `@@unique([personId, menuDayId])`.
- Cada d&iacute;a tiene su propio conjunto de opciones.
- La selecci&oacute;n apunta a una opci&oacute;n del mismo d&iacute;a de men&uacute;.

## Primeros pasos

1. Crear variables de entorno:

```bash
cp .env.example .env
```

2. Instalar dependencias:

```bash
npm install
```

3. Generar Prisma Client:

```bash
npm run prisma:generate
```

4. Crear la primera migraci&oacute;n cuando ya tengas PostgreSQL disponible:

```bash
npm run prisma:migrate:dev -- --name init
```

5. Levantar la app:

```bash
npm run dev
```

## Reporte diario por correo

La app puede enviar un resumen del d&iacute;a actual con el conteo total por opci&oacute;n, incluyendo opciones con `0`.

Variables requeridas:

- `RESEND_API_KEY`: API key de Resend.
- `REPORT_FROM_EMAIL`: remitente verificado en Resend.
- `REPORT_RECIPIENTS`: correos separados por coma.
- `REPORT_EMAIL_SUBJECT_PREFIX`: asunto base del correo. Por defecto `Resumen almuerzos`.
- `REPORT_CRON_SECRET`: secreto para proteger el endpoint del cron. En Vercel tambi&eacute;n puedes usar `CRON_SECRET`.
- `REPORT_TIMEZONE`: por defecto `America/Santiago`.
- `REPORT_SCHEDULED_LOCAL_HOUR`: hora local para el env&iacute;o autom&aacute;tico. Temporalmente `21`.
- `REPORT_SCHEDULED_LOCAL_MINUTE`: minuto local para el env&iacute;o autom&aacute;tico. Temporalmente `50`.
- `REPORT_SCHEDULED_WINDOW_MINUTES`: ventana de tolerancia para Railway Cron. Por defecto `5`.
- `WHATSAPP_REPORT_ENABLED`: usa `1` para enviar tambi&eacute;n por WhatsApp.
- `WHATSAPP_ACCESS_TOKEN`: token de Meta WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: ID del n&uacute;mero emisor en WhatsApp Cloud API.
- `WHATSAPP_REPORT_RECIPIENTS`: n&uacute;meros destino en formato internacional, separados por coma.
- `WHATSAPP_GRAPH_API_VERSION`: versi&oacute;n de Graph API. Por defecto `v23.0`.

Disparo manual:

- Desde `/admin` con el bot&oacute;n `Cerrar y enviar resumen`.
- Desde el navegador: `/api/reports/daily?secret=<REPORT_CRON_SECRET>`.

Disparo autom&aacute;tico:

- El endpoint `/api/reports/daily` acepta `GET` y `POST`.
- En cada ejecuci&oacute;n cierra las solicitudes del d&iacute;a actual y luego env&iacute;a el correo. Si WhatsApp est&aacute; habilitado, tambi&eacute;n env&iacute;a el mismo resumen por WhatsApp.
- Debe recibir el header `Authorization: Bearer <REPORT_CRON_SECRET>` o el query param `secret`.

WhatsApp:

- La integraci&oacute;n usa Meta WhatsApp Cloud API y env&iacute;a texto libre a `/<WHATSAPP_PHONE_NUMBER_ID>/messages`.
- Para mensajes iniciados por la empresa, Meta puede exigir plantillas aprobadas fuera de la ventana de 24 horas de conversaci&oacute;n.
- `WHATSAPP_REPORT_RECIPIENTS` debe usar n&uacute;meros con c&oacute;digo de pa&iacute;s y sin espacios, por ejemplo `56912345678`.

En Railway:

- Crear un servicio cron con start command `npm run report:scheduled`.
- Configurar el Cron Schedule en UTC. Para probar a las `21:50` Santiago, usar `50 1 * * 2-6`.
- El comando revisa `REPORT_TIMEZONE` y solo cierra/env&iacute;a dentro de la ventana definida por `REPORT_SCHEDULED_LOCAL_HOUR`, `REPORT_SCHEDULED_LOCAL_MINUTE` y `REPORT_SCHEDULED_WINDOW_MINUTES`.
- El doble horario UTC cubre horario de verano e invierno; la compuerta local evita env&iacute;os duplicados.

## PWA

La app incluye una configuraci&oacute;n base de PWA para poder instalarse en el celular:

- `app/manifest.ts`: manifiesto web.
- `app/icon.tsx` y `app/apple-icon.tsx`: iconos generados por Next.
- `public/sw.js`: service worker b&aacute;sico.
- `app/pwa-provider.tsx`: registro del service worker en cliente.

Para probar la instalaci&oacute;n:

- abrir la app desde el navegador del celular
- usar `Agregar a pantalla de inicio` o el prompt de instalaci&oacute;n del navegador

## Siguiente paso sugerido

Implementar acciones y formularios para administrar personas, d&iacute;as de men&uacute; y opciones usando este esquema como base.
