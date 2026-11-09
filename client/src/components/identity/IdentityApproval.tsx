import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

export function IdentityApproval() {
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  return <form className="rounded-2xl border border-border bg-card p-4 space-y-3" onSubmit={async e => {
    e.preventDefault(); setBusy(true); setMessage("");
    const fields = new FormData(e.currentTarget);
    try {
      await apiRequest("POST", `/api/identity/admin/${encodeURIComponent(String(fields.get("username")))}/approve`, {
        name: fields.get("name"), documentRef: fields.get("documentRef"), method: fields.get("method"), documentChecked: fields.get("checked") === "on",
      });
      setMessage("Aprobación registrada y auditada.");
    } catch { setMessage("No se pudo aprobar. Revisa la cuenta, el enrolamiento y tu sesión administrativa."); }
    finally { setBusy(false); }
  }}>
    <h2 className="text-lg font-semibold">Aprobar identidad documental</h2>
    <p className="text-sm text-muted-foreground">Coteja presencialmente el documento original y a su titular. Guarda solo una referencia del expediente restringido, nunca la foto ni el número completo del documento.</p>
    {[['username', 'Usuario', 40], ['name', 'Nombre legal comprobado', 120], ['documentRef', 'Referencia de revisión documental', 160]].map(([name, label, max]) => <label className="block text-sm" key={name}><span>{label}</span><input name={String(name)} required maxLength={Number(max)} className="mt-1 w-full rounded-md border border-border bg-background p-2" /></label>)}
    <label className="block text-sm">Vía de verificación<select name="method" className="ml-2 rounded border border-border bg-background p-2"><option value="face">Rostro enrolado</option><option value="manual">Revisión manual sin biometría</option></select></label>
    <label className="flex items-start gap-2 text-sm"><input name="checked" type="checkbox" required className="h-5 w-5" />Cotejé el documento original con la persona y comprobé el nombre.</label>
    <Button disabled={busy}>Aprobar identidad</Button><p role="status">{message}</p>
  </form>;
}

type Invite = { username: string; invitedBy: string; note: string | null; createdAt: string };

/**
 * Allowlist del piloto experimental. Solo un administrador con sesión
 * administrativa puede invitar o revocar; el servidor comprueba el rol dos veces.
 */
export function PilotAccessPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ invites: Invite[] }>({ queryKey: ["/api/identity/admin/pilot"] });
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);

  const invites = data?.invites ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/identity/admin/pilot"] });

  return <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div>
      <h2 className="text-lg font-semibold">Piloto facial experimental</h2>
      <p className="text-sm text-muted-foreground">
        Invita cuentas concretas al piloto de reconocimiento facial. La prueba no valida identidad, no concede insignias
        y no autoriza cambios sensibles. Revocar una invitación bloquea el acceso de inmediato.
      </p>
    </div>
    <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={async e => {
      e.preventDefault();
      const form = e.currentTarget;
      const fields = new FormData(form);
      const username = String(fields.get("username") || "").trim();
      const note = String(fields.get("note") || "").trim();
      if (!username) return;
      setBusy(true); setMessage("");
      try {
        await apiRequest("POST", "/api/identity/admin/pilot", { username, ...(note ? { note } : {}) });
        setMessage(`Invitación activa para ${username}.`);
        form.reset();
        await refresh();
      } catch {
        setMessage("No se pudo invitar. Verifica que la cuenta exista y que tu sesión sea administrativa.");
      } finally { setBusy(false); }
    }}>
      <label className="block text-sm flex-1"><span>Usuario o correo de la cuenta</span>
        <input name="username" required maxLength={80} className="mt-1 w-full rounded-md border border-border bg-background p-2" placeholder="compañero@ejemplo.com" />
      </label>
      <label className="block text-sm flex-1"><span>Nota interna (opcional)</span>
        <input name="note" maxLength={160} className="mt-1 w-full rounded-md border border-border bg-background p-2" placeholder="Equipo de pruebas" />
      </label>
      <Button disabled={busy}>Invitar al piloto</Button>
    </form>
    {isLoading ? <p role="status" className="text-sm text-muted-foreground">Cargando invitaciones…</p> : invites.length === 0
      ? <p className="text-sm text-muted-foreground">Todavía no hay cuentas invitadas.</p>
      : <ul className="space-y-2">
        {invites.map(invite => <li key={invite.username} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/60 bg-secondary/20 px-3 py-2">
          <div>
            <p className="text-sm font-medium">{invite.username}</p>
            <p className="text-xs text-muted-foreground">Invitada por {invite.invitedBy}{invite.note ? ` · ${invite.note}` : ""}</p>
          </div>
          <Button variant="outline" size="sm" disabled={busy} onClick={async () => {
            setBusy(true); setMessage("");
            try {
              await apiRequest("DELETE", `/api/identity/admin/pilot/${encodeURIComponent(invite.username)}`);
              setMessage(`Invitación revocada para ${invite.username}.`);
              await refresh();
            } catch { setMessage("No se pudo revocar la invitación."); }
            finally { setBusy(false); }
          }}>Revocar</Button>
        </li>)}
      </ul>}
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
  </section>;
}
