-- Aplicar solo contra una base explícitamente seleccionada.
-- Producción requiere autorización escrita del responsable; nunca ejecución automática.
-- No se ejecuta automáticamente en peticiones ni despliegues.
CREATE TABLE IF NOT EXISTS identity_verifications (
  username text PRIMARY KEY REFERENCES users(username) ON DELETE CASCADE,
  revision integer NOT NULL,
  sealed text NOT NULL,
  valid_until timestamptz,
  method text CHECK (method IN ('face', 'manual')),
  template_expires timestamptz,
  purge_after timestamptz
);
CREATE TABLE IF NOT EXISTS identity_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor text NOT NULL,
  subject text NOT NULL,
  event text NOT NULL,
  result text NOT NULL,
  -- Distancia escalar restringida a auditoría; nunca vectores, landmarks o fotos.
  score real,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS identity_audit_subject_time ON identity_audit(subject, created_at);
