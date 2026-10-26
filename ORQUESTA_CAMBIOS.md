# ORQUESTA_CAMBIOS.md

**Proyecto:** ViaNovaIA  
**Fecha de integración:** 2026-10-25  
**Directorio:** `C:\Users\Famil\Downloads\ViaNovaIA-main\ViaNovaIA-main`  
**Commit base:** `b5353d1 fix(e2e): full interactive UI validation, relative positioning, and clean logout redirect`  
**Rama local:** `main`  
**Estado Git:** 29 archivos rastreados modificados/eliminados + 26 archivos nuevos sin rastrear (incluido este documento). Sin commit, sin push, sin merge y sin rebase. `HEAD` sigue en `b5353d1`; `main` está 1 commit detrás de `origin/main` (`0ba5a1b`).

---

## 1. Resumen ejecutivo

Se integró el trabajo de dos agentes sin descartar ni revertir cambios:

| Agente | Frente | Estado |
|---|---|---|
| **Agente 1** | Seguridad, backend, catálogo restringido y planificador de viajes | Integrado |
| **Agente 2** | Frontend, performance, PWA, branding y QA | Integrado |
| **Integración** | Correcciones de contrato, build, PWA y validación conjunta | Completado |

Resultado:

- Ambos conjuntos de cambios conviven en el mismo árbol de trabajo.
- Se corrigieron los defectos de integración en lugar de revertir trabajo.
- `npm run check` termina con exit 0.
- `npm test`: **21/21 PASS**.
- `python -m unittest tests.test_tts -v`: **13/13 PASS**.
- `npm audit --omit=dev`: **0 vulnerabilidades**.
- Build de producción generado y servido en `http://127.0.0.1:5055`.
- Smoke de navegador: Home, marketplace, chatbot, MapLibre y PWA responden; sin errores de consola de la aplicación.
- Refracción del chat reforzada con `.chat-glass`: base `var(--card)` opaca, gradiente 96/90 y `blur(36px) saturate(200%)`; verificada en tema claro y oscuro sin mezcla de textos.
- Diagnóstico de deploys: Cloudflare y Vercel están en línea y el bot responde **con sesión**; ambos sirven builds anteriores al cambio de refracción. El `401` anónimo es intencional (`requireAuth`).
- El deploy externo de Vercel detectado durante la sesión **no se atribuye a esta integración** y es anterior a los últimos cambios.

---

## 2. Criterio de atribución

La atribución se hizo por dominio de responsabilidad y por el contenido de cada cambio:

- **Agente 1:** seguridad, autenticación, validaciones, catálogo, viajes, migraciones, scripts de seed, pruebas de seguridad y documentación de despliegue.
- **Agente 2:** interfaz, carga diferida, PWA, iconos de marca, tema, navbar, home, marketplace, panel de viaje y documentación de QA.
- **Integración:** archivos tocados por ambos o correcciones necesarias para que los dos trabajos funcionaran juntos.
- **Preexistente:** archivos que ya estaban en el árbol antes de esta integración y no se modificaron aquí.

No se eliminó ninguna funcionalidad aportada por ninguno de los dos agentes.

---

## 3. Cambios del Agente 1 — seguridad, backend, catálogo y viajes

### 3.1 Autenticación y validación

- Endurecimiento de `POST /api/auth/register` y `POST /api/auth/login`:
  - Rechazo explícito de arrays/objetos donde se esperan cadenas, evitando conversiones implícitas.
  - Validación de `username`, `email`, `password`, `name` y aceptación de términos.
  - Mensajes de error sin filtrar detalles internos.
- `server/security.ts`:
  - `isValidUsername` acepta usuarios con formato de correo (`@`), sin espacios, barras ni caracteres de control; mantiene longitud 3–80.
  - `sanitizeProduct` oculta `cost`, `provider_id` y `providerId` a usuarios que no son dueños ni administradores.
  - Utilidades de sanitización, cifrado de datos de pago, CSRF, cookies y validación reutilizadas por las rutas.
- `server/config.ts`:
  - Los orígenes `localhost` solo se agregan fuera de producción.
  - Los orígenes nativos de Capacitor (`capacitor://localhost`, `https://localhost`) se conservan en producción.
  - Se evita que un despliegue de producción acepte orígenes locales por defecto.

