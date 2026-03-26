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

## Siguiente paso sugerido

Implementar acciones y formularios para administrar personas, d&iacute;as de men&uacute; y opciones usando este esquema como base.
