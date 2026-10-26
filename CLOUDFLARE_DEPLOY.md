# Despliegue en Cloudflare Workers

**Despliegue activo:** https://vianova.netherstar44.workers.dev

La app se despliega como un Worker con assets estáticos:

- `server/worker.ts` monta Express con `cloudflare:node`.
- El frontend compilado se sirve desde `dist/public`.
- Las rutas `/api` y `/api/*` van primero al Worker; el resto se sirve como SPA.
- La base de datos usa Neon HTTP (`@neondatabase/serverless`), compatible con Workers.

## 1. Requisitos

- Node.js 20 o superior.
- Una cuenta de Cloudflare.
- Wrangler (ya está en `devDependencies`).

```powershell
npx wrangler login
```

## 2. Desarrollo local

Dos opciones:

```powershell
# Servidor Node + Vite middleware, puerto 5000
npm run dev

# Worker real en Wrangler, puerto 8787
npm run dev:cloudflare
```

`wrangler dev` lee `.dev.vars`. Ese archivo es local y no debe subirse a git.
Incluye `NODE_ENV=development` para que las cookies no se marquen `Secure` en
`http://localhost:8787`.

## 3. Secretos de producción

Configura cada valor con `wrangler secret put`. No los pongas en
`wrangler.jsonc`.

```powershell
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put SESSION_SECRET

npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET

npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GROQ_MODEL
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

npx wrangler secret put SMTP_HOST
npx wrangler secret put SMTP_PORT
npx wrangler secret put SMTP_USER
npx wrangler secret put SMTP_PASS
npx wrangler secret put SMTP_FROM
```

`JWT_SECRET` y `SESSION_SECRET` deben tener al menos 32 caracteres.

Variables públicas obligatorias para este Worker (ya configuradas):

```powershell
# URL final del Worker o dominio propio. Se usa para CORS, OAuth y enlaces.
npx wrangler secret put PUBLIC_URL
# https://vianova.netherstar44.workers.dev

npx wrangler secret put CLIENT_URL
# https://vianova.netherstar44.workers.dev

npx wrangler secret put CORS_ALLOWED_ORIGINS
# https://vianova.netherstar44.workers.dev

# Callback exacto registrado en Google Cloud Console.
npx wrangler secret put GOOGLE_REDIRECT_URI
# https://vianova.netherstar44.workers.dev/api/auth/google
```

`PUBLIC_URL`, `CLIENT_URL` y `CORS_ALLOWED_ORIGINS` deben coincidir con el
dominio real. Si usas un dominio personalizado, cambia los tres valores y
vuelve a desplegar.

Opcional para rate limiting distribuido entre isolates:

```powershell
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
```

Sin Upstash, el rate limiting usa memoria por isolate. Funciona, pero no es
global.

## 4. Compilar y desplegar

```powershell
npm run build:cloudflare
npm run deploy:cloudflare
```

`build:cloudflare` compila el cliente y limpia cualquier
`dist/public/dummy_assets.bin` que haya quedado de builds anteriores, porque
Cloudflare rechaza assets de más de 25 MiB. `deploy:cloudflare` ejecuta
`wrangler deploy`.

El nombre del Worker está en `wrangler.jsonc` (`vianova`). Al terminar, Wrangler
muestra la URL, normalmente:

```text
https://vianova.<subdominio-de-tu-cuenta>.workers.dev
```

Después de cada cambio de dominio, actualiza `PUBLIC_URL`, `CLIENT_URL`,
`CORS_ALLOWED_ORIGINS` y `GOOGLE_REDIRECT_URI`, y vuelve a desplegar. Sin eso,
la app usa el fallback de producción de `server/config.ts`, que apunta a
Vercel y rompe OAuth/CORS en Cloudflare.

## 5. Google OAuth

En Google Cloud Console agrega como URI de redirección autorizado:

```text
https://vianova.netherstar44.workers.dev/api/auth/google
```

Debe coincidir exactamente con `GOOGLE_REDIRECT_URI` o con
`${PUBLIC_URL}/api/auth/google`. El client ID/secret de Google también debe ser
el mismo par usado para ese redirect URI.

## 6. Verificación

```powershell
curl https://vianova.netherstar44.workers.dev/api/health
curl -I https://vianova.netherstar44.workers.dev/
curl -I https://vianova.netherstar44.workers.dev/api/auth/google
```

`/api/health` debe responder `{"ok":true}` y `/api/auth/google` debe redirigir
(302) a `accounts.google.com` con `redirect_uri` apuntando al Worker. Si
`/api/health` responde 500, revisa `npx wrangler tail` y confirma
`DATABASE_URL`, `JWT_SECRET` y `SESSION_SECRET` con `npx wrangler secret list`.

Comprueba también:

- El mapa carga con tiles de OpenStreetMap (no requiere token de Mapbox).
- Login y `/api/auth/me` funcionan con cookies.
- Los endpoints `/api/services` responden desde Neon.

## 7. Mapas

`MapView.tsx` y `TaxiMap.tsx` usan MapLibre GL con tiles raster públicos de
OpenStreetMap. Ya no se necesita `VITE_MAPBOX_TOKEN`.

El worker de MapLibre se importa explícitamente en
`client/src/lib/maplibre-worker.ts` para que Vite lo emita con hash y lo sirva
desde `/assets`. Sin eso, MapLibre intenta cargar
`maplibre-gl-worker.mjs` desde una ruta que Vite no copia.

Para tráfico alto o uso comercial, cambia la fuente en
`client/src/lib/map-style.ts` por tu proveedor de tiles (MapTiler, Stadia,
Protomaps o tu propio servidor) y mantén la atribución.