### 3.2 Catálogo restringido

- Nuevo `server/catalog.ts`:
  - Vista `catalog.catalog_items`, rol `vianova_catalog_reader`.
  - Conexión dedicada opcional mediante `CATALOG_DATABASE_URL`; si no existe, usa `DATABASE_URL`.
  - Búsqueda de servicios/productos y construcción de contexto para el chatbot.
  - Respuesta de respaldo determinista cuando Groq no está disponible.
- `server/routes/index.ts`:
  - El chat usa el catálogo restringido como fuente de recomendaciones.
  - Se evita consultar tablas completas de usuarios/productos desde el chatbot.
- `scripts/seed-neiva.mjs` y `scripts/neiva-assets.mjs`:
  - Seed idempotente de Neiva: servicios, productos, multimedia, viajes, reseñas y datos de dashboards.
  - Crea/reutiliza el rol de catálogo y aplica permisos sobre la vista.
- `SEED_NEIVA.md`: informe del seed ejecutado, con datos de catálogo, multimedia, viajes y validaciones.

### 3.3 Planificador de viajes

- Nuevo `server/trips.ts`:
  - Esquema de viajes (`trips`, `trip_stops` y mensajes de parada).
  - Generación de itinerarios a partir del catálogo.
  - Cálculo de paradas por día, presupuesto y total estimado.
  - `establishTripRoute` marca el viaje como `routed` y persiste un mensaje por parada.
  - Detección de intención de viaje y confirmación de ruta en el chat.
- Nuevo `server/routes/trips.routes.ts`:
  - `GET /api/trips/latest`
  - `POST /api/trips/generate`
  - `POST /api/trips/:id/route/establish`
  - Todas las rutas exigen autenticación y limitan escrituras.
- `server/routes/index.ts`:
  - Integración del router de viajes.
  - Detección de solicitud de viaje en el chat.
  - Generación, recuperación y formato del viaje para la conversación.
  - Confirmación de ruta y respuesta con paradas.
- `server/storage.ts`:
  - Fallback de servicios por ciudad y coordenadas cuando no hay coincidencia directa.

### 3.4 Dependencias, migración y CI

- Actualización a Zod 4 y `drizzle-zod` 0.8.3.
- Corrección de `err.errors` → `err.issues` en `server/routes/taxi.routes.ts` por el cambio de API de Zod 4.
- Eliminación de `jimp` y del flujo `scripts/generate-brand-icons.mjs`; la generación de iconos ya no depende de esa ruta.
- Nuevo `scripts/security-migration.mjs` y scripts npm:
  - `npm run db:migrate:security` (revisión)
  - `npm run db:migrate:security:apply` (aplicación)
- Nuevo workflow `.github/workflows/security.yml`:
  - Typecheck, pruebas de seguridad, auditoría de dependencias de producción, pruebas Python de TTS, build y verificación de artefactos.
- `.env.example` y `.dev.vars.example` actualizados con variables de catálogo, JWT, CORS, OAuth, Cloudinary, Groq, SMTP, Stripe y rate limiting.
- `CHECKLIST_REMEDIACION_SEGURIDAD_VIANOVA.md` y `CLOUDFLARE_DEPLOY.md` actualizados con el estado de seguridad y el despliegue en Cloudflare.

---

## 4. Cambios del Agente 2 — frontend, performance, PWA y branding

### 4.1 Performance y carga diferida

- `client/src/App.tsx`:
  - Rutas cargadas con `lazy()` y `Suspense`.
  - `ThemeFavicon` montado en la raíz para que el favicon y el color del navegador funcionen también en pantallas públicas.
- `client/src/pages/Home.tsx`:
  - Carga diferida de `MapView`, `VRViewer`, `Chatbot`, `TaxiOrderPanel` y paneles que solo aparecen tras una acción.
  - Hero y buscador rediseñados, con filtros por distancia, precio y categoría.
  - La portada deja de bloquear el primer render con MapLibre/Three.js.
