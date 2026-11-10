import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  AlertTriangle, CheckCircle2, Clock, CreditCard, ExternalLink,
  Loader2, LockKeyhole, QrCode, ReceiptText, RefreshCw, ShieldCheck, Wallet,
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

type LoadStatus = "idle" | "loading" | "ready" | "error";

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

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
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  checkout_opened: "border-blue-500/30 bg-blue-500/10 text-blue-800 dark:text-blue-200",
  sandbox_paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  paid: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
  failed: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-200",
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
  const [configStatus, setConfigStatus] = useState<LoadStatus>("loading");
  const [trip, setTrip] = useState<TripDto | null>(null);
  const [tripStatus, setTripStatus] = useState<LoadStatus>("idle");
  const [intents, setIntents] = useState<PaymentIntent[]>([]);
  const [intentsStatus, setIntentsStatus] = useState<LoadStatus>("loading");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isTraveler = user?.role === "traveler";

  useEffect(() => {
    // Los viajes y pagos pertenecen a la cuenta activa. Al cambiar de usuario
    // o cerrar sesión deben descartarse; si no, se muestran datos ajenos
    // mientras carga la cuenta nueva (o cuando la nueva no tiene viaje).
    setConfig(null);
    setConfigStatus("loading");
    setTrip(null);
    setTripStatus("idle");
    setIntents([]);
    setIntentsStatus("loading");
    setError(null);

    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const { signal } = controller;

    const load = async () => {
      setLoading(true);
      setConfigStatus("loading");
      setIntentsStatus("loading");
      setTripStatus(isTraveler ? "loading" : "idle");
      setError(null);

      const failures: string[] = [];

      try {
        const headers = await authHeaders();
        if (cancelled) return;

        const [configResult, intentsResult, tripResult] = await Promise.allSettled([
          fetch(`${apiBase}/api/payments/config`, { headers, credentials: "include", signal }),
          fetch(`${apiBase}/api/payments/intents`, { headers, credentials: "include", signal }),
          isTraveler
            ? fetch(`${apiBase}/api/trips/latest`, { headers, credentials: "include", signal })
            : Promise.resolve(null),
        ]);

        if (cancelled) return;

        // Configuración: el contrato mínimo exige `sandbox` booleano. Si no
        // llega, no podemos afirmar en qué modo está la pasarela.
        if (configResult.status === "fulfilled") {
          const res = configResult.value;
          const data = await readJson(res);
          if (cancelled) return;
          const sandbox =
            data && typeof data === "object"
              ? (data as { sandbox?: unknown }).sandbox
              : undefined;
          if (res.ok && typeof sandbox === "boolean") {
            const payload = data as Partial<PaymentConfig>;
            setConfig({
              provider: typeof payload.provider === "string" ? payload.provider : "",
              mode: typeof payload.mode === "string" ? payload.mode : "",
              sandbox,
              note: typeof payload.note === "string" ? payload.note : "",
            });
            setConfigStatus("ready");
          } else {
            setConfigStatus("error");
            failures.push("No se pudo cargar la configuración de pagos.");
          }
        } else {
          setConfigStatus("error");
          failures.push("No se pudo cargar la configuración de pagos.");
        }

        // Pagos recientes: el contrato mínimo exige un array `intents`. Una
        // lista vacía solo es válida si la respuesta cumple ese contrato.
        if (intentsResult.status === "fulfilled") {
          const res = intentsResult.value;
          const data = await readJson(res);
          if (cancelled) return;
          const list =
            data && typeof data === "object" && Array.isArray((data as { intents?: unknown }).intents)
              ? (data as { intents: unknown[] }).intents
              : null;
          if (res.ok && list) {
            setIntents(
              list.filter((item): item is PaymentIntent => Boolean(item) && typeof item === "object"),
            );
            setIntentsStatus("ready");
          } else {
            setIntentsStatus("error");
            failures.push("No se pudieron cargar tus pagos recientes.");
          }
        } else {
          setIntentsStatus("error");
          failures.push("No se pudieron cargar tus pagos recientes.");
        }

        // Ruta: un 404 es una respuesta legítima (no hay viaje). Cualquier
        // otro fallo se muestra como error, no como “sin ruta pendiente”.
        if (isTraveler) {
          if (tripResult.status === "fulfilled" && tripResult.value) {
            const res = tripResult.value;
            if (res.status === 404) {
              setTrip(null);
              setTripStatus("ready");
            } else {
              const data = await readJson(res);
              if (cancelled) return;
              const tripPayload =
                data && typeof data === "object" ? (data as { trip?: unknown }).trip : undefined;
              if (res.ok && tripPayload && typeof tripPayload === "object") {
                setTrip(tripPayload as TripDto);
                setTripStatus("ready");
              } else if (res.ok && tripPayload === null) {
                setTrip(null);
                setTripStatus("ready");
              } else {
                setTripStatus("error");
                failures.push("No se pudo cargar tu ruta.");
              }
            }
          } else {
            setTripStatus("error");
            failures.push("No se pudo cargar tu ruta.");
          }
        }

        if (!cancelled) setError(failures.length ? failures.join(" ") : null);
      } catch {
        if (!cancelled) {
          setConfigStatus("error");
          setIntentsStatus("error");
          if (isTraveler) setTripStatus("error");
          setError("No se pudo cargar la información de pagos.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [user?.username, isTraveler, reloadKey]);

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

      <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
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

        {configStatus === "ready" && config ? (
          <div
            className={`flex items-start gap-2 rounded-2xl border p-3 text-[11px] ${
              config.sandbox
                ? "border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-100"
                : "border-emerald-500/25 bg-emerald-500/5 text-emerald-900 dark:text-emerald-100"
            }`}
          >
            {config.sandbox ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p>
              <strong>{config.sandbox ? "Modo sandbox." : "Modo producción."}</strong>{" "}
              {config.sandbox
                ? "Los pagos son simulados: no se cobra dinero real. Puedes confirmar el sandbox desde el panel de la ruta."
                : "Los pagos se procesan en Wompi y se confirman únicamente por webhook firmado."}{" "}
              {config.note || "Los datos bancarios se capturan solo en la pasarela."}
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl border border-border/40 bg-secondary/10 p-3 text-[11px] text-muted-foreground">
            {configStatus === "loading" ? (
              <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p>
              <strong>
                {configStatus === "loading"
                  ? "Comprobando el modo de pago."
                  : "Estado de pago no disponible."}
              </strong>{" "}
              {configStatus === "loading"
                ? "Confirmando con el servidor si la pasarela está en sandbox o en producción."
                : "No pudimos confirmar si la pasarela está en sandbox o en producción, así que no mostramos ningún aviso de modo."}
            </p>
          </div>
        )}

        {error && (
          <div className="flex flex-wrap items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{error}</span>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={() => {
                setError(null);
                setReloadKey((key) => key + 1);
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Reintentar
            </Button>
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

        {isTraveler && tripStatus === "ready" && !routedTrip && (
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
          ) : intentsStatus === "error" ? (
            <p className="py-3 text-xs text-muted-foreground">
              No se pudieron cargar tus pagos recientes. Usa “Reintentar” para volver a intentarlo.
            </p>
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

        <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-[11px] text-emerald-900/90 dark:text-emerald-100/90">
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
      </main>
    </div>
  );
}
