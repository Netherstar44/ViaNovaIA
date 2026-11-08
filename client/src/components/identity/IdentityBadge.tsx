import type { PublicIdentity } from "@shared/identity";
import { useEffect, useState } from "react";
export function IdentityBadge({ identity, label = "Identidad" }: { identity?: PublicIdentity | null; label?: string }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!identity?.validUntil) return;
    const ms = new Date(identity.validUntil).getTime() - Date.now();
    if (ms <= 0) return;
    const timer = setTimeout(() => refresh(n => n + 1), Math.min(ms + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [identity?.validUntil]);
  const current = identity?.verified && !!identity.validUntil && new Date(identity.validUntil).getTime() > Date.now();
  return <div className="text-sm text-foreground"><span>{label}: {identity?.name ?? "Sin nombre aprobado"}</span>
    <p className="text-xs text-muted-foreground">{current ? `✓ Verificado (${identity!.method === "manual" ? "revisión manual" : "rostro"})` : "Verificación no vigente"}
      {identity?.verifiedAt && ` · ${new Date(identity.verifiedAt).toLocaleString("es-CO")}`}</p></div>;
}
