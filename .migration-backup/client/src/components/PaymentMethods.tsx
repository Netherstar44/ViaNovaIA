import { apiBase } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet, Plus, Trash2, Star, Loader2,
  Banknote, Smartphone, CreditCard, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PAYMENT_TYPES = [
  {
    value: "cash",
    label: "Efectivo",
    icon: <Banknote className="h-5 w-5" />,
    color: "text-green-400",
    bgColor: "bg-green-500/10 border-green-500/20",
    description: "Pago en efectivo al conductor",
  },
  {
    value: "nequi",
    label: "Nequi",
    icon: <Smartphone className="h-5 w-5" />,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10 border-purple-500/20",
    description: "Transferencia por Nequi",
  },
  {
    value: "daviplata",
    label: "Daviplata",
    icon: <Smartphone className="h-5 w-5" />,
    color: "text-red-400",
    bgColor: "bg-red-500/10 border-red-500/20",
    description: "Transferencia por Daviplata",
  },
  {
    value: "card",
    label: "Tarjeta",
    icon: <CreditCard className="h-5 w-5" />,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    description: "Tarjeta débito o crédito",
  },
];

interface PaymentMethodsProps {
  username: string;
  compact?: boolean; // compact mode for inside order panel
  onSelect?: (method: any) => void;
}

export default function PaymentMethods({ username, compact = false, onSelect }: PaymentMethodsProps) {
  const { toast } = useToast();
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState("");
  const [addLabel, setAddLabel] = useState("");
  const [addDetails, setAddDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchMethods = async () => {
    try {
      const res = await fetch(`${apiBase}/api/payment-methods/${username}`);
      const data = await res.json();
      setMethods(data.methods || []);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMethods(); }, [username]);

  const handleAdd = async () => {
    if (!addType || !addLabel.trim()) {
      toast({ title: "Completa todos los campos", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiBase + "/api/payment-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          type: addType,
          label: addLabel.trim(),
          details: addDetails.trim() || null,
          isDefault: methods.length === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Método de pago agregado" });
      setShowAdd(false);
      setAddType("");
      setAddLabel("");
      setAddDetails("");
      fetchMethods();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await fetch(`${apiBase}/api/payment-methods/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      toast({ title: "Método eliminado" });
      fetchMethods();
    } catch {}
  };

  const handleSetDefault = async (id: string) => {
    try {
      await fetch(`${apiBase}/api/payment-methods/${id}/default`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      fetchMethods();
    } catch {}
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
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Métodos de Pago</h3>
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

      {/* Methods list */}
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
                        onClick={(e) => { e.stopPropagation(); handleSetDefault(m.id); }}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Marcar como predeterminado"
                      >
                        <Star className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemove(m.id); }}
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

      {/* Add form */}
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

              {/* Type selector */}
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setAddType(t.value);
                      if (!addLabel) setAddLabel(t.label);
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
                    className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40"
                  />
                  {(addType === "nequi" || addType === "daviplata") && (
                    <input
                      value={addDetails}
                      onChange={(e) => setAddDetails(e.target.value)}
                      placeholder="Número de teléfono"
                      className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40"
                    />
                  )}
                  {addType === "card" && (
                    <input
                      value={addDetails}
                      onChange={(e) => setAddDetails(e.target.value)}
                      placeholder="Últimos 4 dígitos de la tarjeta"
                      maxLength={4}
                      className="w-full bg-background/50 border border-border/40 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/40"
                    />
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

      {/* Compact add button */}
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
