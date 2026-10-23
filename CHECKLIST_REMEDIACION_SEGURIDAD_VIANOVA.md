# Checklist de Remediación de Seguridad — ViaNovaIA

**Base:** hallazgos de `INFORME_QA_SEGURIDAD_VIANOVA.md`  
**Prioridad:** `P0` bloqueante de producción, `P1` alto, `P2` medio.  
**Regla:** cada corrección debe incluir un test negativo que demuestre que el ataque ya no funciona.

---

> **Estado de verificacion (2026-10-22):** los items marcados se verificaron por revision de codigo y/o pruebas HTTP negativas (34/34 PASS). Los items de "Test" quedan sin marcar salvo la matriz 401/403 del bloque 1.2, que si se ejecuto. Rotacion de credenciales, historial de secretos y gestor de secretos siguen pendientes de una ventana de produccion.

## 0. Preparación

- [ ] Crear una rama de seguridad y congelar despliegues a producción hasta cerrar P0.
- [ ] Inventariar todos los endpoints y marcar: público, autenticado, rol requerido y ownership.
- [ ] Definir middleware reutilizables: `requireAuth`, `requireRole(...)`, `requireOwnership(...)`.
- [ ] Añadir una matriz de pruebas de autorización: sin sesión, sesión de otro usuario, rol incorrecto, admin.
- [ ] Configurar CI para ejecutar typecheck, tests, audit y build.
- [ ] Acordar una ventana para rotar credenciales sin romper el servicio.
- [ ] No volver a copiar secretos a archivos del repositorio.

---

## 1. P0 — Bloqueantes

### 1.1 Cerrar el account takeover por `POST /api/users` + 2FA

- [x] Reemplazar `sanitizeUser` por una **allowlist** de campos públicos: `id`, `username`, `name`, `email`, `role`, `roles`, `avatarUrl`, `bio`, `createdAt`.
- [x] Excluir explícitamente: `password`, `verificationToken`, `failedLoginAttempts`, `lockUntil`, `twoFactorEnabled`, `deletedAt` y cualquier secreto.
- [x] Eliminar `POST /api/users` o exigir `requireAuth` + contraseña; nunca devolver un usuario existente sin autenticarlo.
- [x] Añadir rate limit a `POST /api/auth/verify-2fa` por IP y por username.
- [x] Invalidar códigos 2FA tras un número máximo de intentos.
- [ ] Añadir auditoría de intentos 2FA fallidos.
- [ ] Test: `POST /api/users` con username existente devuelve `401/404`, nunca datos.
- [ ] Test: no se puede extraer `verificationToken` de ninguna respuesta.
- [ ] Test: fuerza bruta de 2FA queda bloqueada.

### 1.2 Aplicar autenticación y autorización globales

- [x] Poner `requireAuth` en todos los endpoints que leen o escriben datos privados.
- [x] Usar siempre `req.user.username`/`req.user.id`; no confiar en `username` del body/query.
- [x] Implementar `requireRole("admin")` para administración.
- [x] Implementar ownership por recurso: producto, orden, reserva, viaje, pago, notificación, reseña, perfil, chat.
- [x] Cambiar a política **deny by default**: toda ruta nueva nace protegida.
- [x] Revisar que ningún endpoint mutante quede como `GET`.
- [ ] Test: matriz 401/403 para cada endpoint sensible.

### 1.3 Proteger roles y datos de usuario

- [x] `PATCH /api/users/role`: auth + solo el propio usuario o admin; mantener cooldown.
- [x] `POST /api/users/:username/roles`: auth + solo el propio usuario o admin; nunca permitir `admin`.
- [x] `DELETE /api/users/:username/roles/:role`: auth + ownership; impedir quitar el último rol.
- [x] `PATCH /api/users/active-role`: auth + ownership; validar que el rol exista.
- [x] `PATCH /api/taxi/vehicle`: auth + ownership + rol taxi.
- [ ] Test: un usuario no puede cambiarse a proveedor ni modificar a otro.

### 1.4 Proteger métodos de pago