- `client/src/components/CardItem.tsx`:
  - `VRViewer` cargado bajo demanda al abrir el visor 3D.
- `vite.config.ts`:
  - Se eliminó la configuración de `manualChunks` para three/model-viewer/recharts.
  - El code splitting queda a cargo de los imports dinámicos de React/Vite.
  - Esto corrige el error TDZ `Cannot access 'Dt' before initialization` y evita precargar todos los chunks pesados en la portada.

### 4.2 PWA, iconos y tema

- Nuevo `client/public/manifest.json` con iconos canónicos `brand-*`.
- Nuevos assets:
  - `brand-icon-192.png`
  - `brand-icon-512.png`
  - `brand-icon-maskable-512.png`
  - `brand-apple-touch-icon.png`
  - `favicon-default.png`, `favicon-ocean.png`, `favicon-forest.png`, `favicon-sunset.png`
- `client/index.html`:
  - `theme-color`, `manifest`, `apple-touch-icon` y favicon con `id="theme-favicon"`.
- `client/public/sw.js`:
  - Service worker `vianova-v4` con app shell, limpieza de cachés antiguas, `skipWaiting` y `clients.claim`.
  - Nunca cachea `/api/` ni respuestas privadas.
  - Cachea assets con hash y recursos estáticos.
- `client/src/components/ThemeFavicon.tsx`:
  - Cambia el favicon y `theme-color` según el tema activo (light, dark, ocean, forest, sunset).
- Reemplazo de logos:
  - `client/public/logo.jpeg`
  - `mobile/assets/logo.jpeg`
- Eliminación de assets antiguos:
  - `client/public/favicon.png`
  - `client/src/assets/logo-base.png`
  - `client/src/assets/logo.jpeg`

### 4.3 Navegación, accesibilidad y responsive

- `client/src/components/Navbar.tsx`:
  - Navegación responsive y menú móvil.
  - Etiquetas ARIA para cambio de idioma y tema.
  - Uso de tokens de tema en lugar de colores fijos.
  - Acceso a notificaciones y panel según rol.
- `client/src/pages/Login.tsx`:
  - Ajustes visuales y de jerarquía para el nuevo sistema de diseño.
- `client/src/index.css`:
  - Tokens de tema, superficies, hero, buscador y estados de foco.
  - Estilos consistentes en claro/oscuro y en las paletas ocean/forest/sunset.

### 4.4 Chatbot y panel de viaje

- `client/src/components/Chatbot.tsx`:
  - Carga diferida desde Home.
  - Carga el viaje más reciente al abrir.
  - Botón **Planear** y mensajes de ruta.
  - Render de mensajes por parada con el panel de itinerario.
  - Contenedor con `glass-panel chat-glass`, base `var(--card)` opaca y gradiente `color-mix` 96 %/90 %; el blur sube a `36px` con `saturate(200%)`.
  - Header, área de mensajes, burbujas, tarjeta GPS, footer e input usan superficies más opacas (`bg-card/85`, `bg-background/40–90`, `bg-secondary/45–70`) para que el hero y el marketplace no se mezclen con los textos.
- Nuevo `client/src/components/TripPlannerPanel.tsx`:
  - Resumen del viaje, días, paradas y presupuesto.
  - Botón **Establecer ruta y notificar paradas**.
  - Estado deshabilitado **Ruta establecida** después de completar.
  - Superficies internas elevadas a `bg-background/80` y `bg-secondary/45` para mantener legibilidad sobre el chat.
- `client/src/components/media/MediaGallery.tsx` y `client/src/pages/ProductManager.tsx`:
  - Compatibilidad con `3d_model` y `model_3d` mientras el backend normaliza el contrato.

### 4.5 QA y documentación

- `docs/CHECKLIST_QA_VIANOVA.md`:
  - Build y arranque de producción verificados.
  - Worker de MapLibre como asset hasheado.
  - E2E 9/9 PASS, incluido `/my-products` y logout.
- `INFORME_AVANCES_VIANOVA.md`:
  - Documento preexistente de la sesión anterior; no se modificó en esta integración.

---

## 5. Correcciones de integración

Estas correcciones no pertenecen a un solo agente; fueron necesarias para que ambos trabajos funcionaran juntos.

