# Informe QA y Seguridad — ViaNovaIA

**Fecha:** 20/10/2026  
**Alcance:** revisión del repositorio local en `C:\Users\Famil\Downloads\ViaNovaIA-main\ViaNovaIA-main`  
**Instantánea:** `server/routes/index.ts` estable a las 17:30:38; UI con cambios hasta las 17:37.  
**Estado general:** aplicación amplia y funcional en muchos flujos, pero **no apta para producción** sin corregir los hallazgos P0.

---

## 1. Resumen ejecutivo

ViaNovaIA incluye marketplace, reservas, pagos simulados/Stripe, red social, mensajería, módulo taxi, chatbot con IA, analítica por rol, multi-rol, PWA y APK. La arquitectura y la variedad funcional son notables, pero la superficie de seguridad es muy grande y buena parte de los endpoints sensibles **no verifica autenticación ni autorización**.

Se identificaron **14 hallazgos críticos (P0), 17 altos (P1) y 16 medios (P2)**. Los riesgos más graves son:

1. **Toma de control de cuentas:** `POST /api/users` devuelve datos del usuario existente, incluido `verificationToken`; si la cuenta tiene 2FA, ese token contiene el código. Con `/api/auth/verify-2fa` (sin rate limit) se puede obtener una sesión válida.
2. **Fraude financiero:** creación de viajes, cambio de estado, generación de ganancias y retiro de dinero sin autenticación (`/api/rides`, `/api/taxi/withdraw`).
3. **Modificación de roles y datos de cualquier usuario:** endpoints de roles, perfil, vehículo y métodos de pago sin auth.
4. **Fuga de datos:** `/api/admin/stats`, `/api/payment-methods/:username`, pedidos, notificaciones, chat e historial de viajes sin auth.
5. **CORS de producción permisivo:** `api/index.ts` refleja cualquier origen con credenciales y la cookie usa `SameSite=None`; no hay CSRF.
6. **Secretos y fallbacks:** `vianova.env.txt` contiene credenciales reales; `JWT_SECRET` y `SESSION_SECRET` tienen valores por defecto conocidos.

El typecheck pasa con un heap limitado, pero **el build de producción no pudo verificarse** por OOM del entorno. No hay tests, lint, CI ni E2E.

---

## 2. Metodología y limitaciones

**Realizado:**

- Revisión estática de backend, frontend, esquema, configuración Vercel, Capacitor/Android, PWA y scripts de build.
- `npx tsc --noEmit` con `NODE_OPTIONS=--max-old-space-size=768 --max-semi-space-size=32`: **exit 0** en la instantánea.
- Pruebas HTTP no destructivas contra el servidor local en el puerto 5055.
- `npm audit --omit=dev`, `npm outdated`, `npm ls` y verificación de peer dependencies.
- `node --check client/public/sw.js`.
- Revisión de hashes y timestamps para detectar edición concurrente.

**Limitaciones:**

- Otro proceso/agente estuvo editando archivos durante la auditoría; los hallazgos corresponden a la instantánea indicada y deben revalidarse antes de corregir.
- No se ejecutó el build completo: los intentos con 768 MB y 1024 MB terminaron en OOM (`exit 134`), con ~993 MB de RAM libre.
- No se probó en navegador real, APK/Android ni E2E.
- No se ejecutaron endpoints destructivos (`/api/nuke-local232`, `/api/seed-60`, `/api/migrate`, `/api/taxi/migrate`).
- No se imprimieron secretos; solo se verificaron nombres de variables y presencia.

---

## 3. Hallazgos críticos (P0)

### P0-01 — Endpoints destructivos sin autenticación

- **Dónde:** `server/routes/index.ts:215` (`/api/nuke-local232`), `:249` (`/api/seed-60`), `:980` (`/api/migrate`), `server/routes/taxi.routes.ts:42` (`/api/taxi/migrate`).
- **Qué:** son `GET` públicos que borran productos/servicios, insertan datos y modifican el esquema.
- **Impacto:** cualquier visitante puede destruir o contaminar la base de datos y ejecutar migraciones.
- **Remediación:** eliminarlos en producción o exigir `requireAuth` + rol admin + método `POST` + confirmación. Nunca usar `GET` para mutaciones.

### P0-02 — Toma de control de cuentas vía `POST /api/users` + 2FA

- **Dónde:** `server/routes/index.ts:99` (`sanitizeUser` solo elimina `password`), `:743` (`POST /api/users`), `:465` (`POST /api/auth/verify-2fa`), `shared/schema.ts:44` (`verificationToken`).
- **Qué:** `POST /api/users` con un `username` existente devuelve `sanitizeUser(user)` sin comprobar contraseña ni sesión. Ese objeto conserva `verificationToken`, `failedLoginAttempts`, `lockUntil`, email, teléfono y otros campos. Si el usuario tiene 2FA, `verificationToken` tiene la forma `2fa:<código>:<expiración>`; el atacante extrae el código y lo envía a `/api/auth/verify-2fa`, que no tiene rate limit y devuelve JWT/cookie.
- **Impacto:** account takeover de cualquier usuario con 2FA; fuga de email/teléfono/estado de bloqueo para el resto.
- **Remediación:** eliminar la ruta legacy o exigir auth y contraseña; `sanitizeUser` debe usar una allowlist estricta y excluir `verificationToken`, `failedLoginAttempts`, `lockUntil`, `twoFactorEnabled` y cualquier secreto. Añadir rate limit y auditoría a `verify-2fa`.

