# Auditoría de seguridad — ViaNova (local)

- **Fecha:** 2026-10-31
- **Objetivo:** `http://127.0.0.1:5055` (instancia local de desarrollo)
- **Producción de referencia:** build `dist/` servido en `http://127.0.0.1:5056`
- **Alcance:** API Express, autenticación/sesión, autorización por rol y por recurso, subida de archivos, integraciones (Google Maps, Stripe, Cloudinary), cabeceras HTTP, exposición de archivos estáticos y dependencias de producción.
- **Autorización:** objetivo local pre-autorizado (`127.0.0.1`) conforme a la política del kit de pentest. No se atacaron sistemas de terceros.
- **Estado:** **cerrada — 0 hallazgos abiertos**. 98 comprobaciones de ataque (60 + 38) y 19 comprobaciones de producción en verde.

---

## 1. Resumen ejecutivo

Se ejecutaron dos pasadas de ataque automatizado contra la instancia local, además de una verificación específica del build de producción. Todas las pruebas terminaron en verde tras corregir los hallazgos encontrados:

| Pasada | Comprobaciones | Resultado |
|---|---:|---|
| Ataque 1 — autenticación, autorización, IDOR, inyección, SSRF, uploads | 60 | 60/60 seguras |
| Ataque 2 — notificaciones, roles obsoletos, reset de contraseña, rate limits, traversal, Stripe, XSS almacenado | 38 | 38/38 seguras |
| Verificación de producción (`NODE_ENV=production`, puerto 5056) | 19 | 19/19 correctas |

No quedan vulnerabilidades explotables conocidas en el alcance probado. Las 8 alertas moderadas de `npm audit` corresponden a una cadena transitiva de `exceljs` sin corrección compatible; se documentan como riesgo aceptado y el CI bloquea a partir de severidad alta.

---

## 2. Metodología

1. **Reconocimiento:** rutas de la API, modelos de rol (`traveler`, `provider`, `hotel`, `admin`), flujos de sesión web (cookie HttpOnly) y nativo (Bearer), endpoints públicos y autenticados.
2. **Pruebas de ataque:** scripts Node contra la API real con tres cuentas desechables (`audit_a_*`, `audit_v_*`, `audit_c_*`), creando fixtures reales (posts, mensajes, métodos de pago, roles) y comprobando el estado en base de datos.
3. **Corrección:** cada hallazgo se corrigió en código con prueba de regresión en `tests/security.test.ts`.
4. **Re-ataque:** se repitieron ambas pasadas completas tras cada bloque de correcciones.
5. **Verificación de producción:** build real, servidor en modo producción y sondas de exposición de archivos, CSP, HSTS y cabeceras.

Herramientas: Node.js, `fetch`, `pg`, comprobaciones HTTP directas y la suite `node:test`. Se revisó además el código con búsquedas dirigidas (`grep`/ripgrep) de sinks peligrosos (`innerHTML`, `dangerouslySetInnerHTML`, SQL crudo, redirecciones, `eval`).

---

## 3. Hallazgos y correcciones

### VN-01 — IDOR en notificaciones (Alta) — corregido

- **Descripción:** cualquier usuario autenticado podía listar notificaciones de otro usuario y marcar como leídas notificaciones ajenas conociendo su ID.
- **Evidencia:** el atacante veía la notificación generada por un mensaje dirigido a la víctima y podía invocar `PATCH /api/notifications/:id/read`.
- **Corrección:** `provider_username` es siempre el destinatario y `traveler_username` el actor. Las consultas de listado y marcado se filtran por el destinatario; solo el destinatario o un administrador pueden acceder. El marcado ajeno devuelve `404`.
- **Archivos:** `server/storage.ts`, `server/routes/index.ts`.
- **Regresión:** “unrelated user cannot list another user's notification”, “unrelated user cannot mark notification read”, “notification remains unread after attack”.

### VN-02 — Token de administrador degradado conservaba privilegios (Alta) — corregido

- **Descripción:** tras retirar el rol `admin` a una cuenta, su JWT seguía siendo aceptado con el rol antiguo hasta expirar.
- **Evidencia:** el token del admin degradado alcanzaba endpoints `requireRole("admin")`.
- **Corrección:** `resolveSessionUser` revalida en cada petición el usuario, su estado de borrado, su rol actual y la versión de contraseña contra la base de datos; el rol del token ya no es autoritativo. Los endpoints sensibles siguen comprobando rol y propiedad.
- **Archivos:** `server/security.ts`.
- **Regresión:** “demoted admin token cannot reach requireRole endpoints”.

### VN-03 — El reset de contraseña no revocaba sesiones existentes (Alta) — corregido

