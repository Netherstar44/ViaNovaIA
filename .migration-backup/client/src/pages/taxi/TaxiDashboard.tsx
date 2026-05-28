import { apiBase } from "@/lib/queryClient";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import { Car, DollarSign, WifiOff, MapPin, RefreshCw, ChevronRight } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { useTaxiDashboard } from "@/hooks/useTaxiDashboard";
import { RideCard } from "@/components/taxi/RideCard";
import { ActiveRidePanel } from "@/components/taxi/ActiveRidePanel";
import TaxiMap from "@/components/taxi/TaxiMap";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function TaxiDashboard() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();

  // All hooks must be called unconditionally (React Rules of Hooks)
  const username = user?.username ?? "";

  const {
    isAvailable, pendingRides, activeRide, rideHistory, profile,
    loadingNearby, loadingActive,
    toggleAvailability, acceptRide, rejectRide, startRide, completeRide,
    isAccepting, isRejecting, isStarting, isCompleting,
    justCompletedRide, clearCompletedRide
  } = useTaxiDashboard(username);

  const { data: earningsData } = useQuery({
    queryKey: ["taxi", "earnings", username],
    queryFn: () => fetch(`${apiBase}/api/taxi/earnings/${username}`).then((r) => r.json()),
    refetchInterval: 30_000,
    enabled: !!username,
  });

  const todayEarnings = earningsData?.earnings
    ?.filter((e: any) => new Date(e.createdAt).toDateString() === new Date().toDateString())
    ?.reduce((acc: number, e: any) => acc + e.amount, 0) ?? 0;

  // Redirects AFTER all hooks
  if (!user) { setLocation("/login"); return null; }
  if (user.role !== "taxi") { setLocation("/"); return null; }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />

      <div className="flex-1 w-full max-w-[1600px] mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-4">

        {/* ── Header ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <Car className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold font-heading leading-tight">Panel del Taxista</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                {user.name || user.username}
                {profile?.plate && (
                  <span className="inline-flex items-center gap-1 bg-secondary px-1.5 py-0.5 rounded text-xs">
                    <MapPin className="h-2.5 w-2.5" />{profile.plate}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl border transition-all ${
            isAvailable
              ? "bg-green-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]"
              : "bg-secondary/50 border-border/50"
          }`}>
            <div className={`w-2 h-2 rounded-full ${isAvailable ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
            <span className="text-sm font-semibold">{isAvailable ? "Disponible" : "No disponible"}</span>
            <Switch checked={isAvailable} onCheckedChange={toggleAvailability} className="data-[state=checked]:bg-green-500" />
          </div>
        </motion.div>

        {/* ── Stats rápidas + Datos del vehículo ────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-5 gap-3 xl:gap-4"
        >
          {/* Vehicle Info Card */}
          <div className="col-span-2 sm:col-span-1 bg-card border border-border/40 rounded-2xl p-4 text-left relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full -z-10 transition-transform group-hover:scale-110" />
            <div className="flex items-center gap-2 mb-2">
              <Car className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground font-semibold">Mi Vehículo</span>
            </div>
            {profile?.vehicleType || profile?.plate ? (
              <div className="space-y-1">
                {profile.vehicleType && <p className="text-sm font-bold text-foreground">{profile.vehicleType}</p>}
                {profile.plate && (
                  <p className="text-xs font-mono font-bold bg-secondary text-foreground border border-border/50 px-1.5 py-0.5 rounded inline-block">{profile.plate}</p>
                )}
                {profile.phone && <p className="text-[10px] text-muted-foreground mt-0.5">{profile.phone}</p>}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sin configurar</p>
            )}
          </div>

          {[
            { label: "Viajes hoy", value: rideHistory.filter((r: any) => new Date(r.completedAt ?? r.createdAt).toDateString() === new Date().toDateString()).length, suffix: "", icon: "✅" },
            { label: "Hoy", value: todayEarnings, suffix: "", isMoney: true, icon: "📈" },
            { label: "Disponible", value: earningsData?.available ?? 0, suffix: "", isMoney: true, icon: "💳" },
            { label: "Total histórico", value: rideHistory.length, suffix: " viajes", icon: "🕐" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setLocation("/taxi/earnings")}
              className="bg-card border border-border/40 rounded-2xl p-4 text-left hover:border-primary/40 hover:bg-card/80 transition-all group shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base grayscale group-hover:grayscale-0 transition-all">{s.icon}</span>
                <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                {s.isMoney ? fmt(s.value as number) : `${s.value}${s.suffix}`}
              </p>
            </button>
          ))}
        </motion.div>

        {/* ── Layout principal: Mapa + Solicitudes ─────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 xl:gap-6">

          {/* Mapa — ocupa 2/3 en desktop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 h-[380px] sm:h-[440px] lg:h-[520px] xl:h-[600px] rounded-2xl border border-border/50 overflow-hidden shadow-lg relative"
          >
            <TaxiMap
              isAvailable={isAvailable}
              activeRide={activeRide ? {
                id: Number(activeRide.id),
                passengerName: (activeRide as any).passengerName || activeRide.travelerUsername,
                originCoords: [parseFloat(activeRide.originLat), parseFloat(activeRide.originLng)] as [number, number],
                destinationCoords: [parseFloat(activeRide.destinationLat), parseFloat(activeRide.destinationLng)] as [number, number],
                originAddress: activeRide.originAddress ?? "",
                destinationAddress: activeRide.destinationAddress,
                status: activeRide.status,
              } : null}
              nearbyPassengers={pendingRides.map((r: any) => ({
                id: String(r.id),
                name: r.passengerName || "Viajero",
                coords: [parseFloat(r.originLat), parseFloat(r.originLng)] as [number, number],
                origin: r.originAddress ?? "",
                destination: r.destinationAddress,
              }))}
            />
          </motion.div>

          {/* Solicitudes cercanas — 1/3 en desktop */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Solicitudes
              </h2>
              <div className="flex items-center gap-2">
                {pendingRides.length > 0 && (
                  <Badge className="bg-primary/15 text-primary border-primary/20 text-xs">{pendingRides.length}</Badge>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" /> 5s
                </span>
              </div>
            </div>

            {!isAvailable && (
              <div className="bg-secondary/30 border border-border/30 rounded-xl p-3 flex items-center gap-2 text-xs text-muted-foreground">
                <WifiOff className="h-3.5 w-3.5 shrink-0" />
                Activa disponibilidad para ver solicitudes
              </div>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto max-h-[360px] lg:max-h-[440px] xl:max-h-[520px] pr-0.5 scrollbar-thin">
              {loadingNearby ? (
                [1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)
              ) : pendingRides.length === 0 ? (
                <div className="bg-card border border-border/40 rounded-2xl p-6 text-center h-full flex flex-col items-center justify-center gap-2">
                  <span className="text-3xl">🚖</span>
                  <p className="text-xs text-muted-foreground">
                    {isAvailable ? "Sin solicitudes por ahora" : "No disponible"}
                  </p>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {pendingRides.map((ride: any) => (
                    <RideCard
                      key={ride.id}
                      ride={ride}
                      onAccept={acceptRide}
                      onReject={rejectRide}
                      isAccepting={isAccepting}
                      isRejecting={isRejecting}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </div>

        {/* ── Viaje Activo o Completado ────────────────────────────── */}
        {(loadingActive || activeRide || justCompletedRide) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {justCompletedRide ? "Viaje Completado" : "Viaje Activo"}
            </h2>
            {loadingActive ? (
              <Skeleton className="h-48 rounded-2xl" />
            ) : (
              <ActiveRidePanel
                ride={(activeRide || justCompletedRide)!}
                onStart={startRide}
                onComplete={completeRide}
                isStarting={isStarting}
                isCompleting={isCompleting}
                onDismiss={clearCompletedRide}
              />
            )}
          </motion.div>
        )}

        {/* ── Historial reciente + acceso a ganancias ───────────── */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Últimos Viajes
            </h2>
            <motion.button
              onClick={() => setLocation("/taxi/earnings")}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white
                bg-primary text-primary-foreground
                shadow-[0_0_20px_rgba(var(--primary-rgb,99,102,241),0.35)]
                hover:shadow-[0_0_30px_rgba(var(--primary-rgb,99,102,241),0.5)]
                transition-all duration-300 overflow-hidden group"
            >
              {/* shimmer sweep */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />
              <DollarSign className="h-4 w-4" />
              Ver mis ganancias
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </motion.button>
          </div>

          {rideHistory.length === 0 ? (
            <div className="bg-card border border-border/40 rounded-2xl p-6 text-center">
              <p className="text-sm text-muted-foreground">Aún no tienes viajes completados</p>
            </div>
          ) : (
            <>
              <div className="bg-card border border-border/50 rounded-2xl divide-y divide-border/30 overflow-hidden">
                {rideHistory.slice(0, 5).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center gap-3">
                      <Car className="h-3.5 w-3.5 text-green-400" />
                      <div>
                        <p className="text-sm font-medium">{r.destinationAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.completedAt ?? r.createdAt).toLocaleDateString("es-CO", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          })}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {fmt(r.fare)}
                    </span>
                  </div>
                ))}
              </div>
              {rideHistory.length > 5 && (
                <motion.button
                  onClick={() => setLocation("/ride-history")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-3 py-2.5 text-sm font-semibold text-primary bg-primary/5 border border-primary/20 rounded-xl hover:bg-primary/10 transition-colors"
                >
                  Ver historial completo ({rideHistory.length} viajes)
                </motion.button>
              )}
            </>
          )}
        </motion.div>

      </div>
    </div>
  );
}