| # | Problema | Corrección | Archivos |
|---|---|---|---|
| 1 | `manualChunks` provocaba un ciclo de inicialización y el error `Cannot access 'Dt' before initialization`. | Se eliminó `manualChunks`; el splitting usa imports dinámicos nativos. Se verificó la portada y los chunks. | `vite.config.ts` |
| 2 | El backend usa `3d_model`, pero datos antiguos y parte del cliente usaban `model_3d`. | El SQL normaliza `model_3d` → `3d_model`; el cliente acepta ambas variantes para compatibilidad. | `server/routes/index.ts`, `ProductManager.tsx`, `MediaGallery.tsx` |
| 3 | Zod 4 eliminó `ZodError.errors`; las rutas de taxi fallaban al validar. | Se reemplazó por `ZodError.issues`. | `server/routes/taxi.routes.ts` |
| 4 | Los iconos PWA antiguos (`favicon.png`, `icon-*`) ya no existían, pero el manifiesto/SW podían referenciarlos. | Se canonizaron los nombres `brand-*`; el manifiesto, el SW y `index.html` usan esos nombres. | `manifest.json`, `sw.js`, `index.html`, `.gitignore` |
| 5 | `.env.example` estaba oculto por una regla duplicada `.env*`. | Se eliminó la regla duplicada y se mantuvo `!.env.example`; el archivo queda visible como untracked. | `.gitignore`, `.env.example` |
| 6 | El build dependía de memoria y de procesos residuales en Windows. | Se cerraron procesos de build/servidor residuales y se compiló con `NODE_OPTIONS=--max-old-space-size=2048`. | `package.json`, entorno de build |
| 7 | El chatbot y el panel de viaje se agregaron en paralelo con contratos distintos. | El backend normaliza el tipo; el cliente tolera ambas variantes y el panel consume el DTO final. | `Chatbot.tsx`, `TripPlannerPanel.tsx`, `trips.ts` |
| 8 | El deploy de Vercel ocurrió desde un árbol sin commit y antes de los últimos cambios. | No se revirtió ni se reclamó; se documenta como evento externo y se deja el build local como referencia válida. | `vercel-deploy.log`, `ORQUESTA_CAMBIOS.md` |
| 9 | El chat flotante dejaba traslucir el hero y el marketplace; los textos se mezclaban con el fondo. | Se agregó `.chat-glass` con superficie opaca y mayor refracción, y se elevaron las capas internas del chat y del planificador. No se modificó `.glass-panel` global. | `client/src/index.css`, `Chatbot.tsx`, `TripPlannerPanel.tsx` |

---

## 6. Validación ejecutada

La validación final se ejecutó después del último cambio funcional de estilos (aprox. 19:58) y del build de producción con esos estilos (20:00).

| Control | Comando | Resultado |
|---|---|---|
| TypeScript | `npm run check` | **Exit 0** |
| Pruebas Node | `npm test` | **21/21 PASS**, 0 fallos |
| Pruebas Python TTS | `python -m unittest tests.test_tts -v` | **13/13 PASS** |
| Auditoría de producción | `npm audit --omit=dev` | **0 vulnerabilidades** |
| Build de producción | `npm run build` con `NODE_OPTIONS=--max-old-space-size=2048` | **Exit 0** |
| Servidor local | `NODE_ENV=production PORT=5055 CORS_ALLOWED_ORIGINS=http://127.0.0.1:5055,http://localhost:5055 node dist/index.cjs` | Activo en `http://127.0.0.1:5055` (PID 139168) |
| Refracción del chat | Playwright autenticado, tema claro y oscuro | Superficie opaca, sin bleed; `blur(36px) saturate(200%)` |

> Nota: la allowlist de producción no incluye `localhost`; el smoke local usó `CORS_ALLOWED_ORIGINS` para permitir el login. En Cloudflare y Vercel no se aplicó ningún override.

### 6.1 Artefactos del build

`dist/public/index.html` referencia:

- `assets/index-BZr2hc4v.js` — 365.857 bytes.
- `assets/index-D-UyG8j1.css` — 197.944 bytes.

Chunks principales verificados:

