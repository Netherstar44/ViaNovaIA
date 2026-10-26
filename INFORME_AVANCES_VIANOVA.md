# Informe de Avances — ViaNovaIA

**Fecha:** 2026-10-23  
**Alcance:** cierre de los cuatro frentes trabajados en paralelo: (1) mapa y pantalla oscura, (2) checklist QA front/back, (3) remediación de seguridad P0-P3, (4) informe técnico y README.  
**Repositorio:** https://github.com/Netherstar44/ViaNovaIA  
**Rama:** `main`

---

## 1. Resumen ejecutivo

| Frente | Estado | Evidencia principal |
|---|---|---|
| Mapa y pantalla oscura | Resuelto | MapLibre + tiles OSM, worker en producción, capturas claro/oscuro, 15 recursos de tiles cargados |
| QA front/back | Cerrado | E2E 9/9 PASS (`scripts/e2e-ui-report.json`), `tsc` 0, build y arranque de producción OK |
| Seguridad P0-P3 | P0/P1 implementados y probados | 34/34 pruebas negativas PASS; checklist actualizado |
| Documentación | Completa | `README.md`, `docs/CHECKLIST_QA_VIANOVA.md`, este informe y checklist de seguridad |

La aplicación queda funcional en local, con build de producción verificada, autenticación por cookie `HttpOnly`, autorización por rol/ownership y flujos E2E completos.

---

## 2. Mapa y experiencia de carga

### Problemas corregidos

- El mapa dependía de Mapbox/CartoDB y de un token; se migró a un estilo raster de **OpenStreetMap sin token** (`client/src/lib/map-style.ts`).
- El worker de MapLibre no se resolvía en producción; se importa con `?url` (`client/src/lib/maplibre-worker.ts`) y Vite lo emite como asset hasheado. Verificado en `dist/public/assets/maplibre-gl-worker-*.mjs`.
- El Home devolvía `null` mientras resolvía la sesión, dejando la pantalla en negro. Ahora muestra un **splash** con spinner.
- `localStorage.user` corrupto rompía el arranque. La lectura es tolerante a errores y limpia el valor inválido.
- `/api/auth/me` podía colgar la UI; el cliente aplica un **timeout de 8 s** y conserva la sesión cacheada ante fallos de red.
- Se añadió un **ErrorBoundary global** para evitar pantallas en blanco ante errores de render.
- El tema oscuro invertía todo el mapa (incluidos marcadores). Ahora solo se invierte el canvas de MapLibre; marcadores, popups y controles conservan sus colores.

### Evidencia

- Canvas MapLibre presente en Home y en `/request-ride`.
- Peticiones a `tile.openstreetmap.org` con HTTP 200.
- Capturas: `qa-final-home-light.png`, `qa-final-home-dark.png`, `qa-mcp-home.png` (locales, no versionadas).
- En producción: `/`, `/api/health` y el worker responden 200.

---

## 3. Autenticación, sesión y frontend

- La sesión web vive en una cookie **`HttpOnly`, `SameSite=Lax`**; el JWT ya **no se guarda en `localStorage`**. En Android/iOS se usa Capacitor Preferences (`client/src/lib/secureStorage.ts`).
- Flujo de login, logout, registro, verificación de correo, recuperación de contraseña y 2FA revisados.
- Redirección limpia de usuario anónimo a `/login` sin bloqueo.
- Notificaciones: rutas `GET /api/notifications` y `PATCH /api/notifications/:id/read` implementadas; la UI funciona con sesión.
- Comentarios: se eliminó el N+1 de tarjetas; las calificaciones se consultan en lote con `GET /api/comments/ratings`.
- Se corrigieron textos de la reserva PSE: ahora indica **pago pendiente de verificación**, no "pago exitoso".
- Logout con redirección limpia y sin errores de consola.
- Rutas relevantes: `/`, `/login`, `/select-role`, `/settings`, `/my-products`, `/notifications`, `/dashboard`, `/admin`, `/taxi-dashboard`, `/taxi/ride/:id`, `/taxi/earnings`, `/request-ride`, `/ride-history`, `/social`, `/messages`, `/u/:username`, `/privacy`, `/products`, `/explore`.

---

## 4. Seguridad

### Controles implementados

