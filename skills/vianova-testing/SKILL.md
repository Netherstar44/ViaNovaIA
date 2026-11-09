---
name: ViaNova Testing
description: Usar cuando se escriban o arreglen pruebas, se depure un fallo, se necesite el flujo TDD del proyecto o se verifique que un cambio no rompió seguridad, pagos, identidad o despliegue.
---

# ViaNova Testing

## Runner

El proyecto usa `node:test` + `tsx`, no Jest ni Vitest.

```bash
npm test                 # cross-env NODE_ENV=test tsx --test tests/*.test.ts
npm run test:security    # solo tests/security.test.ts
```

Un archivo concreto:

```bash
npx cross-env NODE_ENV=test tsx --test tests/security.test.ts
```

`npm run check` **excluye** `**/*.test.ts` y `server/worker.ts` (ver `tsconfig.json`). No asumas que TypeScript valida los tests; ejecútalos.

## Suite actual

| Archivo | Cubre |
| --- | --- |
| `tests/security.test.ts` | Auth, RBAC, CSRF/CORS, rate limits, pagos, uploads, sanitización, SSRF, logs. |
| `tests/payments.test.ts` | Integridad de pagos y webhooks. |
| `tests/passkeys.test.ts` | WebAuthn / passkeys. |
| `tests/identity.test.ts`, `identity-http.test.ts`, `identity-pilot.test.ts` | Verificación de identidad. |
| `tests/face-collection.test.ts`, `calibration-stats.test.ts` | Colección y calibración facial. |
| `tests/panorama-stitcher.test.ts`, `sphere.test.ts` | Stitch y geometría 360°. |
| `tests/catalog-media.test.ts` | Medios del catálogo. |
| `tests/deploy-config.test.ts` | Invariantes de `vercel.json` y `package.json`. |
| `tests/time.test.ts` | Utilidades de tiempo. |

## Patrón de prueba

```ts
import assert from "node:assert/strict";
import { test } from "node:test";

test("describe el comportamiento esperado", async () => {
  // Arrange: datos mínimos y explícitos
  // Act: llama a la función o al handler
  // Assert: comprueba el efecto observable
  assert.equal(resultado, esperado);
});
```

- Una prueba debe fallar por una razón concreta y pasar por el cambio correcto.
- No uses la base de datos de producción. La mayoría de pruebas son unitarias o de configuración.
- Para handlers HTTP, usa objetos `req`/`res` falsos y `next` para capturar errores.
- Para fixes de seguridad, añade la regresión en `tests/security.test.ts`.
- Para cambios de despliegue, actualiza `tests/deploy-config.test.ts`.

## Flujo TDD

1. **RED**: escribe la prueba que reproduce el fallo o la nueva regla. Ejecútala y confirma que falla por la razón correcta.
2. **GREEN**: implementa el cambio mínimo para que pase.
3. **REFACTOR**: limpia sin cambiar comportamiento.
4. **VERIFY**: `npm run check && npm test && npm run build`.

## Reglas

- **Nunca** desactives, borres o marques como `skip` una prueba para “que pase”.
- **Nunca** bajes un umbral ni silencies un error de tipos para avanzar.
- No inventes resultados de pruebas: pega la salida real.
- Si una prueba es flaky, encuentra la causa; no la repitas hasta que pase.
- Si el build falla, arréglalo antes de seguir añadiendo funciones.

## Qué probar según el cambio

| Cambio | Prueba mínima |
| --- | --- |
| Endpoint privado | Sin token → 401; rol incorrecto → 403; dueño → 200. |
| Validación de entrada | Caso válido, caso inválido, límite de tamaño. |
| Pago/webhook | Firma inválida, monto incorrecto, evento duplicado. |
| Upload | MIME falso, extensión incorrecta, tamaño excesivo. |
| SEO/deploy | `deploy-config.test.ts` y build de artefactos. |
| 360 | `sphere.test.ts` y `panorama-stitcher.test.ts`. |
| Chat IA | Fallback sin clave, rol no autorizado, mensaje vacío. |