- `Home-tC2RMZEW.js` — 47.028 bytes.
- `Chatbot-BeTzbdJW.js` — 35.591 bytes.
- `maplibre-gl-worker-BrB25tGK.mjs` — 518.806 bytes.
- `dist/index.cjs` — 2.364.958 bytes.

Build anterior (sin refracción, solo como referencia): `index-1jPgjK9f.js`, `index-d9KkkIcV.css`, `Home-CNo6_b_g.js`, `Chatbot-D23lSyz4.js`.

### 6.2 Smoke HTTP

Responden `200`:

- `/api/health` → `{"ok":true}`
- `/`
- `/manifest.json`
- `/sw.js`
- `/brand-icon-192.png`
- `/brand-icon-512.png`
- `/brand-icon-maskable-512.png`
- `/brand-apple-touch-icon.png`
- `/assets/index-BZr2hc4v.js`
- `/assets/index-D-UyG8j1.css`

Responden `401` sin sesión:

- `GET /api/trips/latest`
- `POST /api/trips/generate`
- `POST /api/trips/:id/route/establish`

### 6.3 Smoke de navegador

- Home:
  - Renderiza `h1` “Descubre el mundo con VIANova”, navbar y hero.
  - Sin errores de consola de la aplicación.
  - Favicon de tema y service worker activos.
- `/explore`:
  - Renderiza el marketplace con productos y multimedia.
  - `GET /api/products?limit=50` responde `200`.
  - Las imágenes de producto cargan.
- Chatbot (requiere sesión):
  - Abre bajo demanda.
  - Muestra campo de mensaje y botón **Planear**.
  - El worker de MapLibre se carga correctamente.
  - Con login local, `POST /api/chat` responde `200` y devuelve hoteles/precios del catálogo.
  - Refracción comprobada en tema oscuro y claro: panel `rgb(22,22,26)` / `rgb(255,255,255)`, gradiente 96 %→90 %, `backdrop-filter: blur(36px) saturate(2)`; sin bleed del hero ni del marketplace.
  - Se probó una variante translúcida (solo gradiente 90–96 %) y se descartó: el texto del hero se transparentaba como ruido. La base opaca + blur es la versión final.
  - Evidencia local (ignorada por Git): `qa-chat-dark.png`, `qa-chat-light.png`, `qa-chat-dark-panel-2.png`, `qa-chat-light-panel.png`.
- Única falla de red observada:
  - Una imagen externa de Unsplash responde `404` / `net::ERR_BLOCKED_BY_ORB`.
  - No es un error de la aplicación; se documenta como dependencia externa.

### 6.4 Evidencia del seed

`SEED_NEIVA.md` reporta, como entregable del Agente 1:

- 12 hoteles, 12 restaurantes y 12 servicios de recreación.
- 36 productos y 72 ítems visibles en el catálogo restringido.
- 48 imágenes y 12 modelos GLB en Cloudinary.
- Viaje de prueba de 3 días y 2 viajeros con 16 paradas.
- Ruta establecida con 16 mensajes persistidos, uno por parada.
- Endpoints de login, roles, dashboards, productos, chat y viajes verificados.

> Esa evidencia fue producida por el flujo de seed y no se re-ejecutó durante esta integración. Se conserva como validación del agente, no como una nueva corrida de este documento.

### 6.5 Diagnóstico de despliegues (Cloudflare / Vercel)

Comprobaciones ejecutadas el 2026-10-25 alrededor de las 20:05 (America/Bogota), sin push ni redeploy:

| Host | Estado | Build servido | Evidencia |
|---|---|---|---|
| Vercel | `200` | `index-BswTxf35.js`, `index-d9KkkIcV.css`, `Home-BYB5S2Qt.js`, `Chatbot-l1gqMatr.js` | Deployment `dpl_GiDxhPBhV3CYEMye68QciWpVqqio`, creado 19:35:38, target production, estado Ready |
| Cloudflare | `200` | `index-C-2TcOnx.js`, `index-DJS9qbZI.css`, `Home-DQVwerbM.js`, `Chatbot-B_0lJ_ot.js` | Version `357ec19e-a79f-4f5e-bf45-20ea08d7439e`, creada `2026-10-26T00:16:58Z` (19:16 local), 100 % del tráfico |
| Local final | `200` | `index-BZr2hc4v.js`, `index-D-UyG8j1.css`, `Home-tC2RMZEW.js`, `Chatbot-BeTzbdJW.js` | Build de producción de las 20:00, servido por PID 139168 |