- [x] `GET/POST/DELETE/PATCH /api/payment-methods*`: `requireAuth` + ownership.
- [x] No aceptar `username` del body; usar `req.user.username`.
- [x] Cifrar/tokenizar `details`; no almacenar tarjetas en texto plano.
- [x] Devolver solo datos enmascarados (`****1234`).
- [ ] Test: un usuario no puede leer/borrar el método de otro.
- [ ] Test: la respuesta no contiene el detalle completo.

### 1.5 Bloquear el fraude del módulo taxi

- [x] `POST /api/rides`: auth; `travelerUsername` desde `req.user`.
- [x] `PATCH /api/rides/:id`: auth; solo el viajero dueño o el taxista asignado; validar transiciones.
- [x] Al aceptar, verificar que `taxiUsername` tenga rol taxi y sea el autenticado.
- [x] `PATCH /api/taxi/status`: auth + ownership.
- [ ] `POST /api/taxi/withdraw`: auth + ownership + verificación de cuenta bancaria + revisión/aprobación.
- [ ] Crear ledger inmutable de ganancias/retiros con idempotencia.
- [x] Ocultar teléfono, placa y coordenadas exactas en endpoints públicos.
- [ ] Test: no se puede crear un viaje, completarlo y retirar sin auth.
- [ ] Test: un taxista no puede retirar ganancias de otro.

### 1.6 Proteger órdenes y pagos

- [x] `POST /api/orders`: auth; `buyerUsername` desde `req.user`.
- [x] `GET /api/orders/buyer/:username` y `provider/:username`: auth + ownership.
- [x] `PATCH /api/orders/:id/status`: auth + ownership; eliminar el bypass cuando se omite `username`.
- [x] Validar transiciones de estado y reponer stock solo una vez.
- [x] Reservar stock en transacción y usar idempotency key.
- [x] Stripe: crear checkout solo para el comprador autenticado; webhook como única fuente de verdad.
- [ ] Test: IDOR de orden ajena devuelve 403.
- [ ] Test: no se puede cambiar estado sin ser proveedor/admin.

### 1.7 Proteger productos y multimedia

- [x] `POST/PATCH/DELETE /api/products*`: auth + rol proveedor + ownership.
- [x] `POST/DELETE /api/products/:id/media*`: auth + ownership del producto.
- [x] Usar `req.user.id` para `provider_id`; ignorar `username` del body.
- [x] Validar que el producto pertenezca al proveedor antes de modificarlo.
- [ ] Test: un proveedor no puede editar/borrar productos de otro.

### 1.8 Proteger el panel de administración

- [x] `GET /api/admin/stats`: `requireRole("admin")`.
- [x] No devolver usernames en logs de anomalías.
- [x] Mantener el guard del cliente, pero no confiar en él.
- [ ] Test: usuario normal recibe 403; anónimo 401.

### 1.9 Corregir CORS, cookies y CSRF

- [x] En `api/index.ts`, reemplazar `origin: true` por una allowlist explícita.
- [x] Permitir `credentials: true` solo para orígenes de la allowlist.
- [x] Rechazar orígenes desconocidos con error CORS.
- [x] Cambiar cookies a `SameSite=Lax` para web o implementar CSRF tokens.
- [x] Validar `Origin`/`Referer` en todos los métodos mutantes.
- [x] Añadir CSP y `Permissions-Policy` en `api/index.ts` o en el edge.
- [ ] Test: `Origin: https://evil.example` no recibe `ACAO` ni puede leer respuestas.
- [ ] Test: una mutación cross-site sin CSRF falla.

### 1.10 Gestionar secretos correctamente

- [ ] Rotar `DATABASE_URL`, Cloudinary, Google OAuth, SMTP y GROQ.
- [ ] Eliminar `vianova.env.txt` del repositorio y del historial de Git.
- [ ] Crear `.env.example` solo con placeholders.
- [x] Eliminar los fallbacks `via_nova_jwt_secret_key_2026` y `via_nova_secret_key_2026`.
- [x] Hacer que el servidor falle al arrancar si faltan `JWT_SECRET`/`SESSION_SECRET`.
- [ ] Usar gestor de secretos del proveedor (Vercel/Doppler/1Password).
- [ ] Test: arranque sin secretos falla con mensaje claro.
- [ ] Test: no hay secretos en el bundle ni en logs.

