import { apiBase } from "@/lib/queryClient";
import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft, TrendingUp, Banknote, Clock, Car,
  ArrowDownCircle, BarChart3, CheckCircle, XCircle,
  AlertCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Earning, Withdrawal } from "@shared/taxi.schema";

interface EarningsResponse {
  totalEarned: number;
  totalWithdrawn: number;
  totalPendingWithdrawn: number;
  available: number;
  earnings: Earning[];
  withdrawals: Withdrawal[];
}

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const statusConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending:   { label: "En proceso",  icon: <Clock className="h-3 w-3" />,       className: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  completed: { label: "Completado",  icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-500/15 text-green-400 border-green-500/20" },
  rejected:  { label: "Rechazado",   icon: <XCircle className="h-3 w-3" />,     className: "bg-destructive/15 text-destructive border-destructive/20" },
};

export default function TaxiEarnings() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [amount, setAmount] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  // All hooks must be called unconditionally (React Rules of Hooks)
  const username = user?.username ?? "";

  const { data, isLoading } = useQuery<EarningsResponse>({
    queryKey: ["taxi", "earnings", username],
    queryFn: () => fetch(`${apiBase}/api/taxi/earnings/${username}`).then((r) => r.json()),
    refetchInterval: 30_000,
    enabled: !!username,
  });

  const available = data?.available ?? 0;
  const withdrawals = data?.withdrawals ?? [];

  const mutation = useMutation({
    mutationFn: async (payload: { taxiUsername: string; amount: number; bankAccount: string; notes?: string }) => {
      const res = await fetch(apiBase + "/api/taxi/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Error al solicitar retiro");
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taxi", "earnings"] });
      setAmount(""); setBankAccount(""); setNotes(""); setFormError("");
      setShowWithdrawForm(false);
      toast({ title: "✅ Solicitud enviada", description: "Tu retiro está siendo procesado." });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // Redirect AFTER all hooks
  if (!user) { setLocation("/login"); return null; }

  const handleSubmit = () => {
    setFormError("");
    const num = parseFloat(amount.replace(/\D/g, ""));
    if (!amount || isNaN(num) || num <= 0) { setFormError("Ingresa un monto válido"); return; }
    if (num > available) { setFormError(`Supera tu saldo disponible (${fmt(available)})`); return; }
    if (num < 10000) { setFormError("Mínimo $10.000 COP"); return; }
    if (!bankAccount.trim() || bankAccount.trim().length < 5) { setFormError("Número de cuenta inválido"); return; }
    mutation.mutate({ taxiUsername: user.username, amount: num, bankAccount: bankAccount.trim(), notes: notes.trim() || undefined });
  };

  const summaryCards = [
    { icon: <TrendingUp className="h-4 w-4 text-primary" />, label: "Total Ganado", value: data?.totalEarned ?? 0, bg: "from-primary/10 to-primary/5", border: "border-primary/20" },
    { icon: <Banknote className="h-4 w-4 text-green-400" />, label: "Disponible", value: available, bg: "from-green-500/10 to-green-500/5", border: "border-green-500/20" },
    { icon: <ArrowDownCircle className="h-4 w-4 text-blue-400" />, label: "Retirado", value: data?.totalWithdrawn ?? 0, bg: "from-blue-500/10 to-blue-500/5", border: "border-blue-500/20" },
    { icon: <Clock className="h-4 w-4 text-orange-400" />, label: "En proceso", value: data?.totalPendingWithdrawn ?? 0, bg: "from-orange-500/10 to-orange-500/5", border: "border-orange-500/20" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="w-full max-w-[1400px] mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-5">

        <button onClick={() => setLocation("/taxi-dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver al dashboard
        </button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold font-heading flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" /> Mis Ganancias
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">{user.name || user.username}</p>
          </div>
          <Button
            onClick={() => setShowWithdrawForm(!showWithdrawForm)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2"
          >
            <ArrowDownCircle className="h-4 w-4" />
            {showWithdrawForm ? "Cancelar" : "Retirar"}
          </Button>
        </div>

        {/* Resumen */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 xl:gap-4">
          {summaryCards.map((c) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-2xl p-4`}
            >
              {isLoading ? <Skeleton className="h-12 w-full" /> : (
                <>
                  <div className="flex items-center gap-1.5 mb-2">{c.icon}<span className="text-xs text-muted-foreground">{c.label}</span></div>
                  <p className="text-lg font-bold">{fmt(c.value)}</p>
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* Formulario de retiro (desplegable) */}
        <AnimatePresenceWrapper show={showWithdrawForm}>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Nueva Solicitud de Retiro</h2>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Disponible</p>
                  <p className="text-lg font-bold text-primary">{fmt(available)}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Monto a retirar (COP)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input type="number" min={10000} max={available} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Ej: 50000" className="pl-7 bg-secondary/30 border-border/50 rounded-xl focus:border-primary" />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Mínimo: $10.000</span>
                    <button onClick={() => setAmount(available.toString())} className="text-primary hover:underline">Usar máximo</button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm">Número de cuenta bancaria</Label>
                  <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="Ej: Bancolombia 1234567890" className="bg-secondary/30 border-border/50 rounded-xl focus:border-primary" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">Notas <span className="text-muted-foreground">(opcional)</span></Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: Nequi, nombre titular..." className="bg-secondary/30 border-border/50 rounded-xl focus:border-primary" />
              </div>

              {formError && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />{formError}
                </div>
              )}

              <Button onClick={handleSubmit} disabled={mutation.isPending || available <= 0} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold h-11">
                {mutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Procesando...</> : <><ArrowDownCircle className="h-4 w-4 mr-2" />Solicitar Retiro</>}
              </Button>
            </div>
          </motion.div>
        </AnimatePresenceWrapper>

        {/* Historial de viajes + retiros en grid para pantallas grandes */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Historial de viajes */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Historial de Viajes Cobrados</h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : !data?.earnings?.length ? (
            <div className="bg-card border border-border/40 rounded-2xl p-8 text-center">
              <Car className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Aún no tienes ganancias registradas</p>
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-2xl divide-y divide-border/30 overflow-hidden">
              {data.earnings.map((e, idx) => (
                <motion.div key={e.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.04 }}
                  className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <Car className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">Viaje completado</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.createdAt!).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-primary">{fmt(e.amount)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Historial de retiros */}
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Historial de Retiros</h2>
          {isLoading ? (
            <div className="space-y-2">{[1,2].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
          ) : !withdrawals.length ? (
            <div className="bg-card border border-border/40 rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Aún no has realizado retiros</p>
            </div>
          ) : (
            <div className="bg-card border border-border/50 rounded-2xl divide-y divide-border/30 overflow-hidden">
              {withdrawals.map((w, idx) => {
                const sc = statusConfig[w.status] ?? statusConfig.pending;
                return (
                  <motion.div key={w.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.05 }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <ArrowDownCircle className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{w.bankAccount || "Cuenta bancaria"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(w.createdAt!).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`text-xs ${sc.className} flex items-center gap-1`}>{sc.icon}{sc.label}</Badge>
                      <span className="text-sm font-bold">{fmt(w.amount)}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        </div>{/* cierre del grid xl:grid-cols-2 */}

      </div>
    </div>
  );
}

// Helper para AnimatePresence
function AnimatePresenceWrapper({ show, children }: { show: boolean; children: React.ReactNode }) {
  return <AnimatePresence>{show && children}</AnimatePresence>;
}