Hallazgos:

- **No están caídos.** `/api/health` responde `{"ok":true}` y `/` responde `200` en ambos hosts.
- **El bot sí funciona con sesión.** Login demo y `POST /api/chat` responden `200` en Vercel y Cloudflare; la respuesta incluye hoteles y precios del catálogo.
- **El `401` es intencional.** `POST /api/chat` usa `requireAuth`: sin cookie de sesión devuelve `401` (Vercel con body vacío; Cloudflare con `{"message":"No autenticado"}`). Un visitante anónimo percibe que el bot “no sirve”, pero es la política de acceso actual.
- **Los deploys están desactualizados.** Los bundles desplegados contienen **Planear** y **Establecer ruta**, pero no la clase `chat-glass`; por tanto son anteriores al cambio de refracción. Cloudflare además sirve un entry de 932 KB frente a 366 KB del build local, señal de un empaquetado/build anterior.
- **El routing no es el problema.** `vercel.json` reescribe `/api/*` a `api/index.ts` y `wrangler.jsonc` usa `run_worker_first` para `/api`; ambos health checks lo confirman.
- **No se publicó nada en esta sesión.** No hubo commit, push, `vercel deploy` ni `wrangler deploy`. Los deployments observados son previos.

---

## 7. Inventario de archivos

### 7.1 Archivos rastreados modificados o eliminados (29)

| Archivo | Estado | Atribución |
|---|---|---|
| `.dev.vars.example` | M | Agente 1 |
| `.gitignore` | M | Integración / Agente 2 |
| `CHECKLIST_REMEDIACION_SEGURIDAD_VIANOVA.md` | M | Agente 1 |
| `CLOUDFLARE_DEPLOY.md` | M | Agente 1 |
| `client/index.html` | M | Agente 2 |
| `client/public/favicon.png` | D | Agente 2 |
| `client/public/logo.jpeg` | M | Agente 2 |
| `client/public/sw.js` | M | Agente 2 |
| `client/src/App.tsx` | M | Agente 2 |
| `client/src/assets/logo-base.png` | D | Agente 2 |
| `client/src/assets/logo.jpeg` | D | Agente 2 |
| `client/src/components/CardItem.tsx` | M | Agente 2 |
| `client/src/components/Chatbot.tsx` | M | Agente 2 / Integración |
| `client/src/components/Navbar.tsx` | M | Agente 2 |
| `client/src/components/media/MediaGallery.tsx` | M | Integración |
| `client/src/index.css` | M | Agente 2 |
| `client/src/pages/Home.tsx` | M | Agente 2 |
| `client/src/pages/Login.tsx` | M | Agente 2 |
| `client/src/pages/ProductManager.tsx` | M | Integración |
| `docs/CHECKLIST_QA_VIANOVA.md` | M | Agente 2 |
| `mobile/assets/logo.jpeg` | M | Agente 2 |
| `package-lock.json` | M | Agente 1 |
| `package.json` | M | Agente 1 |
| `server/config.ts` | M | Agente 1 |
| `server/routes/index.ts` | M | Agente 1 / Integración |
| `server/routes/taxi.routes.ts` | M | Agente 1 |
| `server/security.ts` | M | Agente 1 |
| `server/storage.ts` | M | Agente 1 |
| `vite.config.ts` | M | Integración |

### 7.2 Archivos nuevos sin rastrear (26)

