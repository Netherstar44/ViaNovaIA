# Plan de cierre de pendientes — VIANova IA

**Fecha:** 2026-11-01 UTC / 2026-10-31 hora local
**Rama de trabajo:** `revision-final`
**Merge actual:** `c7a8e2d` (`origin/main` `5caff48` fusionado)
**`main` local:** `5caff48`, al día con `origin/main`
**Push:** autorizado por el usuario; se publica con el push de esta rama.

---

## 1. Resumen ejecutivo

El merge con el push del compañero quedó limpio. No hay marcadores de conflicto. Antes de crear este documento la rama no tenía cambios sin commit; ahora solo queda este archivo nuevo sin commitear.

Pendientes reales después del merge:

| Prioridad | Pendiente | Estado actual | Se puede cerrar solo con código |
| --- | --- | --- | --- |
| P0 | Wompi real | Modo `sandbox_link`; webhook sin secreto responde 503 | No: faltan llaves y cuenta |
| P1 | Email como identidad pública | 26 usuarios, 38 servicios y 36 productos con `provider_username` tipo email | Sí, pero requiere migración y decisión de producto |
| P2 | Limpieza de datos QA | Inventario previo desactualizado; hay 1 servicio QA sin imagen | No sin confirmación escrita |
| P3 | Dependencias | 8 moderadas en `exceljs → archiver → glob → minimatch` | Parcial: documentar y esperar upstream |
| P4 | Redirecciones y guards por rol | Hay rutas duplicadas y destinos inconsistentes | Sí, con decisión de mapa de rutas |
| P5 | Performance | Perfil público ~3 s; borrado de cuenta ~4.3 s | Sí, medir y optimizar |
| P6 | Validación visual/dispositivos | WebGL/refracción ya se retiró; queda validar CSS real | No: es QA manual |

**Regla:** no ejecutar `npm audit fix --force`, no borrar datos QA, no cambiar `vercel.json` ni secretos sin aprobación explícita.

---

## 2. Estado verificado

### 2.1 Git

- `revision-final` limpio antes de este documento.
- Merge `c7a8e2d` con `origin/main` `5caff48`.
- Respaldo pre-merge: `backup/revision-final-pre-merge`.
- Sin marcadores reales `<<<<<<<` ni `>>>>>>>`.
- `main` local actualizado por fast-forward, sin push.

### 2.2 Calidad

| Comando | Resultado |
| --- | --- |
| `npm run check` | OK |
| `npm test` | 54/54 |
| `npm run build` | OK |
| `dist/public/llms-full.txt` | Generado |
| `npm audit --omit=dev --audit-level=high` | 0 altas; 8 moderadas aceptadas |

El build solo deja warnings de chunks mayores a 500 kB. No son errores.

### 2.3 Smoke test local

Servidor QA en `:5004`, luego detenido.

| Ruta | Resultado |
| --- | --- |
| `/` | 200 |
| `/api/auth/me` | 200 |
| `/api/products?limit=1` | 200 |
| `/api/social/posts?limit=1` | 200 |
| `/api/trips/latest` | 401 esperado |
| `/api/payments/config` | 401 esperado |
| `/login`, `/explore`, `/payments`, `/dashboard`, `/admin` | 200 |
| `/products`, `/my-products`, `/taxi-dashboard`, `/settings` | 200 |

No se probaron pagos reales, correos ni borrado de cuentas en este smoke.

---

## 3. P0 — Wompi real

### Problema

`getPaymentConfig()` devuelve actualmente:

```json
{
  "provider": "wompi",
  "mode": "sandbox_link",
  "hostedCheckout": true,
  "sandbox": true
}
```

Sin `WOMPI_PUBLIC_KEY` e `WOMPI_INTEGRITY_SECRET`, el servidor usa el enlace estático de sandbox. Sin `WOMPI_EVENTS_SECRET`, el webhook responde `503`.

### Ruta recomendada

1. **No tocar producción todavía.** Probar primero con llaves sandbox.
2. Configurar en el gestor de secretos del despliegue, nunca en el repositorio:
   - `WOMPI_PUBLIC_KEY=pub_test_...`
   - `WOMPI_INTEGRITY_SECRET=...`
   - `WOMPI_EVENTS_SECRET=...`
   - `PAYMENT_SANDBOX_MODE=true`
   - `WOMPI_CHECKOUT_URL` solo si se quiere reemplazar el enlace de prueba.
3. Verificar que `/api/payments/config` devuelva `mode: "sandbox"` y que la URL generada sea `https://checkout.wompi.co/p/` con firma, no el enlace estático.
4. Configurar el webhook en Wompi:
   - URL: `https://<dominio>/api/payments/wompi/webhook`
   - Evento de transacción actualizada.