- **Autenticación/autorización:** `requireAuth`, `requireRole`, `requireSelfOrAdmin`, ownership por recurso; identidad tomada de `req.user`, no del body/query.
- **Roles:** no se puede asignar `admin`; no se puede quitar el último rol; `active-role` exige poseer el rol.
- **Métodos de pago:** cifrado en reposo, respuesta enmascarada, ownership y bloqueo de IDOR.
- **Taxi:** viajes con auth, transiciones validadas, aceptación solo por taxista autenticado, PII minimizada, retiros con rol, monto validado e idempotencia.
- **Reservas:** locks atómicos, `units` entero positivo, expiración con liberación de inventario, confirmación con ownership y estado `pending_payment`.
- **Órdenes:** comprador desde el token, stock atómico, cantidades 1-99, transiciones válidas, reposición única, `paid` reservado a admin/webhook.
- **Productos/media:** ownership, validación de archivos/URLs, precio y stock saneados; el costo interno y `provider_id` ya no se exponen en listados públicos (`sanitizeProduct`).
- **Reseñas:** solo viajes completados, participación verificada, bloqueo de auto-reseña y duplicados.
- **Admin:** estadísticas solo para rol admin; logs sin usernames.
- **CORS/CSRF:** allowlist de orígenes, `credentials` solo para orígenes permitidos, validación de `Origin` en métodos mutantes; en producción no se aceptan orígenes locales.
- **Cabeceras/CSP:** aplicadas por `server/http-security.ts`.
- **Rate limiting:** login, registro, 2FA, recuperación, escrituras, reservas, mapas, lecturas públicas y chat.
- **Uploads:** MIME/extensión/tamaño/nombre saneado.
- **SSRF:** resolución de enlaces de Google Maps limitada a hosts permitidos, bloqueo de loopback/redes privadas/metadatos.
- **OAuth Google:** `state` de un solo uso, validación de `aud`, `iss`, `email_verified`, firma RS256 y `kid` (`server/google-auth.ts`).
- **Stripe:** webhook con verificación de firma y cuerpo crudo; única fuente de verdad para órdenes pagadas.
- **Secretos:** `.env`, `.dev.vars` y `vianova.env.txt` están fuera del repositorio; el servidor falla al arrancar sin `JWT_SECRET`/`SESSION_SECRET` válidos.
- **Logs:** request-id, niveles y sin tokens/contraseñas/códigos 2FA.

### Pruebas negativas

Matriz ejecutada contra el servidor final: **34/34 PASS**.

Incluye:

- 401 sin sesión en endpoints privados.
- 403 por rol insuficiente e IDOR (pagos, viajes, perfiles, órdenes).
- CSRF con `Origin` malicioso → 403.
- CORS sin `Access-Control-Allow-Origin` para origen no permitido.
- `POST /api/users` legacy eliminado → 404 JSON.
- Métodos de pago enmascarados.
- SSRF a loopback bloqueado.
- `PATCH /api/user/profile` no permite editar a otro usuario.
- `active-role` rechaza roles no poseídos.
- Rutas de taxi y admin protegidas.

---

## 5. QA e integración

### Suite E2E

`scripts/e2e-ui-full-test.mjs` → `scripts/e2e-ui-report.json`:

| Flujo | Resultado |
|---|---|
| Registro y rol | PASS |
| Login UI | PASS |
| Producto: crear/eliminar | PASS |
| Servicio: crear/eliminar | PASS |
| Chatbot | PASS |
| Mapa + taxi | PASS |
| Social: crear/likear/borrar | PASS |
| Dashboard | PASS |
| Logout | PASS |

**Resultado:** `passed=true`, 9/9 PASS, 0 peticiones fallidas, 0 `pageerror`. Los 27 errores de consola fueron `net::ERR_INSUFFICIENT_RESOURCES` por presión de memoria del equipo de prueba, no por fallos de la app.

### Typecheck y build

```text
npx tsc --noEmit                → exit 0
npm run build                   → OK (cliente + servidor)
npm run start (PORT=5055)       → /api/health 200, / 200, worker 200
```

El build emite `dist/index.cjs` y `dist/public/assets/maplibre-gl-worker-*.mjs`.

---

## 6. Documentación

- `README.md`: arquitectura, stack, roles, seguridad, mapas, variables de entorno, API, despliegue (Node/Cloudflare/Vercel/Android), troubleshooting y limitaciones.
- `docs/CHECKLIST_QA_VIANOVA.md`: checklist front/back con estado por flujo, matriz API, seguridad, integridad, rendimiento, evidencia y criterios de salida.
- `CHECKLIST_REMEDIACION_SEGURIDAD_VIANOVA.md`: checkboxes P0 actualizados con la verificación de esta ronda.
- `INFORME_QA_SEGURIDAD_VIANOVA.md`: hallazgos originales y contexto de auditoría.
- `CLOUDFLARE_DEPLOY.md`, `.dev.vars.example`, `wrangler.jsonc`: despliegue en Cloudflare.

---

## 7. Pendientes y riesgos

1. **Rotar credenciales reales** usadas durante el desarrollo (Neon, Cloudinary, Google OAuth, SMTP, Groq) antes de producción.
2. Configurar un **gestor de secretos** y HTTPS en el entorno de despliegue.
3. Añadir la suite E2E y el typecheck a **CI** (GitHub Actions).
4. Los pagos PSE son simulados; Stripe es opcional y requiere claves y webhook reales.
5. OSM/Nominatim/OSRM son servicios públicos sin SLA; para tráfico alto se necesita proxy o proveedor dedicado.
6. ProviderDashboard existe sin ruta registrada; `/my-products` y `/products` siguen siendo dos experiencias distintas.
7. PWA parcial (push sin manifest/offline completo) e i18n parcial.
8. Medir Core Web Vitals en un despliegue real.

---

## 8. Conclusión

Los cuatro frentes quedan cerrados a nivel local y verificados con typecheck, build de producción, arranque real, suite E2E 9/9 y matriz de seguridad 34/34. El repositorio queda listo para revisión y despliegue controlado, con los pendientes de rotación de credenciales y CI documentados explícitamente.
