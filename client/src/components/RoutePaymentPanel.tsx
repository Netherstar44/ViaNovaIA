import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, CreditCard, ExternalLink, Loader2,
  LockKeyhole, RefreshCw, ShieldCheck, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiBase } from "@/lib/queryClient";
import { authHeaders } from "@/lib/secureStorage";
import { useToast } from "@/hooks/use-toast";
import type { TripDto } from "./TripPlannerPanel";

type PaymentMethod = {
  id: string;
  type: string;
  label: string;
  details?: string | null;
  isDefault?: string;
};

type PaymentIntent = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  provider: string;
  checkoutUrl: string | null;
  sandbox: boolean;
  instructions: string | null;
  expiresAt: string | null;
  paidAt: string | null;
};

type PaymentConfig = {
  provider: string;
  mode: string;
  sandbox: boolean;
  note: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente de pago",
  checkout_opened: "Checkout abierto",
  sandbox_paid: "Aprobado en sandbox",
  paid: "Pagado",
  failed: "Pago rechazado",
  expired: "Pago expirado",
  cancelled: "Pago cancelado",
};

const STATUS_STYLE: Record<string, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  checkout_opened: "border-blue-500/30 bg-blue-500/10 text-blue-200",
  sandbox_paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  failed: "border-red-500/30 bg-red-500/10 text-red-200",
  expired: "border-border/40 bg-secondary/20 text-muted-foreground",
  cancelled: "border-border/40 bg-secondary/20 text-muted-foreground",
};

function money(value: number, currency = "COP") {
  return `$${Number(value || 0).toLocaleString("es-CO")} ${currency}`;
}

function isPaidStatus(status: string | undefined) {
  return status === "paid" || status === "sandbox_paid";
}