### P0-03 — Roles y privilegios modificables sin autenticación

- **Dónde:** `server/routes/index.ts:710` (`PATCH /api/users/role`), `:1657` (`POST /api/users/:username/roles`), `:1698` (`DELETE /api/users/:username/roles/:role`), `:1723` (`PATCH /api/users/active-role`), `:1749` (`PATCH /api/taxi/vehicle`).
- **Qué:** cualquier visitante puede cambiar el rol de cualquier usuario, añadirle/quitarle roles (hotel, taxi, etc.), cambiar el rol activo y modificar vehículo/placa/teléfono.
- **Impacto:** escalada de privilegios, suplantación de proveedores, manipulación de datos de negocio y base para el fraude de taxi.
- **Remediación:** `requireAuth` + verificar que `req.user.username === username` o rol admin; validar roles permitidos; no confiar en `username` del body; auditar cambios.

### P0-04 — Métodos de pago sin auth y datos sensibles en texto plano

- **Dónde:** `server/routes/index.ts:1823` (GET), `:1832` (POST), `:1849` (DELETE), `:1860` (PATCH default); `server/storage.ts:338`.
- **Qué:** `GET /api/payment-methods/:username` devuelve los métodos de cualquier usuario, incluidos `details` (Nequi/Daviplata/tarjeta) almacenados en texto plano. Crear, borrar y marcar predeterminado tampoco requiere auth.
- **Impacto:** fuga de datos financieros, borrado/manipulación de métodos de pago y fraude.
- **Remediación:** `requireAuth` + ownership; cifrar/tokenizar `details`; no devolver el detalle completo; usar Stripe/pasarela para tarjetas; auditar.

### P0-05 — Módulo taxi: fraude financiero y PII sin auth

- **Dónde:** `server/routes/taxi.routes.ts:191` (`POST /api/rides`), `:242` (`PATCH /api/rides/:id`), `:325` (`PATCH /api/taxi/status`), `:343` (`GET /api/taxi/nearby`), `:356` (perfil), `:373` (earnings), `:411` (`POST /api/taxi/withdraw`).
- **Qué:** sin auth se puede crear un viaje, aceptarlo/completarlo asignando cualquier taxi, generar una ganancia y solicitar un retiro a una cuenta bancaria arbitraria. `GET /api/taxi/nearby` y el perfil exponen teléfono, placa y ubicación.
- **Impacto:** fraude económico completo (viaje falso → ganancia → retiro), fuga de PII de taxistas y manipulación de disponibilidad.
- **Remediación:** auth + RBAC en todos los endpoints; el taxista solo puede operar sus viajes; el viajero solo los suyos; retiros con verificación de titularidad, revisión y ledger; no exponer teléfono/placa en listados públicos.

### P0-06 — Órdenes sin auth y cambio de estado sin ownership

- **Dónde:** `server/routes/index.ts:2157` (`POST /api/orders`), `:2226` (buyer), `:2242` (provider), `:2258` (`PATCH /api/orders/:id/status`).
- **Qué:** se pueden crear órdenes con `buyerUsername` arbitrario, listar órdenes de cualquier comprador/proveedor y cambiar el estado de cualquier orden. Si se omite `username` en el PATCH, no hay ninguna comprobación de propiedad; además, `cancelled/refunded` repone stock.
- **Impacto:** fraude, manipulación de inventario, fuga de datos de compradores y órdenes.
- **Remediación:** `requireAuth` + ownership; el comprador solo crea sus órdenes; el proveedor solo modifica las suyas; validar transiciones; auditar.

### P0-07 — Productos y multimedia sin auth

- **Dónde:** `server/routes/index.ts:1999` (POST), `:2038` (PATCH), `:2080` (DELETE), `:2094` (media POST), `:2148` (media DELETE).
- **Qué:** crear, editar y borrar productos, y añadir/borrar multimedia, sin sesión. El `username` del body identifica al proveedor; no se verifica que sea el autenticado.
- **Impacto:** cualquiera puede publicar productos falsos, cambiar precios/stock, borrar catálogo ajeno y subir contenido.
- **Remediación:** `requireAuth` + ownership; usar `req.user.id`; validar rol de proveedor; limitar y moderar multimedia.

### P0-08 — Estadísticas de administración públicas

- **Dónde:** `server/routes/index.ts:1909`.
- **Qué:** `GET /api/admin/stats` no tiene auth. En runtime devolvió `{"totalUsers":78,"totalProviders":45,"verifiedUsers":0,"lockedAccounts":0,"logs":[]}`.
- **Impacto:** enumeración de usuarios/proveedores, cuentas bloqueadas y nombres de usuarios con intentos fallidos.
- **Remediación:** `requireAuth` + rol admin; no devolver usernames en logs; agregar auditoría.

### P0-09 — CORS de producción permisivo + cookies + ausencia de CSRF

