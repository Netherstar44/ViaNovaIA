import { useState } from "react";
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
