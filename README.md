# Envíos Ayora — Rastreo

Sitio público (sin login) para que los clientes de ENVIOS AYORA rastreen sus
paquetes por número de guía o código de cliente. Es un proyecto aparte del
sistema administrativo principal, pero **lee de la misma base de datos**
(Aiven Postgres) — solo hace consultas (`SELECT`), nunca modifica nada.

## Configuración

1. `npm install`
2. Copia `.env.example` a `.env.local` y pon ahí la misma `DATABASE_URL` del
   proyecto principal (la de tu cuenta de Aiven).
3. `npm run dev` para probar en local, o despliega en Vercel con esa misma
   variable de entorno configurada.

## Estructura

- `pages/index.js` — la página de rastreo (caja de búsqueda + línea de tiempo).
- `pages/api/rastrear/[guia].js` — API que busca el paquete por guía o código
  de cliente y regresa su historial de estados.
- `lib/db.js` / `lib/pg-connection.js` — conexión de solo lectura a Postgres.
