# Checklist QA Front/Back — ViaNovaIA

**Fecha:** 2026-10-22  
**Alcance:** verificación funcional, de integración y de seguridad de la SPA React + API Express.  
**Entorno de referencia:** Windows 11, Node.js 22, PostgreSQL (Neon), servidor local `http://localhost:5000`, navegador Chromium headless.  
**Documentos relacionados:** [`README.md`](../README.md), [`INFORME_QA_SEGURIDAD_VIANOVA.md`](../INFORME_QA_SEGURIDAD_VIANOVA.md), [`CHECKLIST_REMEDIACION_SEGURIDAD_VIANOVA.md`](../CHECKLIST_REMEDIACION_SEGURIDAD_VIANOVA.md).

> Convención: `[x]` verificado con evidencia en esta ronda; `[~]` parcial o con observaciones; `[ ]` pendiente de ejecutar.

---

## 1. Arranque y salud del proyecto

- [x] `npm install` completa sin errores bloqueantes.
- [x] `npx tsc --noEmit` termina con código 0 (`NODE_OPTIONS=--max-old-space-size=2048`).
- [x] El servidor de desarrollo arranca y expone `GET /api/health` → `{"ok":true}`.
- [x] El puerto por defecto del servidor (`5000`) coincide con el proxy de Vite.
- [x] Las rutas SPA desconocidas devuelven `index.html`; las rutas `/api/*` desconocidas devuelven JSON 404.
- [ ] `npm run build` de producción verificado en un equipo con memoria suficiente.
- [ ] `npm run start` sobre `dist/` verificado.

**Evidencia:** salida de `tsc`, log del servidor, prueba HTTP de `/api/health` y de `/api/users` (404 JSON).

---

## 2. Autenticación y sesión

- [x] Registro con usuario, correo, contraseña y aceptación de términos.
- [x] Verificación de correo y reenvío de código con límites de tasa.
- [x] Login con usuario o correo; sesión persistida en cookie `HttpOnly`.
- [x] El JWT **no** se guarda en `localStorage` en web; en nativo se usa Capacitor Preferences.
- [x] Logout revoca el token y limpia la sesión local.
- [x] `GET /api/auth/me` responde 401/200 correctamente y tiene timeout de 8 s en el cliente.
- [x] Usuario anónimo en `/` es redirigido a `/login` sin pantalla en blanco ni bloqueo.
- [x] La pantalla de login renderiza texto legible en tema claro y oscuro.
- [x] 2FA: activación, verificación y límites de intentos (código y rate limit).
- [x] Recuperación de contraseña: token de un solo uso, con hash y expiración.
- [x] `POST /api/users` (creación legacy sin verificación) está eliminado.
- [x] El registro no permite elegir rol `admin`.
- [x] Errores de autenticación no filtran si el usuario existe.

---

## 3. Rutas y pantallas del frontend

| Ruta | Pantalla | Resultado | Observaciones |
|---|---|---|---|
| `/` | Home / mapa | [x] | Splash durante carga; mapa visible con sesión. |
| `/login` | Login / registro | [x] | Tema claro y oscuro verificados. |
| `/dashboard` | Panel por rol | [x] | Carga sin errores de página. |
| `/social` | Feed social | [x] | Crear, likear y borrar publicación (E2E). |
| `/products` | ProductManager | [x] | Crear y borrar producto (E2E). |
| `/my-products` | Mis servicios | [~] | Lectura y CRUD de API verificados; el paso E2E de creación por UI falló y debe repetirse. |
| `/taxi-dashboard` | Panel taxista | [x] | Requiere rol taxi; guardas verificadas. |
| `/request-ride` | Solicitar viaje | [x] | Mapa y formulario visibles (E2E). |
| `/notifications` | Notificaciones | [x] | Endpoint implementado; UI verificada con sesión. |
| `/settings` | Ajustes de cuenta | [x] | Renderiza con sesión. |
| `/messages` | Mensajes | [x] | Renderiza con sesión. |
| `/admin` | Panel admin | [x] | Denegado a usuario no admin (403 en API). |
| Ruta inexistente | 404 SPA | [x] | No rompe la aplicación. |

- [x] `ErrorBoundary` global captura errores de render y muestra fallback.
- [x] `localStorage.user` corrupto o ausente no rompe el arranque.
- [~] Todas las páginas usan `React.lazy` (hoy las rutas se importan de forma eager).
- [~] i18n completo en los cinco idiomas (cobertura parcial conocida).

