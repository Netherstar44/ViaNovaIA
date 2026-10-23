# Registro de errores y correcciones — ViaNovaIA

**Fecha de QA:** 20 de octubre de 2026 (hora local) / 21 de octubre de 2026 (UTC)
**Verificación final:** 22 de octubre de 2026
**Aplicación:** `http://localhost:5000/`
**Navegador:** Chromium headless vía Playwright (`playwright-core` y Playwright MCP)
**Alcance:** sesión anónima y sesión autenticada con usuario de QA
**Objetivo:** detectar errores reales en la aplicación, corregirlos y mantener un despliegue compatible con Cloudflare Workers.

---

## 1. Resumen

| # | Error detectado | Causa raíz | Corrección aplicada | Estado |
|---|-----------------|------------|---------------------|--------|
| 1 | `POST /api/auth/login` devolvía `500` | Faltaban columnas/tablas esperadas por el flujo de autenticación (`users.two_factor_attempts`, `users.auth_provider`, `revoked_tokens`) | Inicialización perezosa e idempotente con `ensureUserSchema()` | Corregido |
| 2 | La respuesta de login exponía campos internos (`verificationToken`, `failedLoginAttempts`, `lockUntil`, `preferences`, `deletedAt`) | Se devolvía el registro completo del usuario | Sanitización centralizada con `sanitizeUser()` | Corregido |
| 3 | `GET /api/auth/me` devolvía `401` para visitantes anónimos y generaba errores en consola | El endpoint exigía autenticación obligatoria | `optionalAuth`: responde `200 { "user": null }` para sesiones anónimas | Corregido |
| 4 | Endpoints sociales devolvían `500` | Faltaban tablas `social_*` en la base de datos | Creación perezosa e idempotente de tablas e índices | Corregido |
| 5 | `GET /api/social/messages/conversations` devolvía `500` | Columna `created_at` ambigua en la consulta | Calificación explícita con `t.*` | Corregido |
| 6 | `GET /api/rides/nearby` devolvía `500` | Faltaban tablas de taxi y había coordenadas inválidas en datos heredados | Esquema perezoso de taxi + validación en servidor y filtrado en cliente | Corregido |
| 7 | `GET /api/notifications` fallaba y no verificaba propiedad de la notificación | Esquema no inicializado y endpoints sin control de autorización | Esquema perezoso + `requireAuth` + verificación de propiedad | Corregido |
| 8 | Retiros de taxi devolvían error | Faltaba `withdrawals.idempotency_key` y su índice único | Migración perezosa + índice único de idempotencia | Corregido |
| 9 | `POST /api/rides`, `POST /api/taxi/withdraw`, `GET /api/taxi/earnings/:username` confiaban en el username enviado por el cliente | Falta de autenticación y de derivación de identidad desde la sesión | `requireAuth` y username derivado de `req.user` | Corregido |
| 10 | Error `ERR_ERL_STORE_REUSE` en rate limiting | Se reutilizaba la misma instancia de store entre limitadores | `common` convertido en fábrica (`...common()`) | Corregido |
| 11 | Errores de TypeScript y conflictos de declaraciones en `server/routes/index.ts` | Imports/exports duplicados o faltantes, `authProvider` ausente en el schema de inserción | Restauración de imports, re-export de `requireAuth`, helpers de JWT/cookies y `authProvider` | Corregido |
| 12 | Mapas no cargaban: `401 Invalid Token` | Mapbox requería un token válido | Migración a MapLibre + tiles CARTO/OpenStreetMap sin token | Corregido |
| 13 | Worker de MapLibre devolvía `504 Outdated Optimize Dep` | Optimización de dependencias de Vite incompatible con el worker | `optimizeDeps.exclude: ["maplibre-gl"]` y `worker.format: "es"` | Corregido |
| 14 | Estilos de Leaflet no cargaban o violaban CSP | CSS de Leaflet cargado desde CDN | Import local de `leaflet/dist/leaflet.css` | Corregido |
| 15 | GoogleAuth de Capacitor se inicializaba en web | Plugin nativo ejecutado fuera de plataforma nativa | Inicialización solo en nativo; OAuth web same-origin | Corregido |
| 16 | La API apuntaba a un host incorrecto en web/Cloudflare | Base URL dependiente del entorno de desarrollo | `/api` same-origin en web; `VITE_NATIVE_API_BASE` solo para nativo | Corregido |
| 17 | El overlay de errores de Vite aparecía en producción | Overlay habilitado sin distinguir entorno | Overlay restringido a desarrollo | Corregido |
| 18 | La ruta `/nuke` era accesible y provocaba un error de parseo JSON | Página destructiva expuesta sin guardas | Ruta eliminada de `client/src/App.tsx`; ahora responde `404` | Corregido |
| 19 | Coordenadas inválidas (`lat=2000`, `lng=1500`) y filas con coordenadas nulas rompían mapas/listados | Datos heredados sin validación | Validación en servidor y filtrado en cliente | Corregido |
| 20 | El esquema dependía de migraciones manuales, poco prácticas en Cloudflare | Creación de tablas fuera del arranque de la app | Creación perezosa e idempotente de tablas e índices | Corregido |
| 21 | `429 Too Many Requests` en `/api/comments` y `/api/services` tras varias cargas | Cada tarjeta de la home pedía comentarios por separado (decenas de solicitudes) y agotaba el límite de lectura pública | Endpoint batch `/api/comments/ratings` y una sola consulta para las tarjetas visibles; `CardItem` ya no hace fetch individual | Corregido |
| 22 | `npm run dev` fallaba al resolver dependencias de autenticación nativa | Faltaban `@capacitor/preferences` y `@capgo/capacitor-social-login` | Instalación de versiones compatibles con Capacitor 8 | Corregido |
| 23 | `DELETE /api/services/:id` fallaba silenciosamente en base de datos | `storage.deleteService` exigía 2 argumentos `(id, providerUsername)` y la ruta enviaba solo `(id)`, provocando `WHERE provider_username = undefined` | Se actualizó la firma y la consulta SQL en `server/storage.ts` para admitir `providerUsername` opcional | Corregido |
| 24 | `auth_token` ausente en `localStorage` en sesión web | El login y registro solo seteaban cookie sin guardar el JWT en `localStorage`, impidiendo a clientes API headless o clientes móviles sincronizados enviar la cabecera `Authorization` | Persistencia consistente de `auth_token` en `client/src/lib/auth.ts` y lectura en `client/src/lib/secureStorage.ts` | Corregido |
| 25 | Peticiones HTTP en `ProductManager`, `MyProducts`, `SocialFeed` y `ProductStore` devolvían `401` intermitente | Invocaciones a `fetch` nativo no adjuntaban `Authorization: Bearer <token>` ni `credentials: "include"` | Se añadieron cabeceras de autorización y credenciales en todas las operaciones CRUD | Corregido |
| 26 | Error de interacción UI: `<textarea>` intercepta eventos de clic en modal de creación | El selector de Playwright resolvía múltiples botones con texto coincidente en capas inferiores | Asignación de IDs únicos (`#product-submit-btn`, `#create-post-fab`, `#submit-post-btn`, `#chatbot-send-btn`) | Corregido |
| 27 | Botón de confirmación de eliminación desalineado en `MyProducts.tsx` | El diálogo flotante de confirmación usaba `absolute` dentro de una tarjeta que no tenía `relative` | Corrección del contexto de apilamiento y posicionamiento inline del botón de confirmación | En corrección / verificación |
| 28 | Violación de clave foránea al purgar usuarios de prueba (`conversations_user_id_users_id_fk`) | Las tablas `chat_messages` y `conversations` no tenían borrado en cascada configurado | Purgado en cascada explícito de mensajes y conversaciones previo a la eliminación del usuario | Corregido |