### 1.11 Redactar logs

- [x] Eliminar el logging de cuerpos de respuesta en `server/app.ts`.
- [x] Redactar `token`, `password`, `verificationToken`, `details`, emails y teléfonos.
- [x] Usar logging estructurado con niveles y request-id.
- [ ] Test: un login no escribe el JWT en logs.

### 1.12 Corregir Google OAuth

- [x] Añadir `state` firmado y de un solo uso; validarlo en el callback.
- [ ] Usar PKCE cuando aplique.
- [x] Fijar `redirect_uri` por entorno; no construirlo desde `Host`/`X-Forwarded-Host`.
- [x] No enviar el JWT en la URL; usar cookie HttpOnly o código de un solo uso.
- [x] Validar `aud`, `iss` y `email_verified` en `/api/auth/google/mobile`.
- [x] Usar la librería oficial de verificación de Google.
- [ ] Test: callback sin `state` falla.
- [ ] Test: token de otro cliente/audiencia falla.

### 1.13 Corregir reservas y pagos simulados

- [x] Validar `units` como entero positivo antes de bloquear.
- [x] Usar transacción/`SELECT ... FOR UPDATE` para evitar sobreventa.
- [x] Verificar ownership en `POST /api/bookings/confirm`.
- [x] Implementar job/cron que libere locks expirados.
- [x] No confirmar como pagado sin pasarela; usar estado `pending_payment`.
- [ ] Test: unidades negativas fallan.
- [ ] Test: un usuario no puede confirmar la reserva de otro.
- [ ] Test: un lock expirado libera inventario.

### 1.14 Proteger el chat

- [x] `GET /api/chat/history` y `POST /api/chat`: `requireAuth`.
- [x] Usar `req.user`; ignorar `username`/`userId` del body.
- [x] Rate limit por usuario.
- [x] No crear usuarios desde el chat.
- [ ] Test: no se puede leer el historial de otro usuario.

---

## 2. P1 — Altos

### 2.1 Servicios y comentarios

- [ ] `POST/PATCH/DELETE /api/services*`: auth + ownership.
- [ ] `POST/DELETE /api/comments*`: auth + ownership; no confiar en `username` del body.
- [ ] Añadir moderación/antispam.
- [ ] Test: no se puede borrar un comentario/servicio ajeno.

### 2.2 Upload

- [ ] `POST /api/upload`: `requireAuth`.
- [ ] Carpeta Cloudinary desde `req.user.id`, no desde `userId` del body.
- [ ] Validar magic bytes, MIME real, extensión y tamaño.
- [ ] Rechazar `application/octet-stream` genérico salvo modelos permitidos.
- [ ] Limitar por usuario y añadir moderación.
- [ ] Test: archivo disfrazado y carpeta arbitraria fallan.

### 2.3 Notificaciones

- [ ] `GET /api/notifications`: auth + ownership.
- [ ] `PATCH /api/notifications/:id/read`: auth + ownership.
- [ ] No aceptar `username` por query.
- [ ] Test: no se pueden leer/marcar notificaciones ajenas.

### 2.4 Reseñas

- [ ] `POST /api/reviews`: auth; autor desde `req.user`.
- [ ] Verificar que el viaje pertenece al autor y que el target es válido.
- [ ] Una reseña por viaje/autor; rate limit.
- [ ] Test: no se pueden crear reseñas falsas para otro usuario.

### 2.5 Perfil

- [ ] `PATCH /api/user/profile`: auth + ownership.
- [ ] No aceptar `username` del body.
- [ ] Validar avatar URL y longitudes.
- [ ] Test: no se puede editar el perfil de otro.

### 2.6 Enumeración y rate limiting de auth

- [ ] `forgot-password` y `verify-email`: respuesta genérica, sin 404 de existencia.
- [ ] Rate limit en `forgot-password`, `verify-reset-token`, `reset-password`, `verify-email`, `verify-2fa`.
- [ ] Rate limit por IP + cuenta, no solo IP.
- [ ] Tokens de reset de 128+ bits, hash en DB, un solo uso.
- [ ] No poner tokens en URLs; usar fragmento o POST.
- [ ] Test: emails inexistentes y existentes devuelven la misma respuesta.

