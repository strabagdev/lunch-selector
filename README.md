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

Disparo manual:

- Desde `/admin` con el bot&oacute;n `Cerrar y enviar resumen`.
- Desde el navegador: `/api/reports/daily?secret=<REPORT_CRON_SECRET>`.

Disparo autom&aacute;tico:

- El endpoint `/api/reports/daily` acepta `GET` y `POST`.
- En cada ejecuci&oacute;n cierra las solicitudes del d&iacute;a actual y luego env&iacute;a el correo.
- Debe recibir el header `Authorization: Bearer <REPORT_CRON_SECRET>` o el query param `secret`.

En Vercel:

- `vercel.json` programa el env&iacute;o de lunes a viernes a las `16:00 UTC`.
- Esa hora equivale a las `12:00` en Santiago durante horario de invierno y a las `13:00` durante horario de verano.
- Para cambiar la hora, edita `schedule` usando cron UTC.

En Railway:

- Crear un Cron Job que haga `POST` a `/api/reports/daily`.
- Enviar header `Authorization: Bearer <REPORT_CRON_SECRET>`.
- Configurar la hora en UTC.

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