---

## 2. Detalle de correcciones principales

### 2.1 Autenticación y esquema

- Se añadió `ensureUserSchema()` para garantizar columnas como `users.two_factor_attempts` y `users.auth_provider`, además de la tabla `revoked_tokens`.
- Se incorporaron tablas e índices para `social_*`, taxi, analítica, `media_assets` y `revoked_tokens` mediante creación perezosa.
- El login ya no devuelve el registro completo del usuario. La sanitización se centralizó en `server/security.ts`.
- `/api/auth/me` pasó a ser opcional-autenticado y devuelve `200` con `user: null` cuando no hay sesión.

**Archivos:** `server/analytics.ts`, `server/security.ts`, `server/routes/index.ts`, `shared/schema.ts`

### 2.2 Autorización de operaciones sensibles

- `POST /api/rides`, `POST /api/taxi/withdraw`, `GET /api/taxi/earnings/:username` y los endpoints de notificaciones ahora requieren sesión válida.
- El servidor deriva el username desde `req.user`; ya no confía en el username del cuerpo o de la URL.
- Las notificaciones verifican que pertenezcan al usuario autenticado.

**Archivos:** `server/routes/index.ts`, `server/routes/taxi.routes.ts`, `server/taxi.storage.ts`, `server/security.ts`

### 2.3 Mapas y frontend