- **Dónde:** `api/index.ts:9` (`cors({ origin: true, credentials: true })`), `server/routes/index.ts:168` (`sameSite: "none"` en producción), `vercel.json:12`.
- **Qué:** Vercel reescribe `/api/*` a `api/index.ts`, que refleja cualquier `Origin` y permite credenciales. La cookie `token` es `HttpOnly`, `Secure` y `SameSite=None`, por lo que viaja en peticiones cross-site. No hay token CSRF.
- **Evidencia dev:** `OPTIONS /api/health` con `Origin: https://evil.example` devolvió `ACAO=https://evil.example`, `ACAC=true`, `ACAM=GET,HEAD,PUT,PATCH,POST,DELETE`; GET también refleja el origen.
- **Impacto:** cualquier sitio puede leer respuestas autenticadas y ejecutar acciones en nombre del usuario (CSRF) si obtiene que la víctima visite la página.
- **Remediación:** allowlist explícita de orígenes en `api/index.ts`; `credentials` solo para orígenes permitidos; `SameSite=Lax` o CSRF tokens; validar `Origin` en mutaciones; no confiar en el whitelist de `server/app.ts` porque Vercel no lo usa.

### P0-10 — Secretos reales y fallbacks de JWT/sesión

- **Dónde:** `vianova.env.txt`, `.gitignore`, `server/routes/index.ts:166` (`JWT_SECRET` fallback), `server/app.ts:75` y `api/index.ts:19` (`SESSION_SECRET` fallback).
- **Qué:** `vianova.env.txt` contiene credenciales reales de Neon, Cloudinary, Google OAuth, SMTP y GROQ. No está ignorado (`.gitignore` solo excluye `.env`). Si falta `JWT_SECRET`, se usa `via_nova_jwt_secret_key_2026`; si falta `SESSION_SECRET`, `via_nova_secret_key_2026`.
- **Impacto:** acceso directo a la base de datos/servicios, y falsificación de JWT si el fallback está activo en producción.
- **Remediación:** rotar todas las credenciales; eliminar `vianova.env.txt` del repo y del historial; usar gestor de secretos; fallar al arrancar si faltan `JWT_SECRET`/`SESSION_SECRET`; no usar fallbacks.

### P0-11 — Logs con cuerpos de respuesta que incluyen tokens

- **Dónde:** `server/app.ts:87-111`.
- **Qué:** el logger captura `res.json` y escribe el cuerpo completo en logs para toda ruta `/api`. Login/registro devuelven `token`; también se registran usuarios, métodos de pago y otros datos.
- **Impacto:** cualquiera con acceso a logs obtiene JWT válidos y datos personales/financieros.
- **Remediación:** no loguear cuerpos; si se necesita, redactar `token`, `password`, `verificationToken`, `details` y PII; usar logging estructurado con niveles.

### P0-12 — Google OAuth: sin `state`, token en URL y redirect dependiente del Host

- **Dónde:** `server/routes/index.ts:762-831`; `getBaseUrl` en `:202`.
- **Qué:** el flujo no usa `state` (login CSRF), el JWT se envía en `?token=` al frontend (queda en historial/referrer/logs) y el `redirect_uri` se construye con `x-forwarded-host`/`Host`. `/api/auth/google/mobile` valida el ID token con `tokeninfo` pero no comprueba `aud` ni `email_verified`.
- **Impacto:** login CSRF, robo de sesión por fuga de URL, redirección a dominio controlado por el atacante y aceptación de tokens de otros clientes Google.
- **Remediación:** `state` firmado y de un solo uso; no poner el token en la URL (usar cookie HttpOnly o código de un solo uso); redirect URI fijo por entorno; validar `aud`, `iss` y `email_verified`; usar la librería oficial de verificación.

### P0-13 — Reservas: falta de ownership, unidades negativas y PSE siempre exitoso

- **Dónde:** `server/routes/bookings.routes.ts:54` (`lock`), `:96` (`confirm`).
- **Qué:** `lock` acepta `units` sin validar entero positivo (valores negativos reducen `booked` y generan precios negativos), no usa transacción atómica y no libera locks expirados. `confirm` no verifica que la reserva pertenezca al usuario autenticado y simula PSE siempre exitoso.
- **Impacto:** sobreventa, manipulación de inventario/precio, confirmación de reservas ajenas y falsa sensación de pago.
- **Remediación:** validar `units` entero > 0; transacción/`SELECT ... FOR UPDATE`; job de expiración; `confirm` con ownership y pasarela real o estado explícito de “pago pendiente”.

### P0-14 — Chat e historial de chat sin autenticación

- **Dónde:** `server/routes/index.ts:1158` (`GET /api/chat/history?username=`), `:1183` (`POST /api/chat`).
- **Qué:** cualquier visitante puede leer el historial de chat de cualquier username y enviar mensajes suplantándolo. El endpoint crea usuarios “anon” con contraseña temporal si no existen.
- **Impacto:** fuga de conversaciones (posiblemente con ubicación/datos personales), suplantación y contaminación de historiales.
- **Remediación:** `requireAuth`; usar `req.user`; no aceptar `username`/`userId` del body; rate limit por usuario; no crear usuarios desde el chat.

---

## 4. Hallazgos altos (P1)

### P1-01 — Servicios y comentarios sin auth

- **Dónde:** `server/routes/index.ts:887` (POST), `:919` (PATCH), `:931` (DELETE), `:943` (POST comments), `:966` (DELETE comments).
- **Qué:** CRUD de servicios y comentarios sin sesión. `PATCH` confía en `providerUsername` del body; `DELETE` de comentario confía en `username` del body.
- **Impacto:** cualquiera puede crear/editar/borrar servicios y comentarios; spam y manipulación de reputación.
- **Remediación:** auth + ownership; moderación; no confiar en usernames del body.

