import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { confirmWithPasskey, confirmWithPassword, startPasskeyRegistration, type ReauthPurpose } from "@/lib/passkeys";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fingerprint, KeyRound, Loader2, ShieldCheck, Trash2 } from "lucide-react";

type Passkey = {
  id: string;
  label: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

type Feedback = { type: "success" | "error"; text: string } | null;

function errorText(error: unknown): string {
  const raw = error instanceof Error ? error.message : "No se pudo completar la operación.";
  try {
    const parsed = JSON.parse(raw.replace(/^\d+:\s*/, ""));
    return parsed.message || raw;
  } catch {
    return raw.replace(/^\d+:\s*/, "");
  }
}

/**
 * "Acceso y seguridad": passkeys WebAuthn y confirmación reciente para
 * operaciones sensibles. La autorización real ocurre en el servidor; esta
 * pantalla solo solicita la confirmación y envía el token de un solo uso.
 */
export function AccessSecurity() {
  const queryClient = useQueryClient();
  const { logout } = useAuth();
  const { data, isLoading } = useQuery<{ passkeys: Passkey[]; max: number }>({
    queryKey: ["/api/auth/passkeys"],
  });
  const { data: methods } = useQuery<{ passkeys: number; password: boolean }>({
    queryKey: ["/api/auth/reauth/methods"],
  });

  const [pending, setPending] = useState<ReauthPurpose | null>(null);
  const [reauth, setReauth] = useState<{ token: string; purpose: ReauthPurpose } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Feedback>(null);

  const passkeys = data?.passkeys ?? [];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/passkeys"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/reauth/methods"] });
    } catch (error) {
      setMessage({ type: "error", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  };

  const continueWith = async (purpose: ReauthPurpose, token: string) => {
    setReauth({ token, purpose });
    if (purpose === "passkey-register") {
      await startPasskeyRegistration(label.trim(), token);
      setMessage({ type: "success", text: "Acceso con el dispositivo activado. Ya puedes entrar con passkey." });
    } else if (purpose === "passkey-remove" && deleteTarget) {
      await apiRequest("DELETE", `/api/auth/passkeys/${deleteTarget}`, { reauthToken: token });
      setMessage({ type: "success", text: "Dispositivo revocado. Ya no puede usarse para entrar." });
    } else if (purpose === "password-change") {
      await apiRequest("PATCH", "/api/auth/password", { currentPassword, newPassword, reauthToken: token });
      setMessage({ type: "success", text: "Contraseña actualizada. Vuelve a iniciar sesión con la nueva." });
      setCurrentPassword("");
      setNewPassword("");
      // El servidor invalidó la sesión: limpia el estado local antes de volver al login.
      setTimeout(() => { void logout(); }, 2500);
    } else if (purpose === "recovery-email") {
      const result = await (await apiRequest("PATCH", "/api/auth/recovery-email", { email: recoveryEmail, reauthToken: token })).json();
      setMessage({ type: "success", text: result.message || "Correo de recuperación actualizado." });
      setRecoveryEmail("");
    }
    setPending(null);
    setDeleteTarget(null);
    setPassword("");
    setReauth(null);
  };

  const confirmPasskey = () => {
    if (!pending) return;
    void run(async () => {
      const token = await confirmWithPasskey(pending);
      await continueWith(pending, token);
    });
  };

  const confirmPassword = () => {
    if (!pending || !password) return;
    void run(async () => {
      const token = await confirmWithPassword(pending, password);
      await continueWith(pending, token);
    });
  };

  const requestConfirmation = (purpose: ReauthPurpose) => {
    setMessage(null);
    setPending(purpose);
  };

  const submitPasswordChange = (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentPassword || !newPassword) return;
    if (reauth?.purpose === "password-change") {
      void run(() => continueWith("password-change", reauth.token));
      return;
    }
    requestConfirmation("password-change");
  };

  const submitRecoveryEmail = (event: React.FormEvent) => {
    event.preventDefault();
    if (!recoveryEmail.trim()) return;
    if (reauth?.purpose === "recovery-email") {
      void run(() => continueWith("recovery-email", reauth.token));
      return;
    }
    requestConfirmation("recovery-email");
  };

  const deviceHint = methods && methods.password
    ? "Puedes confirmar con una passkey o con tu contraseña."
    : "Confirma con una passkey registrada en este dispositivo.";

  return (
    <section id="acceso-seguridad" aria-labelledby="acceso-seguridad-titulo" className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
        <div>
          <h2 id="acceso-seguridad-titulo" className="text-lg font-semibold">Acceso y seguridad</h2>
          <p className="text-sm text-muted-foreground">
            Usa el rostro, la huella o el PIN de tu dispositivo para entrar y para confirmar cambios sensibles.
            No todos los equipos ofrecen reconocimiento facial: el sistema elige el método disponible.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Acceso con el dispositivo</h3>
          <span className="text-xs text-muted-foreground">{passkeys.length} de {data?.max ?? 10} dispositivos</span>
        </div>

        {isLoading && <p role="status" className="text-sm text-muted-foreground">Consultando tus dispositivos…</p>}
        {!isLoading && passkeys.length === 0 && (
          <p className="text-sm text-muted-foreground">Todavía no tienes una passkey. Actívala después de iniciar sesión con tu método actual.</p>
        )}
        <ul className="space-y-2">
          {passkeys.map((passkey) => (
            <li key={passkey.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{passkey.label || "Dispositivo"}</p>
                  <p className="text-xs text-muted-foreground">
                    {passkey.deviceType === "multiDevice" ? "Sincronizada entre dispositivos" : "Solo este dispositivo"}
                    {passkey.lastUsedAt ? ` · Usada ${new Date(passkey.lastUsedAt).toLocaleDateString("es-CO")}` : " · Sin usar todavía"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => { setDeleteTarget(passkey.id); requestConfirmation("passkey-remove"); }}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Revocar
              </Button>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={60}
            placeholder="Nombre del dispositivo (opcional)"
            aria-label="Nombre del dispositivo"
            className="sm:max-w-xs"
          />
          <Button disabled={busy || passkeys.length >= (data?.max ?? 10)} onClick={() => requestConfirmation("passkey-register")}>
            <Fingerprint className="mr-2 h-4 w-4" /> Activar acceso con el dispositivo
          </Button>
        </div>
      </div>

      {pending && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <p className="text-sm font-medium">Confirma tu identidad para continuar</p>
          <p className="text-xs text-muted-foreground">
            La confirmación vale solo para esta operación y caduca en 5 minutos. {deviceHint}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={confirmPasskey}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />} Confirmar con passkey
            </Button>
          </div>
          {methods?.password && (
            <form
              onSubmit={(event) => { event.preventDefault(); confirmPassword(); }}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tu contraseña actual"
                aria-label="Contraseña actual para confirmar"
                autoComplete="current-password"
                className="sm:max-w-xs"
              />
              <Button type="submit" variant="outline" disabled={busy || !password}>Confirmar con contraseña</Button>
            </form>
          )}
          <button
            type="button"
            className="text-xs text-muted-foreground underline underline-offset-2"
            onClick={() => { setPending(null); setDeleteTarget(null); setPassword(""); }}
          >
            Cancelar
          </button>
        </div>
      )}

      {message && (
        <p role="status" aria-live="polite" className={`text-sm ${message.type === "success" ? "text-green-500" : "text-red-400"}`}>
          {message.text}
        </p>
      )}

      <div className="grid gap-6 border-t border-border/40 pt-4 sm:grid-cols-2">
        <form onSubmit={submitPasswordChange} className="space-y-2">
          <h3 className="text-sm font-semibold">Cambiar contraseña</h3>
          <Input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            placeholder="Contraseña actual"
            aria-label="Contraseña actual"
            autoComplete="current-password"
          />
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="Nueva contraseña (mín. 8, letras y números)"
            aria-label="Nueva contraseña"
            autoComplete="new-password"
          />
          <Button type="submit" variant="outline" disabled={busy || !currentPassword || !newPassword}>
            Guardar contraseña
          </Button>
        </form>

        <form onSubmit={submitRecoveryEmail} className="space-y-2">
          <h3 className="text-sm font-semibold">Correo de recuperación</h3>
          <Input
            type="email"
            value={recoveryEmail}
            onChange={(event) => setRecoveryEmail(event.target.value)}
            placeholder="nuevo-correo@ejemplo.com"
            aria-label="Nuevo correo de recuperación"
            autoComplete="email"
          />
          <p className="text-xs text-muted-foreground">Recibirás un código de verificación en la nueva dirección.</p>
          <Button type="submit" variant="outline" disabled={busy || !recoveryEmail.trim()}>
            Actualizar correo
          </Button>
        </form>
      </div>

      <p className="text-xs text-muted-foreground">
        Las passkeys no sustituyen al piloto facial: son el método de acceso y de confirmación. El piloto facial sigue siendo
        una prueba experimental de identidad.
      </p>
    </section>
  );
}