export default function RoutePaymentPanel({ trip }: { trip: TripDto }) {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("wompi");
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const routed = trip.status === "routed";
  const paid = isPaidStatus(trip.paymentStatus) || isPaidStatus(intent?.status);
  const providerCount = useMemo(
    () => new Set((trip.stops || []).map((stop) => stop.providerUsername)).size,
    [trip.stops],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [methodsRes, configRes, intentsRes] = await Promise.all([
        fetch(`${apiBase}/api/payment-methods/${encodeURIComponent(trip.username)}`, {
          headers: await authHeaders(),
          credentials: "include",
        }),
        fetch(`${apiBase}/api/payments/config`, {
          headers: await authHeaders(),
          credentials: "include",
        }),
        fetch(`${apiBase}/api/payments/intents?tripId=${encodeURIComponent(trip.id)}`, {
          headers: await authHeaders(),
          credentials: "include",
        }),
      ]);

      const methodsData = await methodsRes.json().catch(() => ({}));
      const configData = await configRes.json().catch(() => null);
      const intentsData = await intentsRes.json().catch(() => ({}));

      const nextMethods: PaymentMethod[] = Array.isArray(methodsData.methods) ? methodsData.methods : [];
      setMethods(nextMethods);
      if (configData) setConfig(configData);

      const latest: PaymentIntent | null = Array.isArray(intentsData.intents) && intentsData.intents.length
        ? intentsData.intents[0]
        : null;
      setIntent(latest);

      const preferred = nextMethods.find((method) => method.isDefault === "true") || nextMethods[0];
      setSelectedMethod(preferred?.type || "wompi");
    } catch {
      setError("No se pudieron cargar los métodos de pago.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [trip.id, trip.paymentStatus]);

  const createIntent = async () => {
    if (creating || paid) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(apiBase + "/api/payments/intents", {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          tripId: trip.id,
          method: selectedMethod || "wompi",
          idempotencyKey: typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${trip.id}-${Date.now()}`,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo iniciar el pago");
      const nextIntent: PaymentIntent = data.intent;
      setIntent(nextIntent);

      if (nextIntent.checkoutUrl) {
        // Se intenta abrir en una pestaña nueva; si el navegador lo bloquea,
        // el enlace queda visible en el panel.
        window.open(nextIntent.checkoutUrl, "_blank", "noopener,noreferrer");
        toast({
          title: "Checkout abierto",
          description: "Completa el pago en Wompi. No compartas datos bancarios por chat.",
        });
      } else if (nextIntent.instructions) {
        toast({ title: "Pago registrado", description: nextIntent.instructions });
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo iniciar el pago");
    } finally {
      setCreating(false);
    }
  };

  const refreshIntent = async () => {
    if (!intent?.id || checking) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/payments/intents/${encodeURIComponent(intent.id)}`, {
        headers: await authHeaders(),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo verificar el pago");
      setIntent(data.intent);
      if (isPaidStatus(data.intent?.status)) {
        toast({ title: "Pago confirmado", description: "La ruta quedó marcada como pagada." });
      } else {
        toast({ title: "Pago aún pendiente", description: "La pasarela todavía no confirma la transacción." });
      }
    } catch (err: any) {
      setError(err?.message || "No se pudo verificar el pago");
    } finally {
      setChecking(false);
    }
  };

  const confirmSandbox = async () => {
    if (!intent?.id || creating) return;
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/payments/intents/${encodeURIComponent(intent.id)}/sandbox-confirm`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "No se pudo confirmar en sandbox");
      setIntent(data.intent);
      toast({ title: "Pago sandbox aprobado", description: "No se cobró dinero real. Estado: sandbox_paid." });
    } catch (err: any) {
      setError(err?.message || "No se pudo confirmar en sandbox");
    } finally {
      setCreating(false);
    }
  };

  if (!routed) return null;

  if (paid) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          {intent?.status === "sandbox_paid" || trip.paymentStatus === "sandbox_paid"
            ? "Pago aprobado en sandbox"
            : "Ruta pagada"}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {intent?.reference ? `Referencia ${intent.reference} · ` : ""}
          {intent?.amount ? money(intent.amount, intent.currency) : money(trip.totalEstimate, trip.currency)}
          {intent?.status === "sandbox_paid" || trip.paymentStatus === "sandbox_paid"
            ? " · Simulación, sin cobro real."
            : " · Confirmado por la pasarela."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-background/85 to-background/75 p-3 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <Wallet className="h-4 w-4" /> Revisa y paga tu ruta
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            La IA armó el itinerario. Revisa cada parada antes de pagar.
          </p>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${config?.sandbox ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
          {config?.sandbox ? "SANDBOX" : "PRODUCCIÓN"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
        <div className="rounded-lg border border-white/5 bg-background/70 p-2">
          <p className="text-muted-foreground">Total a pagar</p>
          <p className="mt-0.5 text-sm font-extrabold text-primary">{money(trip.totalEstimate, trip.currency)}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-background/70 p-2">
          <p className="text-muted-foreground">Paradas / proveedores</p>
          <p className="mt-0.5 text-sm font-bold">{trip.stops.length} / {providerCount}</p>
        </div>
      </div>

      <div className="mt-2 rounded-lg border border-white/5 bg-background/70 p-2 text-[10px] text-muted-foreground">
        <p className="font-semibold text-foreground/80">{trip.destinationCity} · {trip.days} {trip.days === 1 ? "día" : "días"} · {trip.travelers} {trip.travelers === 1 ? "viajero" : "viajeros"}</p>
        <p className="mt-1 line-clamp-2">{trip.summary}</p>
      </div>

      {loading ? (
        <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Cargando métodos de pago...
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Método de pago
          </label>
          <select
            value={selectedMethod}
            onChange={(event) => setSelectedMethod(event.target.value)}
            className="w-full rounded-lg border border-border/40 bg-background/70 px-2.5 py-2 text-[11px] outline-none focus:border-primary/50"
          >
            <option value="wompi">Wompi · tarjeta, PSE, Nequi o QR</option>
            {methods.map((method) => (
              <option key={method.id} value={method.type}>
                {method.label}{method.details ? ` · ${method.details}` : ""}
              </option>
            ))}
          </select>

          {methods.length === 0 && (
            <p className="text-[10px] text-muted-foreground">
              Puedes pagar directo con Wompi o{" "}
              <a href="/payments" className="font-semibold text-primary hover:underline">
                vincular QR, Bre-B o tarjeta
              </a>.
            </p>
          )}

          {intent && (
            <div className={`rounded-lg border p-2 text-[10px] ${STATUS_STYLE[intent.status] || STATUS_STYLE.pending}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{STATUS_LABEL[intent.status] || intent.status}</span>
                <span className="font-mono text-[9px] opacity-80">{intent.reference}</span>
              </div>
              <p className="mt-0.5 opacity-80">
                {money(intent.amount, intent.currency)}
                {intent.expiresAt ? ` · Expira ${new Date(intent.expiresAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}` : ""}
              </p>
              {intent.checkoutUrl && (
                <a
                  href={intent.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 font-semibold underline"
                >
                  Abrir checkout de Wompi <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {intent.instructions && <p className="mt-1 opacity-80">{intent.instructions}</p>}
            </div>
          )}

          {error && (
            <p className="flex items-start gap-1 text-[10px] font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={createIntent}
              disabled={creating}
              className="h-8 flex-1 bg-emerald-500 text-black text-[11px] font-bold hover:bg-emerald-400"
            >
              {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-1.5 h-3.5 w-3.5" />}
              {intent?.checkoutUrl ? "Reabrir pago" : "Revisar y pagar"}
            </Button>
            {intent && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={refreshIntent}
                disabled={checking}
                className="h-8 text-[11px]"
              >
                {checking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                Verificar
              </Button>
            )}
            {intent && intent.sandbox && ["pending", "checkout_opened"].includes(intent.status) && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={confirmSandbox}
                disabled={creating}
                className="h-8 border-amber-500/30 text-[10px] text-amber-200 hover:bg-amber-500/10"
              >
                Simular pago sandbox
              </Button>
            )}
          </div>

          <p className="flex items-start gap-1 text-[9px] leading-relaxed text-muted-foreground">
            <LockKeyhole className="mt-0.5 h-3 w-3 shrink-0" />
            {config?.note || "El pago se completa en la pasarela. VIANova no recibe ni guarda datos bancarios."}
          </p>
        </div>
      )}
    </div>
  );
}
