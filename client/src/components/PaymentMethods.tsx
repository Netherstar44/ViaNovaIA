import { apiBase } from "@/lib/queryClient";
import { authHeaders } from "@/lib/secureStorage";
import { useEffect, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, Trash2, Star, Loader2, Banknote, Smartphone, CreditCard,
  Check, QrCode, KeyRound, Landmark, ShieldCheck, LockKeyhole,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

type PaymentTypeConfig = {
  value: string;
  label: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  description: string;
  detailsLabel?: string;
  detailsPlaceholder?: string;
  detailsMaxLength?: number;
  detailsHint?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "url";
};

const PAYMENT_TYPES: PaymentTypeConfig[] = [
  {
    value: "wompi",
    label: "Wompi",
    icon: <ShieldCheck className="h-5 w-5" />,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    description: "Tarjeta, PSE, Nequi o QR en la pasarela",
  },
  {
    value: "card",
    label: "Tarjeta",
    icon: <CreditCard className="h-5 w-5" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    description: "Visa, Mastercard o Amex nacional/internacional",
    detailsLabel: "Últimos 4 dígitos",
    detailsPlaceholder: "Ej: 4242",
    detailsMaxLength: 4,
    detailsHint: "Nunca guardamos el número completo ni el CVV.",
    inputMode: "numeric",
  },
  {
    value: "pse",
    label: "PSE",
    icon: <Landmark className="h-5 w-5" />,
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
    description: "Débito bancario nacional",
    detailsLabel: "Banco (opcional)",
    detailsPlaceholder: "Ej: Bancolombia",
    detailsMaxLength: 60,
    detailsHint: "No pidas ni ingreses números de cuenta.",
  },
  {
    value: "qr",
    label: "QR de pago",
    icon: <QrCode className="h-5 w-5" />,
    color: "text-violet-400",
    bgColor: "bg-violet-500/10 border-violet-500/20",
    description: "Enlace HTTPS del QR de tu pasarela",
    detailsLabel: "URL del QR",
    detailsPlaceholder: "https://checkout.wompi.co/...",
    detailsMaxLength: 500,
    detailsHint: "Solo se muestra a ti. No compartas QR bancarios por chat.",
    inputMode: "url",
  },
  {
    value: "breb",
    label: "Llave Bre-B",
    icon: <KeyRound className="h-5 w-5" />,
    color: "text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    description: "Celular, correo o llave alfanumérica",
    detailsLabel: "Llave Bre-B",
    detailsPlaceholder: "3001234567, correo o llave",
    detailsMaxLength: 64,
    detailsHint: "Se guarda cifrada y solo se muestra enmascarada.",
    inputMode: "text",
  },
  {
    value: "nequi",
    label: "Nequi",
    icon: <Smartphone className="h-5 w-5" />,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    description: "Celular asociado a Nequi",
    detailsLabel: "Número de celular",
    detailsPlaceholder: "Ej: 3001234567",
    detailsMaxLength: 16,
    detailsHint: "Solo se guarda el número, cifrado.",
    inputMode: "tel",
  },
  {
    value: "daviplata",
    label: "Daviplata",
    icon: <Smartphone className="h-5 w-5" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    description: "Celular asociado a Daviplata",
    detailsLabel: "Número de celular",
    detailsPlaceholder: "Ej: 3001234567",
    detailsMaxLength: 16,
    detailsHint: "Solo se guarda el número, cifrado.",
    inputMode: "tel",
  },
  {
    value: "cash",
    label: "Efectivo",
    icon: <Banknote className="h-5 w-5" />,
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    description: "Pago presencial, sin datos bancarios",
  },
];

const PROVIDER_ROLES = new Set(["hotel", "restaurant", "recreation", "taxi", "translator"]);

interface PaymentMethodsProps {
  username: string;
  role?: string;
  compact?: boolean;
  onSelect?: (method: any) => void;
}

export default function PaymentMethods({ username, role, compact = false, onSelect }: PaymentMethodsProps) {
  const { toast } = useToast();
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addDetails, setAddDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isProvider = Boolean(role && PROVIDER_ROLES.has(role));
  const typeConfig = PAYMENT_TYPES.find((t) => t.value === addType);

  const fetchMethods = async () => {
    try {
      const res = await fetch(`${apiBase}/api/payment-methods/${encodeURIComponent(username)}`, {
        headers: await authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudieron cargar los métodos");
      setMethods(data.methods || []);
    } catch {
      setMethods([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchMethods(); }, [username]);

  const handleAdd = async () => {
    if (!addType || !addLabel.trim()) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiBase + "/api/payment-methods", {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          username,
          type: addType,
          label: addLabel.trim(),
          details: addDetails.trim() || null,
          isDefault: methods.length === 0,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar el método");
      toast({ title: "Método de pago agregado" });
      setShowAdd(false);
      setAddType("");
      setAddLabel("");
      setAddDetails("");
      await fetchMethods();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/api/payment-methods/${id}`, {
        method: "DELETE",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error("No se pudo eliminar");
      toast({ title: "Método eliminado" });
      await fetchMethods();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`${apiBase}/api/payment-methods/${id}/default`, {
        method: "PATCH",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ username }),
      });
      if (!res.ok) throw new Error("No se pudo marcar como predeterminado");
      await fetchMethods();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const getTypeConfig = (type: string) => PAYMENT_TYPES.find((t) => t.value === type);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {isProvider ? "Métodos de cobro" : "Métodos de pago"}
              </h3>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isProvider
                ? "Vincula QR, Bre-B, PSE o tarjeta para recibir pagos. Los datos bancarios nunca se comparten."
                : "Elige cómo pagar tus rutas. La pasarela procesa los datos bancarios; VIANova no los ve."}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdd(!showAdd)}
            className="gap-1.5 text-primary hover:text-primary/80"
          >
            <Plus className="h-4 w-4" />
            Agregar
          </Button>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-[11px] text-emerald-200/90">
        <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Privacidad primero:</strong> no guardamos números de tarjeta completos, CVV,
          cuentas bancarias ni el contenido de un QR. Solo referencias enmascaradas y cifradas.
        </p>
      </div>

      <div className="space-y-2">
        {methods.length === 0 && !showAdd ? (
          <div className="text-center py-6 bg-secondary/20 rounded-xl border border-border/30">
            <Wallet className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No tienes métodos de pago</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdd(true)}
              className="mt-2 gap-1 text-primary"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar uno
            </Button>
          </div>
        ) : (
          methods.map((m) => {
            const config = getTypeConfig(m.type);
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                  onSelect ? "hover:border-primary/40 hover:bg-primary/5" : ""
                } ${config?.bgColor || "bg-secondary/20 border-border/30"}`}
                onClick={() => onSelect?.(m)}
              >
                <div className={`p-2 rounded-lg ${config?.color}`}>
                  {config?.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{m.label}</p>
                    {m.isDefault === "true" && (
                      <span className="text-[10px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-semibold">
                        Predeterminado
                      </span>
                    )}
                  </div>
                  {m.details && (
                    <p className="text-xs text-muted-foreground truncate">{m.details}</p>
                  )}
                </div>
                {!compact && (
                  <div className="flex items-center gap-1">
                    {m.isDefault !== "true" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); void handleSetDefault(m.id); }}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Marcar como predeterminado"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); void handleRemove(m.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-secondary/20 border border-border/30 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold">Nuevo método de pago</p>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
                {PAYMENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setAddType(t.value);
                      setAddLabel(t.label);
                      setAddDetails("");
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      addType === t.value
                        ? "border-primary/40 bg-primary/10 ring-1 ring-primary/20"
                        : "border-border/30 bg-secondary/20 hover:border-border/50"
                    }`}
                  >
                    <span className={t.color}>{t.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold">{t.label}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t.description}</p>
                    </div>
                    {addType === t.value && (
                      <Check className="h-3.5 w-3.5 text-primary ml-auto shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              {addType && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                  <input
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    placeholder="Nombre (ej: Mi Nequi)"
                    maxLength={60}
                    className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40"
                  />
                  {typeConfig?.detailsLabel && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">
                        {typeConfig.detailsLabel}
                      </label>
                      <input
                        value={addDetails}
                        onChange={(e) => setAddDetails(e.target.value)}
                        placeholder={typeConfig.detailsPlaceholder}
                        maxLength={typeConfig.detailsMaxLength}
                        inputMode={typeConfig.inputMode}
                        className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40"
                      />
                      {typeConfig.detailsHint && (
                        <p className="text-[10px] text-muted-foreground">{typeConfig.detailsHint}</p>
                      )}
                    </div>
                  )}
                </motion.div>
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowAdd(false); setAddType(""); setAddLabel(""); setAddDetails(""); }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={submitting || !addType || !addLabel.trim()}
                  className="flex-1 bg-primary text-primary-foreground gap-1"
                >
                  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  Agregar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {compact && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full py-2 text-xs text-primary hover:text-primary/80 flex items-center justify-center gap-1 transition-colors"
        >
          <Plus className="h-3 w-3" /> Agregar método de pago
        </button>
      )}
    </div>
  );
}