### 2.7 PII de taxi

- [ ] Ocultar teléfono/placa en `nearby` y perfiles públicos.
- [ ] Compartir teléfono solo tras aceptar el viaje.
- [ ] Redondear/ocultar coordenadas exactas.
- [ ] Auth + ownership en historial/detalle de viajes.
- [ ] Test: `nearby` no devuelve teléfono.

### 2.8 Autenticación en APK/Capacitor

- [ ] Guardar el token en Capacitor Preferences/Keychain, no en `localStorage`.
- [ ] Añadir `Authorization: Bearer` en todas las llamadas o `credentials: "include"` si se usan cookies.
- [ ] Revisar `CapacitorHttp` y el manejo de cookies cross-origin.
- [ ] Unificar un cliente HTTP para el API.
- [ ] Probar login normal, Google mobile, refresh y logout en dispositivo.
- [ ] Test: tras login en APK, `/api/auth/me` devuelve 200.

### 2.9 Service worker/PWA

- [ ] Reescribir `client/public/sw.js` en JavaScript válido.
- [ ] Añadir iconos `icon-192x192.png` y `icon-512x512.png`.
- [ ] Probar registro, push y notificationclick.
- [ ] O eliminar el SW si no se usa.

### 2.10 Landing pública

- [ ] `Home` debe renderizar para usuarios no autenticados.
- [ ] Pedir login solo al reservar/comprar/publicar.
- [ ] Test: visitante ve la landing y no una página en blanco.

### 2.11 Dependencias

- [ ] Actualizar Capacitor a 8.5.3+.
- [ ] Actualizar `multer`, `nodemailer`, `ws`, `proxy-addr`, `ip-address`.
- [ ] Eliminar `socket.io`/`socket.io-client` si no se usan.
- [ ] Sustituir `@codetrix-studio/capacitor-google-auth` por un plugin compatible con Capacitor 8.
- [ ] Ejecutar `npm audit --omit=dev` y dejar 0 críticas/altas.
- [ ] Test: build y login Google en APK.

### 2.12 Build y CI

- [ ] Añadir CI con `tsc`, tests, audit y build.
- [ ] Reducir memoria del build (code splitting, excluir assets).
- [ ] Eliminar `client/public/dummy_assets.bin` (~55 MB).
- [ ] Verificar `npm run build` en un entorno con RAM suficiente.
- [ ] Publicar artefacto y probar arranque.

### 2.13 CSP y cabeceras

- [ ] CSP estricta en producción, sin `unsafe-inline`/`unsafe-eval` si es posible.
- [ ] Añadir `Permissions-Policy` en `api/index.ts`.
- [ ] Verificar HSTS, XFO, XCTO y Referrer-Policy.
- [ ] Test: headers presentes en Vercel.

### 2.14 Rate limiting distribuido

- [ ] Sustituir `WorkerMemoryStore` por Redis/Upstash.
- [ ] Acotar `trust proxy` al proxy real.
- [ ] Validar `X-Forwarded-For`.
- [ ] Test: el límite se mantiene entre instancias.

### 2.15 Solicitudes de reserva

- [ ] `POST /api/bookings/request`: auth + rate limit.
- [ ] Escapar HTML de `travelerName`/`details`.
- [ ] Validar `providerUsername` y limitar destinatarios.
- [ ] Actualizar nodemailer.
- [ ] Test: no se envía HTML/headers inyectados.

### 2.16 Cuentas Google

- [ ] Guardar `auth_provider` en DB (`local`/`google`).
- [ ] Basar el reset y el borrado de cuenta en `auth_provider`, no en el hash.
- [ ] Permitir borrar cuenta Google sin contraseña local.
- [ ] Test: cuenta Google no puede crear contraseña local si la política lo prohíbe.

### 2.17 Panel admin en servidor