5. Probar:
   - Firma válida → `200`.
   - Firma alterada → `401`.
   - Monto o moneda distintos → no marcar pagado.
   - Evento repetido → idempotente.
6. Solo después, cambiar a llaves de producción y `PAYMENT_SANDBOX_MODE=false`.

### Archivos

- `server/payments.ts`
- `server/routes/payments.routes.ts`
- `tests/payments.test.ts`
- Configuración del hosting, no versionada.

### Criterios de aceptación

- `mode` pasa de `sandbox_link` a `sandbox` y luego a `live`.
- El checkout firmado incluye referencia, monto, moneda y expiración.
- El webhook válido marca `paid`; el inválido no.
- No hay `503` por falta de secreto en el entorno correcto.
- Los secretos no aparecen en logs ni en el cliente.

### Riesgo

**Alto:** dinero real. Requiere cuenta Wompi, llaves y responsable de finanzas. No ejecutar sin aprobación.

---

## 4. P1 — Separar email de identidad pública

### Problema

El `username` se usa como identidad pública y como dato de login. Hay proveedores cuyo `username` es un email. Eso expone correo en URLs, API y catálogo.

Conteo read-only actual:

| Tabla | Filas con email en identidad pública |
| --- | ---: |
| `users.username` | 26 |
| `services.provider_username` | 38 |
| `products.provider_username` | 36 |

### Ruta recomendada

No renombrar `users.username` a ciegas: se rompe el login. Ruta segura:

1. **Decisión de producto:** definir si `username` seguirá siendo login y se añadirá `public_handle`, o si se migrará el login a email y `username` pasará a ser solo handle.
2. Opción recomendada:
   - Mantener `users.username` como identificador interno de login.
   - Añadir `users.public_handle` único y nullable al inicio.
   - Backfill con slug del nombre o de la parte local del email, más sufijo en colisiones.
   - Resolver `@handle` en lectura; no duplicar el valor en todas las tablas todavía.
3. Actualizar superficies públicas:
   - `server/catalog.ts`
   - `server/routes/index.ts`
   - `server/routes/social.routes.ts`
   - `client/src/pages/UserProfile.tsx`
   - enlaces `/u/:username`
4. Añadir alias para URLs antiguas con email: redirigir a `/u/<handle>` sin exponer el correo en el HTML.
5. Bloquear nuevos registros cuyo `username` sea un email.
6. Migración en dos pasos: primero lectura compatible, luego limpieza de datos.

### Criterios de aceptación

- Ningún endpoint público devuelve `email` de login.
- Las URLs públicas usan `@handle`.
- El login existente sigue funcionando.
- Los enlaces viejos redirigen sin filtrar el correo.
- Tests de catálogo, perfil público y autenticación en verde.

### Riesgo

**Alto:** toca autenticación, catálogo, servicios y productos. Requiere backup y decisión de producto. No hacer migración destructiva en un solo paso.

---

## 5. P2 — Limpieza de datos QA

### Estado actual

La cifra anterior de “24 cuentas QA” **no se reproduce** con los prefijos usados en esta revisión. Inventario read-only actual:

| Consulta | Resultado |
| --- | ---: |
| Usuarios `qarev%` o `qapay%` | 0 |
| Servicios QA sin imagen | 1 |
| Trips de esos usuarios | 0 |

Puede que parte de los datos ya se haya limpiado o que los prefijos hayan cambiado. No borrar por suposición.

### Ruta recomendada

1. Crear `scripts/cleanup-qa-data.mjs` con dos modos:
   - `--dry-run`: cuenta y lista IDs, sin borrar.
   - `--apply`: exige confirmación explícita y ejecuta en transacción.
2. Inventariar por IDs y dominios aprobados, no solo por prefijo:
   - usuarios QA,
   - servicios sin imagen,
   - trips en `draft`,
   - stops, mensajes, intents y roles asociados.
3. Exportar respaldo fuera del repositorio antes de borrar.
4. Orden de borrado:
   1. `trip_stops`
   2. `payment_intents`
   3. `trips`
   4. mensajes/conversaciones/notificaciones
   5. `user_roles`
   6. `users`
5. Verificar que no queden huérfanos.
6. Repetir smoke test y revisar catálogo.

### Criterios de aceptación

- Dry-run sin cambios.
- Backup verificable.
- Cero filas QA aprobadas.
- Cero errores de foreign key.
- Catálogo y perfil público funcionando.

### Riesgo