- **Descripción:** tras un reset, los JWT emitidos antes seguían siendo válidos.
- **Corrección:** se añadió `users.password_changed_at`; `signToken` incluye el claim `pwd` y `resolveSessionUser` rechaza tokens anteriores al último cambio de contraseña. `updateUserPassword` actualiza la marca. La migración está incluida en `ensureUserSchema`.
- **Archivos:** `shared/schema.ts`, `server/analytics.ts`, `server/storage.ts`, `server/security.ts`.
- **Regresión:** “password reset revokes existing sessions”.

### VN-04 — Sin límite de login por IP (pulverización de usuarios) (Media) — corregido

- **Descripción:** existía límite por cuenta, pero no por IP, permitiendo probar muchas cuentas desde una sola dirección.
- **Corrección:** `loginIpLimiter` (50 intentos fallidos / 15 min por IP) aplicado a login web, login móvil con Google y flujo equivalente. Solo cuentan los fallos (`skipSuccessfulRequests`), por lo que un usuario legítimo no se ve afectado.
- **Archivos:** `server/rate-limits.ts`, `server/routes/index.ts`.
- **Regresión:** “IP-wide login limiter stops username spraying”.

### VN-05 — Suplantación de `X-Forwarded-For` (Media) — corregido

- **Descripción:** confiar en `X-Forwarded-For` en local permitía reiniciar el contador de rate limit cambiando la cabecera.
- **Corrección:** `trust proxy` se desactiva fuera de producción; en producción se confía en un solo salto (el proxy real) salvo que `TRUST_PROXY` lo sobrescriba con un número. La IP usada por los limitadores ya no es controlable por el cliente.
- **Archivos:** `server/http-security.ts`, `server/rate-limits.ts`.
- **Regresión:** “X-Forwarded-For spoofing does not reset the IP limit”.

### VN-06 — HTML almacenado en contenido social y biografía (Media) — corregido

- **Descripción:** posts, comentarios, mensajes y biografía aceptaban etiquetas HTML. React las escapa al renderizar, pero almacenarlas permite XSS en cualquier consumidor futuro (exportaciones, correos, paneles) y dificulta la moderación.
- **Corrección:** `stripHtmlTags` elimina secuencias con forma de etiqueta antes de persistir; conserva texto normal como `5 < 10` o `<3`. Se aplica en `cleanText` de social y en la biografía del perfil.
- **Archivos:** `server/security.ts`, `server/routes/social.routes.ts`, `server/routes/index.ts`.
- **Regresión:** “stripHtmlTags neutraliza etiquetas sin romper texto normal”, “social post keeps payload inert”, “feed response is JSON”.

### VN-07 — Rechazo de uploads maliciosos devolvía 500 (Baja) — corregido

- **Descripción:** los rechazos del `fileFilter` de multer no llevaban estado HTTP y terminaban como error interno.
- **Corrección:** el filtro asigna `err.status = 415` y el manejador de errores respeta `err.status`. Los seis casos maliciosos (`.php`, `.html`, `.svg`, doble extensión, MIME falso, contenido no coincidente) devuelven `415` sin escribir archivo.
- **Archivos:** `server/routes/index.ts`, `server/app.ts`.
- **Regresión:** seis comprobaciones “upload rejects …”.

### VN-08 — Respuestas autenticadas potencialmente cacheables (Baja) — corregido

- **Descripción:** algunas respuestas con datos de sesión no declaraban política de caché.
- **Corrección:** `requireAuth` y `/api/auth/me` establecen `Cache-Control: no-store`; el login también lo hace.
- **Archivos:** `server/security.ts`, `server/routes/index.ts`.

### VN-09 — Sin límite específico en forgot-password por IP (Media) — corregido

- **Descripción:** el flujo de recuperación podía usarse para enumerar o abusar del envío de correos.
- **Corrección:** `forgotPasswordIpLimiter` (20/h por IP), respuesta genérica idéntica exista o no la cuenta y token nunca devuelto en la respuesta.
- **Archivos:** `server/rate-limits.ts`, `server/routes/index.ts`.
- **Regresión:** “forgot-password returns generic message”, “does not enumerate accounts”, “never returns the token”.

---

## 4. Controles verificados sin hallazgos

