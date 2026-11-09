# Acceso y seguridad: passkeys y piloto facial

## Qué se añadió

- **Passkeys WebAuthn** (`@simplewebauthn/server` 14.1.0 y `@simplewebauthn/browser` 14.0.0) para:
  - iniciar sesión sin contraseña desde `/login` («Entrar con passkey»);
  - confirmar operaciones sensibles con una credencial reciente.
- **Sección «Acceso y seguridad»** en `/settings`: registrar, listar y revocar passkeys; cambiar contraseña y correo de recuperación con confirmación previa.
- **Piloto facial experimental** para cuentas invitadas desde `/admin`, con calidad, distancia y resultado del reto.

Las passkeys **no sustituyen** a face-api: resuelven autenticación. El piloto facial sigue siendo una prueba de identidad.

## Flujo de activación de una passkey

1. Inicia sesión con tu método actual.
2. Ve a `/settings` → **Acceso y seguridad** → **Activar acceso con el dispositivo**.
3. Confirma tu identidad con una passkey existente o con tu contraseña (token de un solo uso, 5 minutos).
4. El navegador abre el diálogo del sistema. Según el equipo podrás usar rostro, huella, PIN o llave física; **no todos los dispositivos ofrecen reconocimiento facial**.
5. La credencial queda registrada y aparece en la lista. Puedes revocarla con una nueva confirmación.

## Acceso con passkey

`/login` → **Entrar con passkey**. El servidor genera un reto aleatorio, lo guarda ligado a la sesión de registro, lo elimina al primer uso y verifica:

- caducidad (5 minutos) y uso único;
- `origin` y `RP ID` configurados (nunca el header `Host`);
- firma con la clave pública guardada;
- que la credencial pertenece a la cuenta;
- `userVerification` (rostro/huella/PIN).

Si la cuenta tiene 2FA activo, después de la passkey se sigue pidiendo el código por correo. Los roles y la sesión se resuelven igual que en el login actual.

## Operaciones sensibles

Estas rutas exigen `reauthToken`, emitido tras una confirmación reciente y **consumido en el servidor** para esa operación concreta:

| Operación | Ruta | Propósito |
| --- | --- | --- |
| Cambiar contraseña | `PATCH /api/auth/password` | `password-change` |
| Cambiar correo de recuperación | `PATCH /api/auth/recovery-email` | `recovery-email` |
| Activar/desactivar 2FA | `PATCH /api/auth/2fa` | `two-factor` |
| Registrar passkey | `POST /api/auth/passkeys` | `passkey-register` |
| Revocar passkey | `DELETE /api/auth/passkeys/:id` | `passkey-remove` |

Un booleano del frontend no autoriza nada: el token es opaco, caduca en 5 minutos, se guarda hasheado y se marca como usado en el mismo `UPDATE` que lo valida.

## Piloto facial experimental

- Solo cuentas en `identity_pilot_access` (invitadas desde `/admin`).
- Consentimiento específico distinto del consentimiento legal (`PILOT_CONSENT_VERSION`).
- No modifica `FACE_CALIBRATION_APPROVED` ni `FACE_CONSENT_LEGAL_APPROVED`.
- No escribe `approvedName`, `method` ni `validUntil`: **no concede identidad verificada, insignias, sesiones ni autorización de cambios sensibles**.
- Devuelve calidad (píxeles de rostro, luz, nitidez, giro), distancia y resultado (`passed`/`rejected`).
- La muestra se cifra con `BIOMETRIC_ENCRYPTION_KEY`, caduca a los 7 días (`FACE_PILOT_RETENTION_DAYS`, máximo 30) y se elimina al revocar.
- No se guardan fotogramas ni se envían a terceros; los logs solo reciben eventos y la distancia escalar.

## Variables de entorno

| Variable | Uso |
| --- | --- |
| `WEBAUTHN_RP_ID` | Opcional. RP ID explícito (dominio sin esquema). Por defecto, el host de `PUBLIC_URL`. |
| `FACE_PILOT_DISTANCE_THRESHOLD` | Opcional. Umbral experimental, por defecto `0.55`. |
| `FACE_PILOT_RETENTION_DAYS` | Opcional. Retención de la muestra piloto, por defecto `7`. |
| `PUBLIC_URL` | Debe ser el origen público real para que `origin`/RP ID coincidan. |
| `BIOMETRIC_ENCRYPTION_KEY` | 64 hex; ya requerida por el almacén cifrado de identidad. |

## Migración

`migrations/passkeys-pilot.sql` solo crea tablas nuevas con `IF NOT EXISTS`:

- `identity_pilot_access`
- `user_passkeys`
- `webauthn_challenges`
- `reauth_tokens`

El servidor aplica el mismo DDL de forma idempotente al atender `/api` (patrón ya usado por `ensureUserSchema`). No altera tablas ni datos existentes.

## Límites conocidos

- Sin `DATABASE_URL` no hay passkeys ni piloto: son estado de servidor.
- Sin `BIOMETRIC_ENCRYPTION_KEY` válida el motor facial no puede guardar la muestra.
- El piloto no está calibrado: el resultado puede fallar con la propia persona. Por eso la interfaz dice que la identidad no está validada.
- Las pruebas automáticas cubren la lógica pura y el servicio del piloto; los flujos WebAuthn completos requieren un navegador real y HTTPS/localhost.