**Alto:** borrado de datos. Requiere confirmación escrita del usuario y backup. No ejecutar este documento por sí solo.

---

## 6. P3 — Dependencias

### Estado actual

`npm audit --omit=dev --audit-level=high` no reporta altas. Reporta 8 moderadas:

```text
exceljs → archiver → archiver-utils / glob / minimatch
```

`npm audit fix --force` propone `exceljs@4.1.1`, que es un cambio incompatible y puede romper la exportación XLSX.

### Ruta recomendada

1. No ejecutar `npm audit fix --force`.
2. Mantener la versión actual de `exceljs` y documentar la excepción en `AGENTS.md` o en el reporte de seguridad.
3. Añadir o conservar el gate de CI:
   ```bash
   npm audit --omit=dev --audit-level=high
   ```
   Debe fallar solo con altas o críticas, no con las 8 moderadas conocidas.
4. Revisar `npm audit fix --dry-run` antes de aceptar cualquier cambio.
5. Cuando `exceljs` publique una versión con `archiver`/`minimatch` corregidos:
   - actualizar,
   - probar exportación XLSX,
   - revisar tamaño del bundle.
6. No añadir otra librería XLSX sin justificar.

### Criterios de aceptación

- 0 altas y 0 críticas.
- Las 8 moderadas quedan documentadas con responsable y fecha de revisión.
- Exportación XLSX probada.
- CI no se salta el audit.

### Riesgo

**Medio:** una actualización forzada puede romper reportes. No hacerlo sin prueba de exportación.

---

## 7. P4 — Redirecciones y guards por rol

### Problema

Hay rutas duplicadas y destinos inconsistentes. El comportamiento actual no es uniforme:

- `/login` no redirige a `/select-role` al terminar; varios flujos van a `/`.
- `/admin` manda a `/` si no es admin.
- `/products` manda a `/dashboard` para viajero/admin, pero no hay un guard central.
- `/my-products` sigue existiendo como ruta, aunque el flujo de producto apunta a `/settings` en algunos casos.
- `/taxi-dashboard` sí manda a `/dashboard` si el rol no es taxi.

### Mapa recomendado

| Rol | Inicio |
| --- | --- |
| `traveler` | `/dashboard` |
| roles de proveedor | `/dashboard` |
| `taxi` | `/taxi-dashboard` |
| `admin` | `/admin` |

Reglas:

- `/login` autenticado → inicio por rol.
- `/admin` sin rol admin → inicio por rol, nunca `/` fijo.
- `/products`:
  - viajero/admin → `/dashboard`
  - proveedor → `/products`
  - taxi → `/taxi-dashboard`
- `/my-products`:
  - proveedor → `/products`
  - otros → `/settings`
  - si se decide retirar, dejar redirección y no duplicar UI.
- `/taxi-dashboard` sin rol taxi → inicio por rol.

### Implementación recomendada

1. Crear `client/src/lib/role-home.ts` con `roleHome(role)`.
2. Crear `RequireRole` o `RoleGate` en `client/src/components/` para no renderizar y luego expulsar.
3. Usar el helper en `Login`, `AdminDashboard`, `ProductManager`, `MyProducts`, `TaxiDashboard` y `RoleSelection`.
4. Evitar redirecciones dentro de `useEffect` cuando se pueda decidir antes de renderizar.
5. Probar con cada rol y con URL directa.

### Criterios de aceptación

- No hay bucles de redirección.
- Cada rol cae en su inicio.
- URL directa a ruta privada no muestra contenido antes de expulsar.
- `/my-products` tiene un destino único y documentado.
- Navegación móvil y escritorio siguen funcionando.

### Riesgo

**Medio:** es una decisión de UX. Requiere aprobar si `/my-products` se retira o se conserva.

---

## 8. P5 — Performance

### Estado actual

Mediciones previas:

- Perfil público: ~3 s.
- Borrado de cuenta: ~4.3 s.

No se debe optimizar a ciegas. Primero medir después del merge.

### Ruta recomendada

1. Añadir tiempos de servidor por endpoint:
   - `GET /api/social/users/:username/profile`
   - `DELETE /api/user/account`
2. Perfil público:
   - paralelizar consultas independientes con `Promise.all`,
   - revisar `relationshipState` y conteos,
   - añadir índices si faltan:
     - `social_posts(username, created_at DESC)`
     - `social_followers(following_id)`
     - `social_followers(follower_id)`
3. Borrado de cuenta:
   - evaluar transacción única o CTE,
   - evitar 20+ round-trips secuenciales,
   - valorar soft-delete + purga programada si el requisito legal lo permite.