| Archivo | Atribución |
|---|---|
| `.env.example` | Agente 1 |
| `ORQUESTA_CAMBIOS.md` | Integración |
| `.github/workflows/security.yml` | Agente 1 |
| `INFORME_AVANCES_VIANOVA.md` | Preexistente |
| `SEED_NEIVA.md` | Agente 1 |
| `client/public/brand-apple-touch-icon.png` | Agente 2 |
| `client/public/brand-icon-192.png` | Agente 2 |
| `client/public/brand-icon-512.png` | Agente 2 |
| `client/public/brand-icon-maskable-512.png` | Agente 2 |
| `client/public/manifest.json` | Agente 2 |
| `client/src/assets/favicons/favicon-default.png` | Agente 2 |
| `client/src/assets/favicons/favicon-forest.png` | Agente 2 |
| `client/src/assets/favicons/favicon-ocean.png` | Agente 2 |
| `client/src/assets/favicons/favicon-sunset.png` | Agente 2 |
| `client/src/components/ThemeFavicon.tsx` | Agente 2 |
| `client/src/components/TripPlannerPanel.tsx` | Agente 2 |
| `docs/seed-neiva-3d.png` | Agente 1 |
| `docs/seed-neiva-chat.png` | Agente 1 |
| `scripts/neiva-assets.mjs` | Agente 1 |
| `scripts/security-migration.mjs` | Agente 1 |
| `scripts/seed-neiva.mjs` | Agente 1 |
| `server/catalog.ts` | Agente 1 |
| `server/routes/trips.routes.ts` | Agente 1 |
| `server/trips.ts` | Agente 1 |
| `tests/security.test.ts` | Agente 1 |
| `tests/test_tts.py` | Agente 1 |

### 7.3 Archivos ignorados o temporales

- `dist/` (build local).
- `.env`, `.dev.vars`, `.env.local` (secretos, no leídos ni impresos).
- `qa-*.png`, `vercel-*.log`, `scripts/tmp-*`, `scripts/diag-*`.
- `docs/seed-neiva-*.png` fueron añadidos como excepciones explícitas de `.gitignore` para conservar la evidencia visual del seed.

---

## 8. Riesgos y pendientes

### 8.1 Alta prioridad

1. **Deploys desactualizados y bot solo para sesión**
   - Vercel sirve el deployment `dpl_GiDxhPBhV3CYEMye68QciWpVqqio` (creado 19:35:38) con `index-BswTxf35.js`; Cloudflare sirve la version `357ec19e` (creada 19:16) con `index-C-2TcOnx.js`.
   - El build local final es de las 20:00 (`index-BZr2hc4v.js`) e incluye `.chat-glass`; ninguno de los dos deploys lo tiene.
   - Ambos hosts están en línea y el chat funciona con sesión. El `401` anónimo es la política `requireAuth`, no una caída.
   - **Acción:** autorizar commit/push y redeploy; después validar el chat con una sesión real y decidir si se habilita acceso anónimo controlado.

2. **Rama local detrás de `origin/main`**
   - `main` local está 1 commit por detrás de `origin/main` (`0ba5a1b Add files via upload`).
   - Hay 29 archivos modificados y 25 nuevos sin commit.
   - **Acción:** revisar el commit remoto antes de pull/rebase; no hacer merge ni push forzado sin confirmación.

3. **Migración de seguridad sin aplicar**
   - `scripts/security-migration.mjs` existe y tiene scripts npm, pero no se ejecutó en esta integración.
   - **Acción:** ejecutar `npm run db:migrate:security`, revisar el SQL y aplicar con `npm run db:migrate:security:apply` en una ventana controlada.

4. **Catálogo con rol principal como fallback**
   - Si `CATALOG_DATABASE_URL` no está definida, el catálogo usa `DATABASE_URL` y pierde el aislamiento del rol de solo lectura.
   - **Acción:** provisionar `vianova_catalog_reader`, establecer `CATALOG_DATABASE_URL` y verificar que solo pueda leer `catalog.catalog_items`.

5. **Credenciales demo en `SEED_NEIVA.md`**
   - El documento incluye usuario y contraseña de demostración.
   - **Acción:** no commitear el archivo con esa contraseña en un repositorio público; rotarla o eliminarla antes de publicar.

### 8.2 Prioridad media

6. **OAuth local con puerto distinto**
   - La configuración local observada usa `CLIENT_URL=http://localhost:8787`, mientras el servidor de producción local corre en `5055`.
   - El callback de Google debe coincidir exactamente con `GOOGLE_REDIRECT_URI` / `PUBLIC_URL`.
   - **Acción:** alinear `CLIENT_URL`, `PUBLIC_URL`, `CORS_ALLOWED_ORIGINS` y `GOOGLE_REDIRECT_URI` con el origen real antes de probar login social.

