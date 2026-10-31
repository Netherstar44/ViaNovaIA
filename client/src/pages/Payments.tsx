import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, CheckCircle2, Clock, CreditCard, ExternalLink,
  Loader2, LockKeyhole, QrCode, ReceiptText, ShieldCheck, Wallet,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import PaymentMethods from "@/components/PaymentMethods";
import RoutePaymentPanel from "@/components/RoutePaymentPanel";
import type { TripDto } from "@/components/TripPlannerPanel";
import { Button } from "@/components/ui/button";
import { apiBase } from "@/lib/queryClient";
import { authHeaders } from "@/lib/secureStorage";
import { useAuth } from "@/lib/auth";

type PaymentConfig = {
  provider: string;
  mode: string;
  sandbox: boolean;
  note: string;
};

type PaymentIntent = {
  id: string;
  reference: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  checkoutUrl: string | null;
  sandbox: boolean;
  tripId: string | null;
  createdAt: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  checkout_opened: "Checkout abierto",
  sandbox_paid: "Sandbox aprobado",
  paid: "Pagado",
  failed: "Rechazado",
  expired: "Expirado",
  cancelled: "Cancelado",
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

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Payments() {
  const { user, loading: authLoading } = useAuth();
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [trip, setTrip] = useState<TripDto | null>(null);
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTraveler = user?.role === "traveler";

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [configRes, intentsRes, tripRes] = await Promise.all([
          fetch(`${apiBase}/api/payments/config`, {
            headers: await authHeaders(),
            credentials: "include",
          }),
          fetch(`${apiBase}/api/payments/intents`, {
            headers: await authHeaders(),
            credentials: "include",
          }),
          isTraveler
            ? fetch(`${apiBase}/api/trips/latest`, {
                headers: await authHeaders(),
                credentials: "include",
              })
            : Promise.resolve(null),
        ]);

        const configData = await configRes.json().catch(() => null);
        const intentsData = await intentsRes.json().catch(() => ({}));
        const tripData = tripRes ? await tripRes.json().catch(() => ({})) : null;

        if (cancelled) return;
        if (configData) setConfig(configData);
        setIntents(Array.isArray(intentsData.intents) ? intentsData.intents : []);
        if (tripData?.trip) setTrip(tripData.trip as TripDto);
      } catch {
        if (!cancelled) setError("No se pudo cargar la información de pagos.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.username, isTraveler]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <h1 className="text-xl font-bold">Inicia sesión para gestionar pagos</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tus métodos y comprobantes quedan asociados a tu cuenta.
          </p>
          <Link href="/login">
            <Button className="mt-4 bg-primary font-bold text-black">Iniciar sesión</Button>
          </Link>
        </div>
      </div>
    );
  }

  const routedTrip = trip && trip.status === "routed" ? trip : null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Wallet className="h-4 w-4" /> Pagos VIANova
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              {isTraveler ? "Paga tu ruta" : "Cobra y recibe pagos"}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {isTraveler
                ? "Revisa el itinerario que armó la IA y paga en la pasarela hospedada. VIANova nunca ve tus datos bancarios."
                : "Vincula QR, llave Bre-B, PSE o tarjeta para recibir pagos. Solo guardamos referencias enmascaradas."}
            </p>
          </div>
          <Link href="/settings">
            <Button variant="outline" size="sm" className="gap-2 rounded-xl">
              <ShieldCheck className="h-4 w-4" /> Configurar métodos
            </Button>
          </Link>
        </div>

        <div
          className={`flex items-start gap-2 rounded-2xl border p-3 text-[11px] ${
            config?.sandbox
              ? "border-amber-500/30 bg-amber-500/5 text-amber-100"
              : "border-emerald-500/25 bg-emerald-500/5 text-emerald-100"
          }`}
        >
          {config?.sandbox ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>
            <strong>{config?.sandbox ? "Modo sandbox." : "Modo producción."}</strong>{" "}
            {config?.sandbox
              ? "Los pagos son simulados: no se cobra dinero real. Puedes confirmar el sandbox desde el panel de la ruta."
              : "Los pagos se procesan en Wompi y se confirman únicamente por webhook firmado."}{" "}
            {config?.note || "Los datos bancarios se capturan solo en la pasarela."}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {isTraveler && routedTrip && (
          <section className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold">
              <CreditCard className="h-4 w-4 text-primary" /> Ruta lista para pagar
            </div>
            <RoutePaymentPanel trip={routedTrip} />
          </section>
        )}

        {isTraveler && !routedTrip && !loading && (
          <section className="rounded-2xl border border-border/40 bg-secondary/10 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Clock className="h-4 w-4 text-muted-foreground" /> Sin ruta pendiente de pago
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Pídele a la IA que arme un viaje, revisa las paradas y establece la ruta. Cuando esté
              establecida aparecerá aquí para pagar.
            </p>
            <Link href="/">
              <Button size="sm" variant="outline" className="mt-3 gap-2 rounded-xl">
                <QrCode className="h-4 w-4" /> Planear con la IA
              </Button>
            </Link>
          </section>
        )}

        <section className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <PaymentMethods username={user.username} role={user.role} />
        </section>

        <section className="rounded-2xl border border-border/40 bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Pagos recientes</h2>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Cargando pagos...
            </div>
          ) : intents.length === 0 ? (
            <p className="py-3 text-xs text-muted-foreground">
              Todavía no tienes pagos registrados.
            </p>
          ) : (
            <div className="space-y-2">
              {intents.map((intent) => (
                <div
                  key={intent.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/30 bg-secondary/15 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {intent.reference}
                    </p>
                    <p className="text-sm font-bold">{money(intent.amount, intent.currency)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDate(intent.createdAt)}
                      {intent.sandbox ? " · sandbox" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        STATUS_STYLE[intent.status] || STATUS_STYLE.pending
                      }`}
                    >
                      {STATUS_LABEL[intent.status] || intent.status}
                    </span>
                    {intent.checkoutUrl &&
                      ["pending", "checkout_opened"].includes(intent.status) && (
                        <a
                          href={intent.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
                        >
                          Abrir <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-[11px] text-emerald-100/90">
          <div className="flex items-center gap-2 font-bold">
            <LockKeyhole className="h-4 w-4" /> Privacidad de pagos
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>No guardamos números de tarjeta completos, CVV, cuentas bancarias ni el contenido de un QR.</li>
            <li>El monto y la referencia se calculan en el servidor a partir de tu viaje.</li>
            <li>El pago se confirma solo con el webhook firmado de la pasarela o una simulación sandbox explícita.</li>
            <li>No compartas datos bancarios por chat, correo ni redes sociales.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
