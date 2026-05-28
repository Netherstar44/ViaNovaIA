// ─────────────────────────────────────────────────────────────────────────────
// client/src/components/taxi/StatsBar.tsx
// Barra de estadísticas rápidas del taxista
// ─────────────────────────────────────────────────────────────────────────────

import { TrendingUp, CheckCircle, Clock, Banknote } from "lucide-react";
import type { Ride } from "@shared/taxi.schema";

interface StatsBarProps {
  rideHistory: Ride[];
  totalEarned: number;
  available: number;
}

export function StatsBar({ rideHistory, totalEarned, available }: StatsBarProps) {
  const todayRides = rideHistory.filter((r) => {
    const d = new Date(r.completedAt ?? r.createdAt!);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
  });

  const todayEarnings = todayRides.reduce((acc, r) => acc + r.fare, 0);

  const stats = [
    {
      icon: <CheckCircle className="h-4 w-4 text-green-400" />,
      label: "Viajes hoy",
      value: todayRides.length.toString(),
      bg: "bg-green-500/10",
    },
    {
      icon: <TrendingUp className="h-4 w-4 text-primary" />,
      label: "Hoy",
      value: todayEarnings.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }),
      bg: "bg-primary/10",
    },
    {
      icon: <Banknote className="h-4 w-4 text-blue-400" />,
      label: "Disponible",
      value: available.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }),
      bg: "bg-blue-500/10",
    },
    {
      icon: <Clock className="h-4 w-4 text-purple-400" />,
      label: "Total histórico",
      value: rideHistory.length.toString() + " viajes",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-card border border-border/50 rounded-2xl p-4 flex items-center gap-3"
        >
          <div className={`p-2 rounded-xl ${s.bg}`}>{s.icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground truncate">{s.label}</p>
            <p className="font-bold text-sm truncate">{s.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