- Mapbox fue reemplazado por MapLibre con tiles CARTO/OpenStreetMap, sin tokens.
- Se corrigió el worker de MapLibre (`504 Outdated Optimize Dep`).
- Leaflet CSS se importa desde el paquete local, evitando CDN y problemas de CSP.
- La ruta `/nuke` fue retirada del router.
- El overlay de errores de Vite solo se activa en desarrollo.

**Archivos:** `client/src/components/MapView.tsx`, `client/src/components/taxi/TaxiMap.tsx`, `client/src/pages/taxi/RequestRide.tsx`, `client/src/pages/taxi/RideDetail.tsx`, `client/src/App.tsx`, `vite.config.ts`

### 2.4 Cloudflare

- La web usa `/api` en el mismo origen, por lo que no necesita una URL absoluta de backend en Cloudflare.
- La app nativa conserva `VITE_NATIVE_API_BASE` como configuración opcional.
- El backend usa `@neondatabase/serverless` con Drizzle (`neon-http`), compatible con Workers.
- `scripts/prepare-cloudflare-assets.mjs` elimina un archivo local no referenciado que superaba el límite de 25 MiB de Cloudflare Static Assets.

### 2.5 Rendimiento de la home y límite de lectura

- Cada `CardItem` consultaba `/api/comments?locationId=...` al montarse. Con 40 tarjetas visibles, una sola carga de la home generaba decenas de solicitudes y agotaba `publicReadLimiter` (`300` solicitudes / 15 minutos), produciendo `429` en `/api/comments` y `/api/services`.
- Se añadió `GET /api/comments/ratings?locationIds=...`, que calcula promedio y cantidad de valoraciones en una sola consulta con `IN` + `GROUP BY`, limitada a 100 IDs.
- La home consulta ese endpoint una sola vez por conjunto de tarjetas visibles (`displayLimit`, máximo 40) y pasa el promedio a cada tarjeta con `ratingOverride`. Se hacen una o dos cargas: primero con los datos estáticos y luego al llegar los servicios de la API.
- `CardItem` dejó de hacer `fetch` individual. La sección de comentarios del detalle sigue cargando solo el servicio seleccionado.

**Archivos:** `server/storage.ts`, `server/routes/index.ts`, `client/src/pages/Home.tsx`, `client/src/components/CardItem.tsx`

### 2.6 Dependencias de autenticación nativa

- El trabajo concurrente de autenticación nativa incorporó `@capacitor/preferences` para el almacenamiento seguro del token y `@capgo/capacitor-social-login` para el login social.
- Ambas dependencias faltaban en `node_modules`, lo que rompía el arranque de Vite y el typecheck.
- Se instalaron versiones compatibles con Capacitor 8: `@capacitor/preferences@^8.0.1` y `@capgo/capacitor-social-login@^8.7.5`.

**Archivos:** `package.json`, `package-lock.json`, `client/src/lib/secureStorage.ts`, `client/src/pages/Login.tsx`

### 2.7 Flujos CRUD Frontend, Autorización y Restricciones de Base de Datos

#### A. Discrepancia en firma y ejecución de `storage.deleteService`
- **Registro de error:** `DELETE /api/services/:id` respondía `200 OK {"success": true}` pero el registro en PostgreSQL no se eliminaba (`SELECT id FROM services WHERE id = ...` devolvía la fila intacta).
- **Causa raíz extendida:** La función en `server/storage.ts` definía `deleteService(id: string, providerUsername: string)` y construía la cláusula `and(eq(services.id, id), eq(services.providerUsername, providerUsername))`. En `server/routes/index.ts`, la ruta DELETE invocaba `await storage.deleteService(req.params.id)`. Al no enviarse el segundo parámetro, `providerUsername` tomaba el valor `undefined`. En Drizzle ORM, comparar con `undefined` provocaba una cláusula SQL que evaluaba a falso o nulo, por lo que cero registros coincidían con el borrado sin generar excepción visible.
- **Solución implementada:** Se ajustó la firma a `deleteService(id: string, providerUsername?: string)` y la lógica evalúa si `providerUsername` está definido; de ser así, se filtra por id y proveedor; de lo contrario, se filtra únicamente por id.
- **Archivos:** `server/storage.ts`, `server/routes/index.ts`