---

## 4. Mapas y geolocalización

- [x] MapLibre GL JS renderiza un `<canvas>` en Home y en el flujo de taxi.
- [x] Los tiles de OpenStreetMap responden HTTP 200 (sin token de Mapbox).
- [x] El estilo del mapa está centralizado en `client/src/lib/map-style.ts`.
- [x] El worker de MapLibre se importa con `?url` (`client/src/lib/maplibre-worker.ts`) para producción.
- [x] Tema oscuro: solo se invierte el canvas, no los marcadores ni los controles.
- [x] Atribución y controles legibles en tema oscuro.
- [x] Si el mapa falla, la página sigue mostrando contenido (no queda en negro).
- [x] Enlace de Google Maps: solo se aceptan hosts permitidos y no se siguen redirecciones fuera de ellos.
- [x] SSRF: `GET /api/maps/resolve` bloquea loopback, redes privadas y metadatos.
- [ ] Prueba visual del mapa en el APK Android final.

**Evidencia:** capturas `home-map-dark.png`, `home-map-dark2.png`, `qa-mcp-home.png`; peticiones a `tile.openstreetmap.org` con estado 200.

---

## 5. Flujos E2E de interfaz

Suite: `scripts/e2e-ui-full-test.mjs` → `scripts/e2e-ui-report.json`.

| # | Flujo | Resultado |
|---|---|---|
| 1 | Registro y selección de rol | PASS |
| 2 | Login por UI | PASS |
| 3 | Crear y eliminar producto (`/products`) | PASS |
| 4 | Crear y eliminar servicio (`/my-products`) | FAIL (ver nota) |
| 5 | Chatbot con respuesta de IA | PASS |
| 6 | Mapa y formulario en `/request-ride` | PASS |
| 7 | Publicación social: crear, likear, borrar | PASS |
| 8 | Dashboard y tema | PASS |

**Nota del paso 4:** la API `POST/DELETE /api/services` responde 200 correctamente en una prueba directa con el mismo usuario. El fallo está en el selector/timing del script E2E (el formulario de `/my-products` usa campos con IDs `#service-name-input`, `#service-desc-input` y `#service-submit-btn`). Se debe repetir con espera explícita del diálogo y verificar el mensaje "Producto creado exitosamente".

- [x] La suite captura errores de consola, errores de página y peticiones fallidas.
- [x] No se detectaron `pageerror` en la corrida.
- [ ] Repetir la suite completa contra el servidor final y con la base de datos limpia de datos de prueba.
- [ ] Añadir la suite a CI (GitHub Actions) con variables de entorno de test.

**Errores de consola observados:** `GET /api/notifications?username=...` devolvió 404 en una corrida anterior. Las rutas ya existen; se debe reiniciar el servidor y repetir para confirmar. El cliente no debe enviar `username` (el servidor usa el usuario del token).

---

## 6. API — autenticación y autorización

Matriz negativa ejecutada con `scripts/security-smoke` (34/34 PASS en la última corrida):

- [x] Endpoints protegidos sin sesión → 401.
- [x] Usuario autenticado sin rol suficiente → 403.
- [x] IDOR de métodos de pago, viajes, perfiles y órdenes → 403/404.
- [x] `PATCH /api/user/profile` ignora `username` ajeno y actualiza solo al usuario del token.
- [x] `PATCH /api/users/active-role` rechaza roles no poseídos.
- [x] `GET /api/admin/stats` exige rol `admin`.
- [x] `GET /api/rides/nearby` y `PATCH /api/taxi/status` exigen rol `taxi`/`admin`.
- [x] `POST /api/reviews` exige participación en un viaje completado y bloquea auto-reseñas.
- [x] `POST /api/orders` exige sesión y reserva stock de forma atómica.
- [x] `PATCH /api/orders/:id/status` valida ownership, transición y no permite marcar `paid` sin admin/webhook.
- [x] `POST /api/stripe/webhook` verifica la firma y el cuerpo crudo.
- [x] `POST /api/products` y `/api/media` validan archivos y ownership.
- [x] `GET /api/payment-methods/:username` solo devuelve métodos propios o admin, con datos enmascarados.
- [x] Rutas de chat e historial exigen autenticación y ownership.
- [x] Los errores de API son JSON y no HTML del fallback SPA.

---

## 7. Seguridad transversal

