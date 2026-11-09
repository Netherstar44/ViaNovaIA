---
name: ViaNova Codebase
description: Usar cuando se trabaje en cualquier parte del repositorio ViaNovaIA, para orientarse, localizar una funcionalidad, elegir el comando correcto o recordar las convenciones y trampas del proyecto.
---

# ViaNova Codebase

## Principio

ViaNovaIA es un **monolito modular portátil**: la misma lógica de Express corre en Node, en Vercel y en Cloudflare Workers. La SPA es React 19 + Vite 7. No introduzcas un segundo patrón de arquitectura para una feature nueva; encájala en el existente.

## Stack

| Capa | Tecnología | Carpeta |
| --- | --- | --- |
| SPA | React 19, Vite 7, Tailwind 4, wouter | `client/src` |
| API | Express 4, Node 22, adaptador Workers | `server/` |
| Datos | PostgreSQL (Neon) + Drizzle ORM | `shared/schema.ts` |
| 3D / 360 | three.js, react-three-fiber, model-viewer | `client/src/components/media` |
| SEO | HTML prerenderizado, JSON-LD, sitemap, llms.txt | `vite-plugin-seo-pages.ts`, `shared/seo-content.ts` |
| Android | Capacitor 8 | `android/` |
| Pruebas | `node:test` + `tsx` | `tests/` |

## Comandos

```bash
npm ci --include=dev     # instala también devDependencies (Vercel lo necesita)
npm run check            # TypeScript (no incluye tests ni server/worker.ts)
npm test                 # suite node:test
npm run test:security    # solo tests/security.test.ts
npm run build            # build de producción + SEO
npm run dev:client       # Vite en :5000, sin API
npm run dev              # API + Vite; requiere .env y base de datos
```

Antes de dar algo por terminado: `npm run check && npm test && npm run build`.

## Mapa rápido

| Necesitas… | Archivo |
| --- | --- |
| Rutas de la SPA | `client/src/App.tsx` |
| Páginas | `client/src/pages/` |
| Componentes y UI | `client/src/components/` |
| Hooks y utilidades | `client/src/hooks/`, `client/src/lib/` |
| Temas y tokens | `client/src/index.css` |
| Superficies, dock, orbe, logo | `client/src/styles/glass.css` |
| App Express y middlewares | `server/app.ts` |
| Registro de rutas | `server/routes/index.ts` |
| Rutas por dominio | `server/routes/*.routes.ts` |
| Seguridad y helpers | `server/security.ts`, `server/http-security.ts` |
| Rate limits | `server/rate-limits.ts`, `server/rate-limit-store.ts` |
| Pagos | `server/payments.ts` |
| Uploads | `server/upload-validation.ts` |
| Catálogo del chatbot | `server/catalog.ts` |
| Planificador de viajes | `server/trips.ts` |
| Esquema Drizzle | `shared/schema.ts` |
| Contenido SEO | `shared/seo-content.ts` |
| Generación SEO | `vite-plugin-seo-pages.ts` |
| Worker de Cloudflare | `server/worker.ts` |
| Función de Vercel | `api/index.ts` |
| Pruebas | `tests/*.test.ts` |

## Alias de importación

- `@/*` → `client/src/*`
- `@shared/*` → `shared/*`
- `@assets/*` → `attached_assets/*`

## Convenciones que no se negocian

- **TypeScript strict** (`tsconfig.json`). `npm run check` excluye `**/*.test.ts` y `server/worker.ts`; no asumas que valida esas piezas.
- **Identidad desde la sesión**, nunca desde el body: `userId`, `role` y `providerId` salen del token y de la base de datos.
- **Drizzle parametrizado**. Prohibido concatenar SQL con entrada del usuario.
- **Validación en servidor** con `zod.safeParse` en el borde. El cliente es UX, no seguridad.
- **Rutas privadas** llevan guard de auth, rol y propiedad; además deben tener `X-Robots-Tag: noindex` en `vercel.json` si no son públicas.
- **UI con tokens semánticos** (`bg-background`, `text-foreground`, `bg-primary`, `text-primary-ink`). No hardcodees hex en componentes.
- **Contenido real**: si falta un dato, la interfaz lo dice. No inventes panoramas, reseñas, precios ni proveedores.

## Trampas conocidas

1. **Vercel y `NODE_ENV=production`**: `npm ci` omite devDependencies y el build muere con `tsx: not found`. El `installCommand` debe seguir siendo `npm ci --include=dev`.
2. **`backdrop-filter`**: se eliminó por rendimiento móvil. El “glass” es CSS puro con gradientes y superficies sólidas. No lo reintroduzcas.
3. **360 falso**: si no hay panorama equirectangular 2:1, la UI debe decirlo. No dibujes una esfera de relleno.
4. **Logos con padding transparente**: usa los recortes `brand-mark-*.png`.
5. **Assets pesados**: `promo-video/`, `*.apk`, `*.mp4`, `_capture*/`, `motion/` y `out/` quedan fuera de git.
6. **`exceljs`**: sus 8 avisos moderados están aceptados y documentados; no fuerces un downgrade que rompa la exportación XLSX.
7. **Chunks manuales de three/model-viewer/recharts**: provocaron un ciclo de inicialización (TDZ). Deja el code splitting a los imports dinámicos.

## Definición de “terminado”

- [ ] `npm run check` sin errores.
- [ ] `npm test` en verde.
- [ ] `npm run build` genera `dist/` y `llms-full.txt`.
- [ ] Probado en tema claro y en `dark`, `sunset`, `ocean`, `forest`.
- [ ] Probado a 360 px, 768 px y 1440 px.
- [ ] Sin `console.log` de depuración ni secretos.
- [ ] `README`/`AGENTS` actualizados si cambió el comportamiento.

## Si algo no está claro

Pregunta antes de asumir. Propón un plan corto antes de tocar más de tres archivos. Explica el porqué del cambio, no solo el qué.
