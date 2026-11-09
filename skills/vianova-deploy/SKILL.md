---
name: ViaNova Deploy
description: Usar cuando se prepare o revise un despliegue en Vercel, Cloudflare Workers, Node o Android; también para tocar vercel.json, wrangler.jsonc, variables de entorno o el build de producción.
---

# ViaNova Deploy

## Destinos

| Destino | Comando / archivo | Notas |
| --- | --- | --- |
| Vercel (principal) | `vercel.json`, `api/index.ts` | Lo administra un tercero. **No ejecutes `vercel` ni cambies la cuenta.** |
| Cloudflare Workers | `wrangler.jsonc`, `server/worker.ts` | `npm run deploy:cloudflare` |
| Node | `npm run build` + `npm start` | `dist/index.cjs`; requiere `.env` |
| Android | Capacitor 8, `android/` | Build en Android Studio; no commitear APK |

## Vercel

Invariantes que no se deben “optimizar”:

- `installCommand`: `npm ci --include=dev`. Sin devDependencies el build muere con `tsx: not found`.
- `buildCommand`: `npm run build`.
- `outputDirectory`: `dist/public`.
- Rewrites `/api/*` → `/api/index` **sin extensión** (`cleanUrls: true`). `tests/deploy-config.test.ts` lo verifica.
- `functions["api/index.ts"].includeFiles` debe incluir los pesos de `@vladmandic/face-api`.
- Cabeceras de seguridad: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS`.
- Rutas privadas con `X-Robots-Tag: noindex, nofollow`.

## Cloudflare Workers

- `main`: `server/worker.ts`.
- `assets.directory`: `./dist/public`; `run_worker_first`: `/api`, `/api/*`.
- `compatibility_flags`: `nodejs_compat`; Node 22.
- La verificación de identidad facial **no está soportada en Workers** (requiere Node 22 y pesos locales). Si la feature la necesita, despliega en Node/Vercel.
- Configura secretos con `wrangler secret put`; nunca en `wrangler.jsonc`.
- `npm run build:cloudflare` genera assets y `npm run deploy:cloudflare` publica.

## Node

```bash
npm ci --include=dev
npm run build
npm start
```

- `npm run build` ejecuta `prebuild` (assets faciales) y `script/build.ts`.
- Salida: `dist/` + `dist/public/` + `llms-full.txt`.
- `.env` es obligatorio; usa `.env.example` como plantilla.

## Variables de entorno

- Nunca subas `.env` ni captures con credenciales.
- `VITE_*` es público: solo URLs y tokens de mapas; nunca secretos.
- Claves críticas: `DATABASE_URL`, `JWT_SECRET`, `SESSION_SECRET`, `PAYMENT_ENCRYPTION_KEY`, `CORS_ALLOWED_ORIGINS`, `GROQ_API_KEY`, `STRIPE_*`, `WOMPI_*`, `CLOUDINARY_*`.
- `CATALOG_DATABASE_URL` debe usar un rol de solo lectura sobre `catalog.catalog_items`.
- `BIOMETRIC_ENCRYPTION_KEY` es independiente de pagos; 64 caracteres hex.

## Checklist previo

- [ ] `npm run check` sin errores.
- [ ] `npm test` en verde.
- [ ] `npm run build` genera `dist/` y `llms-full.txt`.
- [ ] `npm audit --omit=dev --audit-level=high` pasa.
- [ ] Sin secretos en el diff ni en logs.
- [ ] Cabeceras y `noindex` intactos.
- [ ] Smoke test de `/`, `/explore`, `/api/health` (si existe) y una landing SEO.
- [ ] Rollback identificado (redeploy anterior en Vercel / `wrangler rollback`).

## Errores frecuentes

| Síntoma | Causa |
| --- | --- |
| Build de Vercel: `tsx: not found` | Se quitó `--include=dev` del installCommand. |
| `/api/*` cae en la SPA | Rewrite con extensión o `cleanUrls` desactivado. |
| Función sin modelos faciales | Falta `includeFiles` de face-api. |
| Worker sin assets | `assets.directory` incorrecto o build no ejecutado. |
| Chat sin IA en producción | Falta `GROQ_API_KEY`; el fallback local debe seguir funcionando. |
| Datos de producción modificados | Se ejecutó un script/seed contra la URL real sin confirmación. |