### P1-02 — Upload sin auth y validación débil

- **Dónde:** `server/routes/index.ts:851`.
- **Qué:** `/api/upload` no requiere auth; `category` y `userId` del body controlan la carpeta de Cloudinary; `application/octet-stream` y la extensión permiten saltarse el filtro MIME; el límite global es 50 MB y luego se valida 10/50/25 MB.
- **Impacto:** abuso de almacenamiento/Cloudinary, contenido malicioso y carpetas arbitrarias.
- **Remediación:** auth; usar `req.user.id`; validar MIME real (magic bytes), extensión y tamaño antes de subir; limitar por usuario; moderar.

### P1-03 — Notificaciones sin auth

- **Dónde:** `server/routes/index.ts:1571` (GET), `:1582` (mark read).
- **Qué:** `GET /api/notifications?username=` devuelve notificaciones de cualquier usuario; `PATCH /:id/read` marca cualquiera como leída.
- **Impacto:** fuga de solicitudes de reserva, nombres/emails de viajeros y datos de contacto.
- **Remediación:** `requireAuth` + ownership; no aceptar username por query.

### P1-04 — Reseñas falsas sin auth

- **Dónde:** `server/routes/index.ts:1781`.
- **Qué:** `POST /api/reviews` acepta `authorUsername`, `targetUsername`, `rating` y `authorRole` del body, sin auth.
- **Impacto:** manipulación de reputación y reseñas falsas.
- **Remediación:** auth; usar `req.user.username`; verificar que el viaje pertenece al autor; limitar una reseña por viaje.

### P1-05 — Perfil de usuario editable sin auth

- **Dónde:** `server/routes/index.ts:1873`.
- **Qué:** `PATCH /api/user/profile` acepta `username` del body y actualiza nombre, bio y avatar de cualquier usuario.
- **Impacto:** suplantación visual, vandalismo y phishing.
- **Remediación:** auth + ownership; sanear avatar URL; auditar.

### P1-06 — Enumeración de cuentas y falta de rate limit en auth

- **Dónde:** `server/routes/index.ts:609` (`forgot-password` devuelve 404 si no existe), `:355` (`verify-email` 404), `:465` (`verify-2fa` sin limiter), `:646`/`:666` (reset sin limiter).
- **Qué:** los mensajes/status permiten saber si un email/username existe. `verify-2fa` acepta códigos de 6 dígitos sin rate limit; reset usa token de 8 hex (32 bits) sin rate limit.
- **Impacto:** enumeración, fuerza bruta de 2FA/reset y bloqueo de cuentas.
- **Remediación:** respuestas genéricas; rate limit por IP+cuenta; tokens más largos y con hash; alertas.

### P1-07 — PII de taxistas y viajes pública

- **Dónde:** `server/routes/taxi.routes.ts:343`, `:356`, `:373`; `:221`/`:288`/`:305` para viajes.
- **Qué:** `nearby` devuelve teléfono, placa y lat/lng; el perfil devuelve teléfono; earnings es público; el detalle e historial de viajes exponen usuarios y direcciones.
- **Impacto:** acoso, doxxing y fuga de datos de ubicación.
- **Remediación:** auth + minimización; teléfono solo tras aceptar viaje; ocultar coordenadas exactas; ownership en historial.

### P1-08 — Autenticación rota en APK/Capacitor

- **Dónde:** `client/src/lib/auth.ts:72-153`, `client/src/main.tsx:24`, `client/src/pages/ProductStore.tsx:94-118`, `client/src/pages/SocialFeed.tsx:92`, `client/src/pages/Login.tsx:135`, `capacitor.config.ts:8`.
- **Qué:** el login guarda `user` pero no `auth_token`; el parche global busca `auth_token` y no lo encuentra. Muchas llamadas no usan `credentials: "include"`; en Capacitor el API es cross-origin. `loginDirect` de Google mobile no persiste token. `CapacitorHttp` está habilitado y puede cambiar el manejo de cookies.
- **Impacto:** tras login en APK, muchas llamadas quedan sin sesión (401) o dependen de cookies de terceros; el flujo Google mobile no autentica.
- **Remediación:** guardar el token de forma segura (Capacitor Preferences/Keychain) o usar cookies con `credentials` en todas las llamadas; probar en dispositivo; unificar el cliente HTTP.

### P1-09 — Service worker inválido y PWA rota

- **Dónde:** `client/public/sw.js:1`.
- **Qué:** contiene sintaxis TypeScript (`event: any`, `self as any`), no JavaScript válido. `node --check` falla con `SyntaxError: Unexpected token ':'`. Además referencia `/icon-192x192.png`, que no existe.
- **Impacto:** el service worker no se registra; notificaciones push/PWA no funcionan.
- **Remediación:** reescribir en JS válido, añadir iconos y probar registro; o eliminar el SW si no se usa.

### P1-10 — Home en blanco para usuarios no autenticados

- **Dónde:** `client/src/pages/Home.tsx:295`.
- **Qué:** `if (!isAuthenticated) return null;` antes de renderizar. La ruta `/` es la landing, pero un visitante sin sesión ve una página vacía.
- **Impacto:** no hay embudo público; SEO/acceso inicial roto.
- **Remediación:** renderizar landing pública y pedir login solo en acciones protegidas.