- **Sesión:** cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción; logout revoca el token; JWT con `alg:none`, payload manipulado, secreto incorrecto o expirado rechazado (`401`).
- **CSRF:** mutaciones con cookie bloqueadas sin `Origin`/`Referer` válidos (`403`); clientes nativos con Bearer permitidos.
- **Autorización:** IDOR bloqueado en estadísticas admin, analítica, exportaciones, pedidos de comprador/proveedor, métodos de pago y perfiles; roles autoservicio no pueden escalar a admin; el perfil ignora `role`, `isAdmin`, `id` y `username` ajenos; resistencia a prototype pollution.
- **Inyección:** SQLi en login, ruta de perfil, categoría de servicios y búsquedas manejada sin autenticación ni error 500; consultas parametrizadas.
- **SSRF:** `169.254.169.254`, `127.0.0.1`, `localhost`, `evil.local`, `file://`, `user@host`, puertos no estándar y dominios tipo `google.com.evil.local` rechazados por la validación de URLs de Google Maps.
- **Uploads:** extensión y contenido real verificados; SVG/HTML/PHP y dobles extensiones rechazados; solo imágenes válidas llegan a Cloudinary.
- **Cabeceras:** CSP, `X-Content-Type-Options: nosniff`, `frame-ancestors 'none'`, COOP, HSTS en producción, `X-Powered-By` oculto, CORS con allowlist y preflight correcto.
- **Exposición de archivos:** `.env`, variantes codificadas, `/server/index.ts`, `/package.json`, `/.git/config` y `/backup.zip` no filtran contenido; el fallback SPA devuelve `index.html` y la API desconocida devuelve JSON `404`.
- **Stripe:** webhook sin firma o con firma inválida rechazado; el secreto no está configurado en local y responde `503` sin efectos.
- **Rate limiting:** login por cuenta, login por IP, registro, chat y recuperación de contraseña se activan con `429`; el cuerpo JSON sobredimensionado devuelve `413`.
- **Host header:** no se refleja en redirecciones.

---

## 5. Verificación del build de producción

Servidor `NODE_ENV=production` en `http://127.0.0.1:5056`:

- CSP de producción: `script-src 'self' 'wasm-unsafe-eval'` (sin `unsafe-inline` ni `unsafe-eval`).
- HSTS: `max-age=31536000; includeSubDomains`.
- `nosniff`, `frame-ancestors 'none'`, COOP `same-origin`, `X-Powered-By` ausente.
- API desconocida: `404` JSON.
- Sin exposición de `.env`, código fuente, `package.json`, `.git` ni backups en ninguna variante probada.

---

## 6. Dependencias — riesgo aceptado

`npm audit --omit=dev` reporta **8 alertas moderadas** en la cadena:

```
exceljs@4.4.0 → archiver@5.3.2 → archiver-utils / readdir-glob / zip-stream
              → glob@7.2.3 → minimatch@3.1.5
```

- **Advisory:** GHSA-g3hv-75wg-m249 (DoS por amplificación de `globparts` en `minimatch`).
- **Alcance real:** la aplicación usa `exceljs` únicamente para **generar** exportaciones XLSX a partir de datos internos; no procesa patrones glob controlados por el usuario ni archivos de entrada no confiables a través de esta cadena.
- **Por qué no se corrige:** la única “corrección” propuesta por npm es `exceljs@4.1.1`, un downgrade incompatible que rompería la API de exportación usada por el proyecto. No existe versión parcheada compatible de `exceljs`/`archiver`.
- **Decisión:** riesgo aceptado y documentado. El CI ejecuta `npm audit --omit=dev --audit-level=high`, por lo que cualquier vulnerabilidad alta o crítica futura bloquea la build.

---

## 7. Recomendaciones residuales (no bloqueantes)

1. Configurar `TRUST_PROXY` con el número exacto de saltos del proxy de producción al desplegar detrás de un balanceador.
2. Mantener `STRIPE_WEBHOOK_SECRET` y `STRIPE_SECRET_KEY` fuera de repositorios y rotarlos si alguna vez se exponen.
3. Revisar periódicamente la cadena de `exceljs` y actualizar en cuanto publique una versión compatible con `archiver` parcheado.
4. Ejecutar esta misma batería contra staging con autorización explícita antes de cambios mayores de autenticación.

---

## 8. Reproducibilidad

Los scripts de ataque y las sesiones de auditoría se eliminaron del árbol de trabajo tras la verificación para no dejar credenciales ni herramientas ofensivas en el repositorio. La evidencia queda resumida en este informe y en las pruebas de regresión permanentes:

```bash
npm run check
npm test                 # 40/40, incluye regresiones de seguridad
npm run build
npm run start            # NODE_ENV=production
```

Las cuentas de auditoría eran desechables y se crearon exclusivamente para esta prueba; no se usaron cuentas reales.

---

## 9. Conclusión

Tras corregir y volver a atacar, la instancia local no presenta vulnerabilidades explotables conocidas dentro del alcance evaluado. Los controles de autenticación, autorización, sesión, subida de archivos, cabeceras y exposición de archivos se comportan según lo esperado, y el build de producción mantiene la misma postura. El único riesgo remanente es la cadena moderada de `exceljs`, aceptada por incompatibilidad de la corrección y no alcanzable con el uso actual.