7. **Sin E2E automatizado del planificador**
   - El flujo de viajes se validó con seed y smoke manual, pero no hay una prueba E2E versionada que cubra generar viaje, abrir panel y establecer ruta.
   - **Acción:** agregar un caso autenticado a la suite E2E/CI.

8. **Imagen externa de Unsplash**
   - Una imagen de producto responde `404` / `ERR_BLOCKED_BY_ORB`.
   - **Acción:** reemplazar la URL por un asset propio o una URL verificada.

9. **Build sensible a memoria en Windows**
   - El build requiere `NODE_OPTIONS=--max-old-space-size=2048` en este equipo.
   - **Acción:** mantener el límite en CI (el workflow usa 4096) y cerrar procesos de build/servidor residuales antes de compilar.

10. **Service worker y caché**
    - El SW usa `vianova-v4` y limpia cachés anteriores, pero los clientes con una versión vieja pueden seguir sirviendo el shell hasta que el nuevo SW se active.
    - **Acción:** tras el redeploy, verificar `skipWaiting`/`clients.claim` y recargar en una ventana limpia.

### 8.3 Prioridad baja

11. **`.env.example` sin rastrear**
    - Es correcto que exista y esté visible, pero todavía no está agregado al índice.
    - **Acción:** incluirlo en el commit junto con la documentación de variables.

12. **Documento preexistente**
    - `INFORME_AVANCES_VIANOVA.md` contiene el estado de una sesión anterior y no se actualizó aquí.
    - **Acción:** archivarlo o enlazarlo desde la documentación final si se decide conservarlo.

### 8.4 Decisión pendiente

13. **Acceso anónimo al chatbot**
    - `POST /api/chat` exige autenticación. Un visitante sin sesión recibe `401` y el panel no produce respuesta.
    - Si el bot debe atender visitantes, hace falta una sesión anónima con rate limit por IP y un alcance de catálogo limitado; si no, conviene mostrar un CTA de inicio de sesión antes de abrir el chat.
    - **Acción:** decidir el comportamiento de producto antes del redeploy y documentarlo en la UI.

---

## 9. Estado final

- **Trabajo del Agente 1:** presente (seguridad, catálogo, viajes, migración, pruebas, docs).
- **Trabajo del Agente 2:** presente (lazy loading, PWA, branding, home, navbar, chatbot, panel de viaje, QA).
- **Correcciones de integración:** aplicadas y verificadas.
- **Refracción del chat:** aplicada con `.chat-glass` y capas internas más opacas; validada en claro/oscuro sin mezcla de textos.
- **Archivos eliminados:** solo assets obsoletos de logo/favicon; no se eliminaron archivos funcionales de ninguno de los agentes.
- **Commit/push:** no ejecutados. `HEAD` sigue en `b5353d1` y `main` está 1 commit detrás de `origin/main`.
- **Servidor local:** activo en `http://127.0.0.1:5055` con el build final (PID 139168).
- **Deploys externos:** Cloudflare y Vercel están en línea, pero sirven builds anteriores al cambio de refracción; el bot exige sesión.

### Próximos pasos recomendados

1. Revisar `git diff` y `git status` con ambos agentes.
2. Resolver la relación con `origin/main` (`0ba5a1b`) antes de commitear.
3. Autorizar commit y push; después redeployar Cloudflare y Vercel y revalidar el chat **con sesión**.
4. Ejecutar la migración de seguridad y configurar `CATALOG_DATABASE_URL`.
5. Corregir la configuración OAuth/CORS para el host real.
6. Rotar o retirar la contraseña demo antes de publicar `SEED_NEIVA.md`.
7. Decidir el comportamiento del chat para visitantes anónimos.
8. Commit en dos bloques lógicos (backend/seguridad y frontend/performance) o en un único commit de integración, según preferencia del equipo.
9. Verificar PWA, OAuth y el flujo de viajes en los hosts redeployados.