### P1-11 — Dependencias vulnerables y peer incompatible

- **Evidencia:** `npm audit --omit=dev` reportó **14 vulnerabilidades: 2 críticas, 8 altas y 4 moderadas**.
  - Críticas: `@capacitor/android@8.3.4` (GHSA-rvm3-566m-v7fv, CVSS 9.3; fix 8.5.3), `proxy-addr`.
  - Altas: `engine.io`, `engine.io-client`, `ip-address`, `multer`, `nodemailer`, `socket.io-adapter`, `socket.io-parser`, `ws`.
  - Moderadas: `body-parser`, `qs`, entre otras.
- **Peer:** `@codetrix-studio/capacitor-google-auth@3.4.0-rc.4` declara `@capacitor/core ^6.0.0`; el proyecto usa `8.3.4`.
- **Impacto:** RCE/DoS/SSRF/header injection según el paquete; el plugin de Google puede fallar en runtime.
- **Remediación:** actualizar Capacitor a 8.5.3+, multer, nodemailer, ws, proxy-addr; eliminar `socket.io` si no se usa; sustituir el plugin de Google por uno compatible con Capacitor 8.

### P1-12 — Build no verificable y ausencia de CI/tests

- **Evidencia:** `npm run build` con 768 MB y `npx vite build` con 1024 MB terminaron en OOM (`exit 134`); RAM libre ~993 MB.
- **Qué:** no hay tests, lint, CI ni E2E. El build copia `client/public/dummy_assets.bin` (~55 MB) y usa Vite + esbuild.
- **Impacto:** no se puede garantizar que el artefacto de producción compile o funcione; regresiones no detectadas.
- **Remediación:** CI con typecheck/build/test; reducir memoria (code splitting, excluir assets); eliminar dummy assets; presupuesto de rendimiento.

### P1-13 — CSP ausente/débil en producción

- **Dónde:** `api/index.ts:10-18` no define CSP ni `Permissions-Policy`; `server/app.ts:53-68` define CSP con `'unsafe-inline'`, `'unsafe-eval'` y `https:` amplio.
- **Impacto:** mayor superficie de XSS; el CSP de `server/app.ts` no se aplica en Vercel.
- **Remediación:** añadir CSP estricta en `api/index.ts` o en el edge; evitar `unsafe-inline/eval`; nonces/hashes; `Permissions-Policy`.

### P1-14 — Rate limiting en memoria e IP spoofing

- **Dónde:** `server/rate-limit-store.ts`, `api/index.ts:8` (`trust proxy true`).
- **Qué:** el store es un `Map` por instancia; en Vercel cada instancia tiene su propio contador. `trust proxy true` permite falsificar `X-Forwarded-For`; `proxy-addr` tiene una vulnerabilidad crítica de spoofing.
- **Impacto:** los límites de login/upload/chat se saltan fácilmente; los ataques de fuerza bruta no se frenan.
- **Remediación:** store distribuido (Redis/Upstash); `trust proxy` acotado al proxy real; validar IP; actualizar `proxy-addr`.

### P1-15 — Spam y HTML injection en solicitudes de reserva

- **Dónde:** `server/routes/index.ts:1510`.
- **Qué:** `POST /api/bookings/request` no tiene auth; envía email a cualquier `providerUsername` con `travelerName` y `details` sin escapar. No hay rate limit.
- **Impacto:** spam/phishing a proveedores, inyección de HTML en correos y posible header injection (agravado por vulnerabilidades de nodemailer).
- **Remediación:** auth/rate limit; escapar HTML; validar destinatario; usar plantillas seguras; actualizar nodemailer.

### P1-16 — Detección de cuentas Google en reset rota

- **Dónde:** `server/routes/index.ts:621-626`.
- **Qué:** el código considera “local” cualquier password que empiece por `$2a$`/`$2b$`; las cuentas Google también se crean con `hashPassword` (bcrypt), por lo que el bloqueo “usa Google” nunca se activa.
- **Impacto:** cuentas Google pueden establecer contraseña local y saltarse la política; también afecta el borrado de cuenta, que exige una contraseña que el usuario Google no conoce.
- **Remediación:** marcar el proveedor de auth en la DB (`auth_provider`) y basar la lógica en eso, no en el formato del hash.

### P1-17 — Token de reset en URL y token corto

- **Dónde:** `server/routes/index.ts:629`, `:697`, `client/src/pages/Login.tsx:68`.
- **Qué:** el reset token es de 8 hex (32 bits) y viaja en `?reset_token=`; puede quedar en historial/referrer/logs.
- **Impacto:** fuerza bruta y fuga de token.
- **Remediación:** token de 128+ bits, hash en DB, un solo uso, URL con fragmento o POST, expiración corta y rate limit.

---

## 5. Hallazgos medios (P2)

### P2-01 — Filtro de precio de Home oculta todos los servicios

- **Dónde:** `client/src/pages/Home.tsx:231` y `:278`.
- **Qué:** los servicios se mapean con `priceRange: undefined`; si el usuario elige cualquier filtro de precio distinto de “any”, `if (!l.priceRange) return false` elimina todos los servicios.
- **Impacto:** el filtro de precio no funciona para el catálogo real.
- **Remediación:** mapear `price`/`priceRange` desde la API o eliminar el filtro hasta tener el dato.