- [ ] Guard server-side en `/api/admin/stats` y cualquier endpoint admin.
- [ ] No confiar solo en `AdminDashboard.tsx`.
- [ ] Test: acceso directo sin rol admin falla.

---

## 3. P2 — Medios

- [ ] Corregir filtro de precio de Home: mapear `priceRange` o eliminar el filtro.
- [ ] Unificar puerto de Vite (`5055`) y servidor (`5000`) o usar variable compartida.
- [ ] Revisar `staleTime: Infinity` de React Query.
- [ ] Fijar `getBaseUrl` por entorno; no confiar en `Host`.
- [ ] Endurecer `/api/maps/resolve`: no seguir redirects, bloquear IP privadas, timeout.
- [ ] Añadir auth/rate limit/voces allowlist a `api/tts.py`.
- [ ] Poner `android:allowBackup="false"` o backup rules restrictivas.
- [ ] Implementar revocación de JWT (`jti`/denylist) y expiración corta.
- [ ] Añadir política de contraseñas (mínimo 8-12, blocklist).
- [ ] Implementar o eliminar `POST /api/users/:id/location`.
- [ ] Minimizar roles/perfiles públicos y añadir rate limit.
- [ ] Limpiar rutas sociales inline duplicadas; dejar una sola fuente.
- [ ] Añadir observabilidad/alertas (Sentry/OpenTelemetry) sin PII.
- [ ] Stripe: auth, reserva de stock, idempotencia y webhook como fuente de verdad.
- [ ] Liberar locks de reserva expirados con job/cron.
- [ ] Revisar endpoints legacy y eliminarlos si no se usan.

---

## 4. Pruebas de aceptación

- [ ] Matriz de autorización: anónimo → 401; otro usuario → 403; dueño → 200; admin → 200.
- [ ] Account takeover: `POST /api/users` + 2FA ya no funciona.
- [ ] Fraude taxi: viaje falso + retiro ya no funciona.
- [ ] IDOR: órdenes, pagos, productos, reservas, notificaciones, reseñas y perfil.
- [ ] CORS: origen malicioso no recibe `ACAO` ni credenciales.
- [ ] CSRF: mutación cross-site sin token falla.
- [ ] Upload: archivo disfrazado, carpeta arbitraria y tamaño excesivo fallan.
- [ ] OAuth: callback sin `state`, `aud` incorrecta y token en URL fallan.
- [ ] Logs: no contienen JWT, contraseñas ni PII.
- [ ] Dependencias: `npm audit --omit=dev` sin críticas/altas.
- [ ] Build: `npm run build` exitoso y artefacto arranca.
- [ ] APK: login, Google, `/api/auth/me`, compra y logout funcionan.
- [ ] PWA: service worker registra y push funciona.
- [ ] Rate limit: se mantiene entre instancias y no se bypassa con `X-Forwarded-For`.

---

## 5. Definición de terminado

- [ ] Todos los P0 marcados y con test de regresión.
- [ ] Todos los secretos rotados y fuera del repositorio.
- [ ] Ningún endpoint mutante sin auth/ownership.
- [ ] CORS con allowlist y CSRF resuelto.
- [ ] Build y CI en verde.
- [ ] `npm audit --omit=dev` sin críticas/altas (o riesgo aceptado por escrito).
- [ ] Pruebas en APK y navegador real completadas.
- [ ] Pentest externo o revisión independiente antes de producción.
- [ ] Plan de rollback y respuesta a incidentes documentado.

---

## 6. Comandos útiles

```powershell
# Typecheck con heap limitado
$env:NODE_OPTIONS='--max-old-space-size=768 --max-semi-space-size=32'
npx tsc --noEmit --pretty false

# Build
npm run build

# Auditoría
npm audit --omit=dev

# Service worker
node --check client/public/sw.js

# Prueba rápida de endpoint protegido
curl.exe -i http://localhost:5055/api/admin/stats
curl.exe -i -H "Origin: https://evil.example" http://localhost:5055/api/health
```

**Criterio de cierre:** no marcar un ítem como completado solo porque el código compila; debe existir una prueba que demuestre que el vector de ataque concreto ya no funciona.