- [x] CORS con lista de orígenes permitidos; un origen malicioso no recibe `Access-Control-Allow-Origin`.
- [x] CSRF: métodos de escritura con `Origin` no permitido → 403.
- [x] Cookies `HttpOnly`, `SameSite` y `Secure` en producción.
- [x] CSP y cabeceras de seguridad aplicadas por `server/http-security.ts`.
- [x] Secretos fuera del repositorio (`.env`, `.dev.vars`, `vianova.env.txt` ignorados).
- [x] Arranque falla si faltan `JWT_SECRET` o `SESSION_SECRET` débiles.
- [x] Rate limiting en login, registro, 2FA, recuperación, escrituras, reservas, mapas y lecturas públicas.
- [x] Uploads: tipo MIME, extensión, tamaño y nombre saneado.
- [x] Logs sin tokens, contraseñas, códigos 2FA ni usernames en estadísticas de anomalías.
- [x] SSRF bloqueado en resolución de enlaces de mapas.
- [x] Dependencias auditadas; revisar hallazgos restantes antes de producción.
- [ ] Rotar credenciales reales usadas durante el desarrollo antes del despliegue.
- [ ] Configurar HTTPS y un gestor de secretos en producción.

---

## 8. Integridad de datos y concurrencia

- [x] Bloqueo de cupos con `UPDATE ... WHERE capacity - booked >= units` (sin sobreventa).
- [x] Reservas temporales expiran y liberan inventario (`releaseExpiredLocks`).
- [x] Confirmación de reserva con ownership y estado `pending_payment` (PSE simulado).
- [x] Stock de productos se descuenta y repone una sola vez.
- [x] Viajes: transiciones de estado validadas y actualizaciones atómicas.
- [x] Retiros: monto validado, cuenta saneada, idempotencia.
- [x] Webhook de Stripe como única fuente de verdad para órdenes pagadas.

---

## 9. Rendimiento y experiencia

- [x] Se eliminó la consulta N+1 de comentarios en las tarjetas; se usa `GET /api/comments/ratings` en lote.
- [x] El Home muestra splash en lugar de `null` durante la carga.
- [x] Timeout de sesión evita bloqueo indefinido si la API no responde.
- [~] El bundle inicial puede reducirse con lazy routes.
- [~] Las imágenes públicas usan `loading="lazy"` en las tarjetas principales.
- [ ] Medir Core Web Vitals en un despliegue real.
- [ ] Probar con red lenta y dispositivo móvil de gama baja.

---

## 10. Limitaciones conocidas (no bloqueantes para QA local)

- Pagos PSE son simulados; no hay cobro real.
- OSM/Nominatim/OSRM son servicios públicos sin SLA.
- ProviderDashboard existe pero no tiene ruta registrada.
- `/my-products` y `/products` son dos experiencias de gestión distintas.
- El Navbar enlaza "Mis Productos" a `/products`.
- Service worker de push sin manifest/offline completo.
- i18n parcial.
- Datos mock en `RideHistory`.

---

## 11. Evidencia

| Archivo | Contenido |
|---|---|
| `scripts/e2e-ui-report.json` | Resultado de la suite E2E (7/8 PASS). |
| `qa-mcp-home.png` | Home con mapa OSM en tema claro. |
| `home-map-dark.png`, `home-map-dark2.png` | Mapa en tema oscuro. |
| `qa-dashboard.png`, `qa-social.png`, `qa-taxi.png` | Capturas de pantallas principales. |
| `audit.json` | Salida de auditoría de dependencias. |
| Salida de `npx tsc --noEmit` | Typecheck sin errores. |

---

## 12. Comandos de reproducción

```bash
# Typecheck
$env:NODE_OPTIONS="--max-old-space-size=2048"; npx tsc --noEmit

# Servidor de desarrollo (API + Vite en 5000)
npm run dev

# Salud
curl http://localhost:5000/api/health

# Suite E2E (requiere servidor y base de datos)
node scripts/e2e-ui-full-test.mjs

# Build de producción
npm run build
npm run start
```

---

## 13. Criterio de salida

Se considera apto para QA cerrada cuando:

1. `tsc` y `npm run build` pasan sin errores.
2. La suite E2E completa queda en PASS (incluido el paso 4).
3. La matriz de seguridad negativa queda en 34/34.
4. El mapa renderiza tiles en claro y oscuro sin errores de consola.
5. No hay secretos en el repositorio ni en el historial de Git.