### P2-02 — Proxy de Vite apunta a 5055 y el servidor por defecto a 5000

- **Dónde:** `vite.config.ts:48` (`target: http://localhost:5055`), `server/index.ts:22` (`PORT || 5000`).
- **Impacto:** `npm run dev` + `npm run dev:client` sin `PORT=5055` deja el API proxy roto.
- **Remediación:** unificar el puerto o usar variable de entorno compartida.

### P2-03 — Caché de React Query infinita

- **Dónde:** `client/src/lib/queryClient.ts:65`.
- **Qué:** `staleTime: Infinity` y `refetchOnWindowFocus: false` globales.
- **Impacto:** datos obsoletos en dashboards, productos, notificaciones y social.
- **Remediación:** `staleTime` corto por recurso; invalidar tras mutaciones.

### P2-04 — `getBaseUrl` confía en cabeceras del cliente

- **Dónde:** `server/routes/index.ts:202`.
- **Qué:** usa `x-forwarded-proto`/`x-forwarded-host` para construir URLs de OAuth y emails.
- **Impacto:** host header injection, redirecciones a dominios atacantes y enlaces de reset maliciosos.
- **Remediación:** URL base fija por entorno; validar contra allowlist.

### P2-05 — SSRF indirecto en resolución de Maps

- **Dónde:** `server/routes/index.ts:1594`.
- **Qué:** permite hosts de Google, pero `fetch` sigue redirects; un enlace `goo.gl` puede redirigir a una URL interna. El endpoint devuelve la URL final, no el cuerpo (SSRF ciego).
- **Impacto:** sondeo de red interna y evasión de allowlist.
- **Remediación:** no seguir redirects automáticamente; validar cada salto; bloquear IP privadas/link-local; timeout.

### P2-06 — TTS sin auth ni rate limit

- **Dónde:** `api/tts.py:14-54`.
- **Qué:** CORS `*`, sin auth/rate limit; `voice` es arbitrario; texto truncado a 1500.
- **Impacto:** abuso de cuota/servicio y posible uso para spam de audio.
- **Remediación:** auth/rate limit, voces allowlist, límites por IP/usuario.

### P2-07 — Android `allowBackup="true"`

- **Dónde:** `android/app/src/main/AndroidManifest.xml:4`.
- **Impacto:** backups locales pueden incluir datos de la app; riesgo en dispositivos comprometidos.
- **Remediación:** `allowBackup="false"` o backup rules que excluyan secretos/tokens.

### P2-08 — Logout no revoca JWT

- **Dónde:** `server/routes/index.ts:459`; `generateToken` en `:175`.
- **Qué:** el logout solo borra la cookie; el JWT sigue válido 7 días si fue copiado.
- **Impacto:** sesiones robadas persisten.
- **Remediación:** lista de revocación/`jti`, rotación, expiración corta + refresh token.

### P2-09 — Registro sin política de contraseña

- **Dónde:** `server/routes/index.ts:298`.
- **Qué:** no valida longitud/complejidad; solo `reset-password` exige 6 caracteres.
- **Impacto:** contraseñas débiles.
- **Remediación:** mínimo 8-12, blocklist, medidor de fuerza; no romper compatibilidad sin aviso.

### P2-10 — Endpoint de ubicación no-op y sin auth

- **Dónde:** `server/routes/index.ts:839`.
- **Qué:** `POST /api/users/:id/location` no actualiza nada y no requiere auth.
- **Impacto:** funcionalidad falsa; posible confusión.
- **Remediación:** implementar con auth/ownership o eliminar.

### P2-11 — Enumeración de roles/perfiles públicos

- **Dónde:** `server/routes/index.ts:1640`, `:1897`.
- **Qué:** roles y perfil público permiten enumerar usuarios y roles.
- **Impacto:** reconocimiento para ataques dirigidos.
- **Remediación:** limitar campos, rate limit, auth opcional; no exponer roles internos.

### P2-12 — Rutas sociales inline muertas y feed público

- **Dónde:** `server/routes/index.ts:2397-2626`; `server/routes/social.routes.ts:84`.
- **Qué:** `app.use("/api/social", socialRouter)` se registra antes; las rutas inline de escritura quedan sombreadas. Solo `GET /api/social/feed` y `GET /api/social/posts/user/:username` quedan alcanzables. El feed es público (probablemente intencional).
- **Impacto:** deuda/confusión; riesgo de que futuras rutas inline se comporten distinto al router.
- **Remediación:** eliminar duplicados; una sola fuente de rutas; documentar alcance público.

### P2-13 — Asset dummy de 55 MB

- **Dónde:** `client/public/dummy_assets.bin` (57,671,680 bytes).
- **Impacto:** build/deploy lento, consumo de memoria/espacio, posible exposición innecesaria.
- **Remediación:** eliminar o mover fuera de `public`.

### P2-14 — Sin monitoreo de errores/observabilidad

- **Qué:** no hay Sentry/OpenTelemetry/alertas; los errores solo van a consola.
- **Impacto:** incidentes de seguridad/errores no detectados.
- **Remediación:** logging estructurado sin PII, métricas, alertas, trazas.

### P2-15 — Stripe checkout sin auth y fallback dummy

