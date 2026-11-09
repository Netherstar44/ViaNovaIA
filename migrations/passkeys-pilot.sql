-- Migración mínima de passkeys + piloto facial experimental.
-- Solo CREA tablas nuevas con IF NOT EXISTS. No altera ni borra datos existentes.
-- El servidor aplica el mismo DDL de forma idempotente al arrancar (/api).
-- Aplicar manualmente solo contra una base seleccionada y con autorización escrita.

CREATE TABLE IF NOT EXISTS identity_pilot_access (
  username text PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
  invited_by text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS user_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text NOT NULL DEFAULT '[]',
  device_type text,
  backed_up boolean NOT NULL DEFAULT false,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS user_passkeys_user_idx ON user_passkeys(user_id);

CREATE TABLE IF NOT EXISTS webauthn_challenges (
  id uuid PRIMARY KEY,
  user_id varchar REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('registration', 'authentication', 'reauth')),
  challenge text NOT NULL,
  purpose text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webauthn_challenges_expiry_idx ON webauthn_challenges(expires_at);

CREATE TABLE IF NOT EXISTS reauth_tokens (
  token_hash text PRIMARY KEY,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reauth_tokens_user_idx ON reauth_tokens(user_id, expires_at);

-- Verificación posterior (solo lectura):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('identity_pilot_access','user_passkeys','webauthn_challenges','reauth_tokens');