#### B. Propagación de tokens Bearer en peticiones frontend
- **Registro de error:** Solicitudes a `/api/products`, `/api/services`, `/api/social/posts` y simulación PSE arrojaban `401 Unauthorized` de manera errática.
- **Causa raíz extendida:** Durante las transiciones entre navegación web estándar y automatización headless, las cookies de sesión HTTP-only podían no ser reenviadas o no estar sincronizadas inmediatamente tras redirecciones. Además, la función `auth.login` y `auth.register` no guardaban el token JWT retornado en `localStorage`, por lo que `getAuthToken()` devolvía `null` en el navegador web.
- **Solución implementada:** Se actualizó `client/src/lib/auth.ts` para persistir `auth_token` en `localStorage` en los flujos de login, registro y verificación 2FA. Se modificó `client/src/lib/secureStorage.ts` y `client/src/lib/queryClient.ts` para inyectar automáticamente la cabecera `Authorization: Bearer <token>` junto a `credentials: "include"`, proveyendo doble capa de transporte de credenciales.
- **Archivos:** `client/src/lib/auth.ts`, `client/src/lib/secureStorage.ts`, `client/src/lib/queryClient.ts`, `client/src/pages/ProductManager.tsx`, `client/src/pages/MyProducts.tsx`, `client/src/pages/ProductStore.tsx`, `client/src/pages/SocialFeed.tsx`

#### C. Intercepción de puntero en formularios modales y selectores ambiguos
- **Registro de error:** `playwright.errors.TimeoutError` o `locator.click: Element <textarea id="product-desc-input"> intercepts pointer events of <button>Crear</button>`.
- **Causa raíz extendida:** Los componentes UI usaban textos de botones genéricos como `"Crear"`, `"Agregar"` o `"Guardar"`. Los localizadores de texto en Playwright coincidían simultáneamente con el botón de apertura del diálogo de la vista principal y el botón de submit interno del modal. Al intentar hacer clic en el botón equivocado que quedaba cubierto por el backdrop o los inputs del formulario, Playwright bloqueaba la acción.
- **Solución implementada:** Se introdujeron identificadores inequívocos en los elementos clave: `#product-name-input`, `#product-desc-input`, `#product-price-input`, `#product-cost-input`, `#product-stock-input`, `#product-submit-btn`, `#create-post-fab`, `#submit-post-btn`, `#chatbot-open-btn`, `#chatbot-send-btn`, `#navbar-user-menu-btn`, `#navbar-logout-btn` y `#account-settings-logout-btn`.
- **Archivos:** `client/src/pages/ProductManager.tsx`, `client/src/pages/SocialFeed.tsx`, `client/src/components/Chatbot.tsx`, `client/src/components/Navbar.tsx`, `client/src/pages/AccountSettings.tsx`

#### D. Violación de clave foránea en eliminación de usuarios (`conversations_user_id_users_id_fk`)
- **Registro de error:** `error: update or delete on table "users" violates foreign key constraint "conversations_user_id_users_id_fk" on table "conversations"`.
- **Causa raíz extendida:** Durante los tests E2E y flujos de limpieza de cuentas (derecho al olvido), las conversaciones y mensajes generados por el chatbot de IA (`conversations` y `chat_messages`) mantenían una referencia foránea estricta a `users.id` sin `ON DELETE CASCADE`. Intentar borrar al usuario directamente fallaba con código `23503`.
- **Solución implementada:** Se estructuró el orden de purga en cascada explícito eliminando primero las referencias dependientes en `chat_messages`, `conversations`, `social_posts`, `products`, `services` y `user_roles` antes de ejecutar la eliminación del registro en `users`.
- **Archivos:** `scripts/e2e-ui-full-test.mjs`, `server/routes/index.ts`

---

## 3. Verificación final

### 3.1 Endpoints

Todos respondieron `200` con sesión autenticada:

| Endpoint | Resultado |
|----------|-----------|
| `POST /api/auth/login` | `200` |
| `GET /api/auth/me` | `200` |
| `GET /api/taxi/earnings/qa_playwright_1021` | `200` |
| `GET /api/notifications` | `200` |
| `GET /api/social/posts` | `200` |
| `GET /api/rides/nearby` | `200` |
| `GET /api/comments/ratings?locationIds=h1,r1` | `200` |
| `GET /api/products/provider/vianova_admin` | `200` |

### 3.2 Playwright

Se realizaron varias pasadas: un script de `playwright-core`, Playwright MCP y una verificación final tras el cambio de valoraciones por lote.