- **Dónde:** `server/routes/index.ts:2296`.
- **Qué:** `POST /api/stripe/create-checkout-session` no exige auth; sin `STRIPE_SECRET_KEY` devuelve una URL dummy; no reserva stock; el webhook crea la orden sin reserva atómica.
- **Impacto:** checkout para compradores arbitrarios, órdenes sin pago y sobreventa.
- **Remediación:** auth, validar comprador, reservar stock, idempotencia, webhook como única fuente de verdad.

### P2-16 — Locks de reserva expirados no se liberan

- **Dónde:** `server/routes/bookings.routes.ts:78`.
- **Qué:** `lockedUntil` se guarda, pero no hay job que libere `booked` al expirar.
- **Impacto:** inventario bloqueado permanentemente.
- **Remediación:** job/cron o consulta que ignore/libere expirados; transacción.

---

## 6. Estado por módulo

| Módulo | Estado | Comentario |
|---|---|---|
| Autenticación básica | Parcial | bcrypt 12, lockout 5/15 min, error genérico, términos; pero enumeración, 2FA leak, sin rate limit en verify/reset, token no persistido en APK. |
| Autorización/RBAC | Mal | Muchos endpoints sin `requireAuth`; ownership inexistente; admin solo en cliente. |
| Pagos/órdenes | Mal | Órdenes y métodos de pago sin auth; PSE simulado; Stripe parcial. |
| Taxi | Mal | Fraude de viajes/retiros; PII pública. |
| Marketplace/productos | Mal | CRUD y media sin auth; upload sin auth. |
| Social | Parcial/Bien | Router social exige auth en escrituras, bloqueos/reportes/mensajes; feed y perfiles públicos; rutas inline duplicadas. |
| Chatbot | Parcial | `/api/bookings/request` ya existe y Chatbot coincide; pero chat/historial sin auth. |
| Analítica | Parcial/Bien | `/api/analytics/dashboard` requiere auth y valida ownership/rol; `/api/admin/stats` abierto. |
| Upload/media | Parcial | Allowlist MIME/extensión y límites por tipo; sin auth, carpeta controlada por usuario, `octet-stream` laxo. |
| PWA/APK | Mal | `sw.js` inválido; auth cross-origin incompleta; `CapacitorHttp`; allowBackup. |
| Despliegue Vercel | Mal | CORS permisivo, CSP ausente, whitelist de `server/app.ts` no usada. |
| Tests/CI | Mal | No hay tests, lint, CI ni E2E. |
| Build | Bloqueado | Typecheck pasa; build OOM en el entorno. |

---

## 7. Lo que está bien

- `GET /api/health` funciona y no expone datos.
- Login con bcrypt (12 rounds), bloqueo tras 5 intentos, error genérico y reset de contadores.
- Registro exige aceptación de términos y crea rol inicial; `sanitizeUser` al menos elimina `password` (aunque no otros secretos).
- `requireAuth` protege `/api/auth/me`, `/api/analytics/dashboard`, `/api/bookings/lock`, 2FA toggle y borrado de cuenta.
- `/api/analytics/dashboard` valida ownership y evita que un no-admin use el scope admin.
- Router social: escrituras, likes, comentarios, follows, blocks, reports y mensajes requieren auth; el perfil público oculta email.
- Webhook de Stripe valida firma; creación de orden usa actualización atómica de stock en `/api/orders`.
- Multer tiene allowlist MIME/extensión y límites por tipo; hay rate limits (aunque en memoria).
- `server/app.ts` incluye CSP, XFO, XCTO, Referrer-Policy, Permissions-Policy y HSTS en producción (no aplicado en Vercel).
- Typecheck pasa con heap 768 MB; la UI cubre muchos flujos.

---

## 8. Lo que falta

- Middleware global de autenticación y política “deny by default”.
- RBAC y ownership en todos los recursos.
- CSRF y validación de `Origin` en mutaciones.
- Gestión de secretos y rotación; eliminar fallbacks.
- Guard server-side para admin.
- Validación estricta de entrada (unidades, contraseñas, usernames, emails, URLs).
- Rate limiting distribuido en auth/2FA/reset/chat/upload.
- Logging sin cuerpos sensibles.
- Tests, lint, CI, E2E y pruebas en APK.
- Build reproducible y verificado.
- Monitoreo/alertas y plan de respuesta a incidentes.

---

## 9. Plan de remediación recomendado

### P0 — 0 a 72 horas

1. Bloquear/eliminar endpoints destructivos y exigir admin.
2. Corregir `sanitizeUser` y eliminar `POST /api/users` legacy; rate limit en `verify-2fa`.
3. Añadir `requireAuth` + ownership a roles, perfil, vehículo, pagos, taxi, órdenes, productos, servicios, comentarios, notificaciones, reseñas, upload y chat.
4. Corregir CORS en `api/index.ts` con allowlist; `SameSite=Lax` o CSRF; añadir CSP/Permissions-Policy.
5. Rotar credenciales; eliminar `vianova.env.txt`; fallar si faltan `JWT_SECRET`/`SESSION_SECRET`.
6. Eliminar logging de cuerpos o redactar tokens/PII.
7. Corregir Google OAuth (`state`, token fuera de URL, redirect fijo, `aud`/`email_verified`).
8. Corregir reservas (ownership, unidades positivas, transacción, expiración) y flujo de pago.
9. Asegurar taxi: auth, ledger, retiros con revisión, PII mínima.