4. Definir presupuesto:
   - perfil p95 < 800 ms,
   - borrado p95 < 1.5 s,
   - sin errores 5xx.
5. Medir antes/después y dejar evidencia.

### Criterios de aceptación

- Mejora medible, no solo percibida.
- Sin cambios de privacidad en el borrado.
- Tests y smoke test en verde.
- No introducir caché que muestre datos de otra persona.

### Riesgo

**Medio:** el borrado toca privacidad y foreign keys. Requiere backup y prueba con cuenta temporal.

---

## 9. P6 — Validación visual y dispositivos

### Estado actual

El merge retiró WebGL/refracción por rendimiento. `GlassCanvas` ya no pinta nada y `LiquidGlass` usa superficies sólidas. **No se debe reintroducir `backdrop-filter` ni el canvas WebGL** según `AGENTS.md`.

Por tanto, el pendiente ya no es “implementar refracción”; es validar que el reemplazo CSS se vea bien y no rompa el 360 real.

### Ruta recomendada

1. Probar temas: claro, `dark`, `sunset`, `ocean`, `forest`.
2. Probar anchos: 360 px, 768 px, 1440 px.
3. Revisar:
   - buscador del hero sobre foto oscura,
   - dock móvil y sus taps,
   - navbar con marca y nombre,
   - tarjetas y badges de cupos,
   - visor 360 solo con panorama equirectangular 2:1.
4. Revisar `prefers-reduced-motion`: Lenis debe desactivarse.
5. Ejecutar Lighthouse en `/`, `/login` y `/explore`.
6. Probar en un Android real y, si hay, iOS.
7. Si algo falla, corregir CSS o markup. No reintroducir GPU.

### Criterios de aceptación

- Texto legible en los 5 temas.
- Sin solapamientos a 360 px.
- Dock y navbar usables con teclado y touch.
- 360 no muestra esfera falsa.
- Lighthouse de accesibilidad ≥ 0.95.

### Riesgo

**Bajo:** es QA visual. Puede revelar bugs, pero no requiere migración.

---

## 10. Orden recomendado de ejecución

```text
1. P6 validación visual       → barato, detecta regresiones del merge
2. P3 dependencias            → solo documentar/gate, sin riesgo
3. P4 rutas por rol           → cambio acotado de frontend
4. P5 performance             → medir y optimizar
5. P2 limpieza QA             → requiere aprobación y backup
6. P1 handle público          → migración grande, decisión de producto
7. P0 Wompi real              → último, con llaves y finanzas
```

No mezclar P1, P2 y P0 en un mismo despliegue.

---

## 11. Gate antes de push

Ejecutar y pegar salida:

```bash
git status --short --branch
npm run check
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Además:

- [ ] `dist/public/llms-full.txt` existe.
- [ ] No hay marcadores de conflicto.
- [ ] Smoke test de rutas públicas y privadas.
- [ ] No hay secretos nuevos en el diff.
- [ ] No se tocó `vercel.json` sin justificación.
- [ ] El usuario autorizó el push.

---

## 12. Archivos clave

| Tema | Archivos |
| --- | --- |
| Pagos | `server/payments.ts`, `server/routes/payments.routes.ts`, `tests/payments.test.ts` |
| Identidad pública | `shared/schema.ts`, `server/catalog.ts`, `server/routes/index.ts`, `server/routes/social.routes.ts` |
| QA | `scripts/`, tablas `users`, `services`, `trips`, `trip_stops` |
| Dependencias | `package.json`, `package-lock.json`, `.github/workflows/security.yml` |
| Rutas | `client/src/App.tsx`, `client/src/pages/Login.tsx`, `AdminDashboard.tsx`, `ProductManager.tsx`, `MyProducts.tsx`, `TaxiDashboard.tsx` |
| Performance | `server/routes/social.routes.ts`, `server/routes/index.ts`, migraciones de índices |
| Visual | `client/src/styles/glass.css`, `client/src/components/MobileDock.tsx`, `Navbar.tsx`, `media/Viewer360.tsx` |

---

## 13. Decisión pendiente del usuario

Antes de ejecutar P1, P2 o P0 hace falta una respuesta explícita:

1. ¿Se migra el email público a `handle` o se mantiene el login con email?
2. ¿Qué IDs/cuentas QA autorizas borrar y con qué backup?
3. ¿Quién entrega las llaves Wompi y quién valida el primer pago real?
4. ¿Se retira `/my-products` o se conserva como alias?

Sin esas respuestas, el código puede quedar estable, pero esos pendientes no se cierran.