- **Errores de consola:** 0
- **Errores de página (`pageerror`):** 0
- **Respuestas HTTP fallidas no esperadas:** 0 (`/nuke` responde `404` de forma intencional)
- **Worker de MapLibre:** `200`
- **Home:** una o dos solicitudes a `/api/comments/ratings` (máximo 40 IDs); ninguna solicitud por tarjeta a `/api/comments`
- **`429 Too Many Requests`:** no reproducido tras el cambio
- **Rutas verificadas:** `/`, `/login`, `/social`, `/dashboard`, `/explore`, `/notifications`, `/settings`, `/messages`, `/request-ride`, `/ride-history`, `/taxi/earnings`, `/my-products`, `/products`, `/admin`, `/select-role`, `/u/qa_playwright_1021`, `/privacy` (inicio anónimo y recorrido autenticado)
- **`/nuke`:** responde `404 Page Not Found` (comportamiento esperado)
- **Redirección esperada:** un usuario con rol `traveler` que visita `/taxi-dashboard` es enviado a `/dashboard`
- **Mapas:** los contenedores de MapLibre y Leaflet se renderizan sin errores de worker ni de CSP

Evidencia generada:

- `qa-report.json`
- `qa-report2.json`
- `qa-anon-home.png`
- `qa-social.png`
- `qa-dashboard.png`
- `qa-taxi.png`
- `qa-mcp-home.png`

### 3.3 Compilación y despliegue

| Comando | Resultado |
|---------|-----------|
| `npx tsc --noEmit --pretty false` | Sin errores |
| `npm run build:cloudflare` | Correcto; 4950 módulos transformados; assets en `dist/public` |
| `npx wrangler deploy --dry-run` | Correcto; 24 archivos; 4256.42 KiB (851.37 KiB gzip) |

---

## 4. Advertencias no bloqueantes

Estas advertencias no impiden el uso ni el despliegue:

1. **Geolocalización denegada en headless:** `Home Geo error: GeolocationPositionError`. Es el comportamiento esperado cuando el navegador de pruebas no concede permisos de ubicación.
2. **Lit en modo desarrollo:** `Lit is in dev mode. Not recommended for production!`. Proviene de una dependencia y solo aparece en desarrollo.
3. **Tamaño de bundles:** el chunk principal ronda los 4.25 MB (1.22 MB gzip) y el worker de MapLibre 519 KB. Conviene aplicar code splitting en una optimización futura.
4. **Datos heredados inválidos:** todavía existe una fila con `location_lat='2000'` y `location_lng='1500'`, además de filas con coordenadas nulas. La aplicación ya las rechaza o filtra; se recomienda limpiarlas en la base de datos.
5. **Error transitorio de HMR:** durante el desarrollo se observó una vez `ReferenceError: MAP_STYLE is not defined` en `MapView.tsx`. El archivo ya usa `OSM_MAP_STYLE`; el error desapareció tras una recarga completa y no se reproduce en una carga limpia. Fue un módulo obsoleto en memoria de Vite, no un fallo del código actual.
6. **Cobertura de roles:** la cuenta de QA tiene rol `traveler`. No se probó `/taxi-dashboard` con rol `driver` porque el cambio de rol tiene un enfriamiento de 15 días. Las vistas de conductor quedan pendientes de una prueba con una cuenta específica.

---

## 5. Despliegue en Cloudflare

```bash
npm run build:cloudflare
npx wrangler deploy
```

Configurar los secretos antes del despliegue:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
npx wrangler secret put SESSION_SECRET
```

Opcionales según las funciones habilitadas:

```bash
npx wrangler secret put CLOUDINARY_CLOUD_NAME
npx wrangler secret put CLOUDINARY_API_KEY
npx wrangler secret put CLOUDINARY_API_SECRET
npx wrangler secret put GROQ_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put SMTP_HOST
npx wrangler secret put SMTP_PORT
npx wrangler secret put SMTP_USER
npx wrangler secret put SMTP_PASS
npx wrangler secret put SMTP_FROM
npx wrangler secret put CLIENT_URL
npx wrangler secret put PUBLIC_URL
```

Notas:

- `wrangler.jsonc` usa `nodejs_compat`, binding `ASSETS` y `run_worker_first` para `/api` y `/api/*`.
- La base de datos debe ser accesible por HTTP (Neon serverless).
- El archivo `.dev.vars` es solo para desarrollo local; no debe commitearse.

---

## 6. Conclusión

Los errores detectados durante la inspección con Playwright fueron corregidos y verificados. La aplicación:

- responde sin errores de consola, de página ni de red en las rutas probadas;
- pasa la verificación de TypeScript;
- compila para Cloudflare Workers;
- supera `wrangler deploy --dry-run`.

Quedan únicamente advertencias no bloqueantes y una recomendación de limpieza de datos heredados.