### P1 — 1 a 2 semanas

- Tests de autorización por endpoint; CI con typecheck/build/test.
- Actualizar dependencias críticas/altas; eliminar `socket.io` si no se usa.
- Arreglar `sw.js`, iconos y PWA; unificar auth APK.
- Landing pública y filtro de precio.
- Rate limiting distribuido y `trust proxy` acotado.
- Admin dashboard con guard server-side.

### P2 — 2 a 6 semanas

- Observabilidad, WAF, backups, rotación periódica.
- Revisión de accesibilidad/rendimiento y presupuesto de bundle.
- Pentest externo antes de lanzamiento.

---

## 10. Evidencia técnica

### Typecheck

```text
$env:NODE_OPTIONS='--max-old-space-size=768 --max-semi-space-size=32'
npx tsc --noEmit --pretty false
TSC_EXIT=0
```

### Service worker

```text
node --check client/public/sw.js
SyntaxError: Unexpected token ':'
SW_EXIT=1
```

### Dependencias

```text
npm audit --omit=dev
2 critical, 8 high, 4 moderate, 14 total
```

### Runtime no destructivo (puerto 5055)

- `GET /api/health` → `200 {"ok":true}`.
- `GET /api/auth/me` → `401`.
- `GET /api/admin/stats` → `200 {"totalUsers":78,"totalProviders":45,"verifiedUsers":0,"lockedAccounts":0,"logs":[]}` sin auth.
- `GET /api/payment-methods/usuario_inexistente` → `200 {"methods":[]}` sin auth.
- `GET /api/taxi/earnings/usuario_inexistente` → `200` con ceros sin auth.
- `GET /api/reviews/usuario_inexistente` → `200` vacío sin auth.
- `GET /api/products?limit=1` → `200` vacío.
- `GET /api/rides/nearby` → `200 {"rides":[]}`.
- `POST /api/bookings/request {}` → `400` (no `401`; confirma que no exige auth).
- `POST /api/bookings/lock` → `401` (bien).
- `GET /api/analytics/dashboard?username=test&role=traveler` → `401` (bien).
- `POST /api/auth/forgot-password` con email inexistente → `404` (enumeración).
- `POST /api/auth/login` con usuario inexistente → `401` genérico.
- `POST /api/auth/google/mobile` inválido → `401`.

### CORS dev

```text
OPTIONS /api/health
Origin: https://evil.example
→ 204
Access-Control-Allow-Origin: https://evil.example
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE
```

### Snapshot

- `server/routes/index.ts`: 122881 bytes, 2633 líneas raw / 2336 no vacías, SHA256 `EA47C51F3671B448B3CB4BDBE1172B3319C54B8F783B192F2B5E04E310785D55`, última escritura 17:30:38.
- `client/src/pages/Home.tsx`: última escritura 17:37:57.
- `.env` temporal y logs de prueba eliminados; puerto 5055 sin proceso `Listen` al cierre.

---

## 11. Archivos clave revisados

- `server/routes/index.ts`
- `server/routes/bookings.routes.ts`
- `server/routes/taxi.routes.ts`
- `server/routes/social.routes.ts`
- `server/storage.ts`
- `server/taxi.storage.ts`
- `server/analytics.ts`
- `server/mailer.ts`
- `server/app.ts`
- `server/index.ts`
- `server/static.ts`
- `server/rate-limit-store.ts`
- `api/index.ts`
- `api/tts.py`
- `shared/schema.ts`
- `shared/taxi.schema.ts`
- `client/src/App.tsx`
- `client/src/main.tsx`
- `client/src/lib/auth.ts`
- `client/src/lib/queryClient.ts`
- `client/src/pages/Login.tsx`
- `client/src/pages/Home.tsx`
- `client/src/pages/Nuke.tsx`
- `client/src/pages/ProductStore.tsx`
- `client/src/pages/ProductManager.tsx`
- `client/src/pages/MyProducts.tsx`
- `client/src/pages/SocialFeed.tsx`
- `client/src/pages/AdminDashboard.tsx`
- `client/src/pages/Dashboard.tsx`
- `client/src/pages/UserProfile.tsx`
- `client/src/pages/Messages.tsx`
- `client/src/pages/taxi/*`
- `client/public/sw.js`
- `client/public/dummy_assets.bin`
- `vite.config.ts`
- `script/build.ts`
- `vercel.json`
- `capacitor.config.ts`
- `android/app/src/main/AndroidManifest.xml`
- `android/app/build.gradle`
- `vianova.env.txt`
- `package.json`
- `cambios_hoy.txt`

---

## 12. Conclusión

ViaNovaIA es un prototipo funcionalmente ambicioso, con buena cobertura de producto y varias medidas de seguridad ya implementadas. Sin embargo, la autorización es inconsistente y hay cadenas de ataque directas que permiten **tomar cuentas, modificar roles, leer datos financieros y retirar dinero sin autenticación**. El CORS de producción y la gestión de secretos agravan el riesgo.

La recomendación es **no desplegar a producción** hasta completar el bloque P0, añadir pruebas de autorización por endpoint y verificar el build en un entorno con memoria suficiente. Después de esas correcciones, el bloque P1 permitirá endurecer la plataforma y preparar una revisión externa.
