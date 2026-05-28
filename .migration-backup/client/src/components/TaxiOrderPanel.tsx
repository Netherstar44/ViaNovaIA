import { apiBase } from "@/lib/queryClient";
// ─────────────────────────────────────────────────────────────────────────────
// TaxiOrderPanel.tsx
// Panel integrado para ordenar un taxi desde la previsualización de un local
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, MapPin, Navigation, Loader2, X, CheckCircle,
  Clock, Send, Ban, Route, Radar, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { LocationItem } from "@/data/mockData";
import TaxiProfile from "@/components/TaxiProfile";
import { ReviewForm } from "@/components/ReviewSystem";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const FARE_BASE = 5000;
const FARE_PER_KM = 3500;

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "User-Agent": "VIANova/1.0" } }
    );
    const data: any = await res.json();
    const a = data.address || {};
    const parts = [
      a.road || a.pedestrian || a.neighbourhood,
      a.suburb || a.city_district,
      a.city || a.town || a.village,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

// ── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: "Buscando taxista...",  color: "bg-orange-500/15 text-orange-400 border-orange-500/20", icon: <Clock className="h-4 w-4 animate-pulse" /> },
  accepted:    { label: "¡Taxi en camino!",     color: "bg-blue-500/15 text-blue-400 border-blue-500/20",     icon: <Car className="h-4 w-4" /> },
  in_progress: { label: "Viaje en curso",       color: "bg-green-500/15 text-green-400 border-green-500/20",  icon: <Navigation className="h-4 w-4" /> },
  completed:   { label: "Viaje completado",     color: "bg-primary/15 text-primary border-primary/20",        icon: <CheckCircle className="h-4 w-4" /> },
  cancelled:   { label: "Cancelado",            color: "bg-destructive/15 text-destructive border-destructive/20", icon: <X className="h-4 w-4" /> },
};

// ── Nearby taxi type ───────────────────────────────────────────────────────

export interface SimulatedTaxi {
  id: string;
  name: string;
  lat: number;
  lng: number;
  plate: string;
  vehicleType: string;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface TaxiOrderPanelProps {
  destination: LocationItem;
  userLocation: [number, number] | null;
  onClose: () => void;
  onRideCreated?: (rideId: string) => void;
  onTaxiRadarUpdate?: (taxis: SimulatedTaxi[]) => void;
  onRouteReady?: (route: [number, number][], distanceKm: number, durationMin: number) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TaxiOrderPanel({
  destination,
  userLocation,
  onClose,
  onRideCreated,
  onTaxiRadarUpdate,
  onRouteReady,
}: TaxiOrderPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const username = user?.username ?? "";

  const [phase, setPhase] = useState<"estimate" | "searching" | "tracking">("estimate");
  const [originAddress, setOriginAddress] = useState("Detectando ubicación...");
  const [rideId, setRideId] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<string>("pending");
  const [taxiDriver, setTaxiDriver] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [simulatedTaxis, setSimulatedTaxis] = useState<SimulatedTaxi[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  // Calculate fare
  const distanceKm = userLocation
    ? haversineKm(userLocation, destination.coordinates)
    : 0;
  const displayDistance = routeInfo?.distanceKm ?? distanceKm;
  const fare = displayDistance > 0 ? Math.round((FARE_BASE + FARE_PER_KM * displayDistance) / 100) * 100 : 0;

  // Reverse geocode user location
  useEffect(() => {
    if (!userLocation) return;
    reverseGeocode(userLocation[0], userLocation[1]).then(setOriginAddress);
  }, [userLocation]);

  // Fetch OSRM route
  useEffect(() => {
    if (!userLocation) return;
    const [lat1, lng1] = userLocation;
    const [lat2, lng2] = destination.coordinates;

    fetch(
      `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=full&geometries=geojson`
    )
      .then((r) => r.json())
      .then((data) => {
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords: [number, number][] = route.geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] // GeoJSON is [lng, lat], Leaflet needs [lat, lng]
          );
          const km = route.distance / 1000;
          const min = Math.round(route.duration / 60);
          setRouteInfo({ distanceKm: Math.round(km * 10) / 10, durationMin: min });
          onRouteReady?.(coords, km, min);
        }
      })
      .catch(() => {
        // Fallback: no route, use haversine
      });
  }, [userLocation, destination.coordinates]);

  // Fetch real nearby taxis from API
  useEffect(() => {
    let cancelled = false;

    const fetchTaxis = async () => {
      try {
        const res = await fetch(apiBase + '/api/taxi/nearby');
        const data = await res.json();
        if (cancelled) return;
        const drivers: SimulatedTaxi[] = (data.drivers || [])
          .filter((d: any) => d.lat && d.lng)
          .map((d: any) => ({
            id: `taxi-${d.username}`,
            name: d.username,
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lng),
            plate: d.plate || 'N/A',
            vehicleType: d.vehicleType || 'Taxi',
          }));
        setSimulatedTaxis(drivers);
        onTaxiRadarUpdate?.(drivers);
      } catch {}
    };

    fetchTaxis();
    // Refresh every 8 seconds to track real driver movement
    const interval = setInterval(fetchTaxis, 8000);

    return () => { cancelled = true; clearInterval(interval); };
  }, [destination.coordinates]);

  // Poll ride status when we have a ride
  useEffect(() => {
    if (!rideId || !username) return;
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/rides/traveler/${username}`);
        const data = await res.json();
        
        if (data.activeRide && data.activeRide.id === rideId) {
          setRideStatus(data.activeRide.status);
          if (data.activeRide.taxiUsername) {
            setTaxiDriver(data.activeRide.taxiUsername);
          }
          // Auto-transition to tracking when accepted
          if (data.activeRide.status === 'accepted' && phase === 'searching') {
            setPhase('tracking');
            toast({
              title: '🚕 ¡Taxi confirmado!',
              description: `${data.activeRide.taxiUsername} aceptó tu carrera`,
            });
          }
        } else if (data.history) {
          // If the ride is no longer active, it might be in history (completed or cancelled)
          const historyRide = data.history.find((r: any) => r.id === rideId);
          if (historyRide) {
            setRideStatus(historyRide.status);
            if (historyRide.taxiUsername) {
              setTaxiDriver(historyRide.taxiUsername);
            }
            clearInterval(poll);
          }
        }
      } catch {}
    }, 4000);
    return () => clearInterval(poll);
  }, [rideId, username, phase, toast]);

  // ── Submit ride request ────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!userLocation) {
      toast({ title: "Ubicación no disponible", description: "Activa tu GPS para solicitar un taxi", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const body = {
        travelerUsername: username,
        originLat: userLocation[0].toString(),
        originLng: userLocation[1].toString(),
        originAddress,
        destinationLat: destination.coordinates[0].toString(),
        destinationLng: destination.coordinates[1].toString(),
        destinationAddress: destination.name,
        fare,
        distanceKm: Math.round(displayDistance * 10) / 10,
      };
      const res = await fetch(apiBase + "/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Error al crear solicitud");

      setRideId(data.ride.id);
      setPhase("searching");
      onRideCreated?.(data.ride.id);
      toast({ title: "🚕 Solicitud enviada", description: "Buscando taxistas cercanos..." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!rideId) return;
    setCancelling(true);
    try {
      await fetch(`${apiBase}/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      setRideStatus("cancelled");
      setPhase("estimate");
      setRideId(null);
      toast({ title: "Viaje cancelado" });
    } catch {} finally {
      setCancelling(false);
    }
  };

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="bg-card/95 backdrop-blur-2xl border border-border/50 rounded-3xl p-6 shadow-2xl space-y-5 relative overflow-hidden"
    >
      {/* Decorative radar circle */}
      <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/5 animate-pulse pointer-events-none" />
      <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-emerald-500/5 animate-pulse pointer-events-none" style={{ animationDelay: "1s" }} />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary/20 to-emerald-500/20 rounded-xl border border-primary/20">
            <Car className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-heading font-bold text-foreground">Ordenar Taxi</h3>
            <p className="text-xs text-muted-foreground">Ir a {destination.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-secondary/80 transition-colors text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Phase: ESTIMATE ── */}
      <AnimatePresence mode="wait">
        {phase === "estimate" && (
          <motion.div
            key="estimate"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4 relative z-10"
          >
            {/* Route info */}
            <div className="grid grid-cols-1 gap-3">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/30 border border-border/30">
                <span className="w-3 h-3 rounded-full bg-green-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tu ubicación</p>
                  <p className="text-sm font-medium text-foreground truncate">{originAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-secondary/30 border border-border/30">
                <span className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Destino</p>
                  <p className="text-sm font-medium text-foreground truncate">{destination.name}</p>
                </div>
              </div>
            </div>

            {/* Fare card */}
            {fare > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-gradient-to-br from-primary/10 to-emerald-500/5 border border-primary/20 rounded-2xl p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tarifa estimada</p>
                    <p className="text-2xl font-bold text-primary">{fmt(fare)}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Route className="h-3.5 w-3.5" />
                      <span>{displayDistance.toFixed(1)} km</span>
                    </div>
                    {routeInfo && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <Clock className="h-3.5 w-3.5" />
                        <span>~{routeInfo.durationMin} min</span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Radar indicator */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Radar className="h-4 w-4 text-emerald-400 animate-pulse" />
              <span>{simulatedTaxis.length} taxistas disponibles cerca</span>
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !userLocation || fare <= 0}
              className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-base
                shadow-[0_0_20px_rgba(255,215,0,0.3)]
                hover:shadow-[0_0_30px_rgba(255,215,0,0.5)]
                transition-all duration-300 gap-2"
            >
              {submitting ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Solicitando...</>
              ) : (
                <><Send className="h-5 w-5" /> Solicitar Taxi</>
              )}
            </Button>
          </motion.div>
        )}

        {/* ── Phase: SEARCHING ── */}
        {phase === "searching" && (
          <motion.div
            key="searching"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4 relative z-10"
          >
            <div className="flex flex-col items-center py-6 gap-4">
              {/* Animated radar */}
              <div className="relative w-24 h-24">
                <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
                <div className="absolute inset-2 rounded-full border-2 border-primary/20 animate-ping" style={{ animationDelay: "0.5s" }} />
                <div className="absolute inset-4 rounded-full border-2 border-primary/10 animate-ping" style={{ animationDelay: "1s" }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-[0_0_30px_rgba(255,215,0,0.4)]">
                    <Radar className="h-6 w-6 text-black" />
                  </div>
                </div>
              </div>

              <div className="text-center">
                <h4 className="text-lg font-bold text-foreground">Buscando taxistas cercanos...</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Enviando solicitud a {simulatedTaxis.length} conductores
                </p>
              </div>

              {/* Simulated taxi list */}
              <div className="w-full space-y-2 mt-2">
                {simulatedTaxis.slice(0, 3).map((taxi, i) => (
                  <motion.div
                    key={taxi.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.3 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/30 border border-border/30"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">🚕</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{taxi.name}</p>
                      <p className="text-[10px] text-muted-foreground">{taxi.vehicleType} · {taxi.plate}</p>
                    </div>
                    <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                  </motion.div>
                ))}
              </div>
            </div>

            <Button
              onClick={handleCancel}
              disabled={cancelling}
              variant="destructive"
              className="w-full rounded-xl gap-2"
            >
              <Ban className="h-4 w-4" />
              {cancelling ? "Cancelando..." : "Cancelar solicitud"}
            </Button>
          </motion.div>
        )}

        {/* ── Phase: TRACKING ── */}
        {phase === "tracking" && (
          <motion.div
            key="tracking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4 relative z-10"
          >
            {/* Status banner */}
            <div className={`flex items-center justify-between p-4 rounded-2xl border ${statusConfig[rideStatus]?.color ?? ""}`}>
              <div className="flex items-center gap-3">
                {statusConfig[rideStatus]?.icon}
                <div>
                  <p className="font-bold">{statusConfig[rideStatus]?.label}</p>
                  {taxiDriver && (
                    <p className="text-xs opacity-80">Conductor: {taxiDriver}</p>
                  )}
                </div>
              </div>
              <Badge className={statusConfig[rideStatus]?.color}>{rideStatus}</Badge>
            </div>

            {/* Driver profile card */}
            {taxiDriver && rideStatus !== "completed" && rideStatus !== "cancelled" && (
              <TaxiProfile username={taxiDriver} compact />
            )}

            {/* Ride info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-secondary/30 border border-border/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Destino
                </p>
                <p className="text-sm font-medium mt-0.5 truncate">{destination.name}</p>
              </div>
              <div className="p-3 rounded-xl bg-secondary/30 border border-border/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tarifa</p>
                <p className="text-lg font-bold text-primary">{fmt(fare)}</p>
              </div>
            </div>

            {/* Progress steps */}
            <div className="bg-secondary/20 rounded-2xl p-4 border border-border/20">
              <div className="flex items-center justify-between">
                {["pending", "accepted", "in_progress", "completed"].map((s, i) => {
                  const steps = ["pending", "accepted", "in_progress", "completed"];
                  const currentIdx = steps.indexOf(rideStatus);
                  const done = i <= currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-1.5 flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                        ${done ? "bg-primary text-black" : "bg-secondary text-muted-foreground"}`}>
                        {i + 1}
                      </div>
                      <span className={`text-[10px] hidden sm:inline ${done ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {["Pedido", "Aceptado", "En curso", "Listo"][i]}
                      </span>
                      {i < 3 && <div className={`flex-1 h-0.5 mx-1 ${done && i < currentIdx ? "bg-primary" : "bg-border"}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            {(rideStatus === "pending" || rideStatus === "accepted") && (
              <Button
                onClick={handleCancel}
                disabled={cancelling}
                variant="destructive"
                className="w-full rounded-xl gap-2"
              >
                <Ban className="h-4 w-4" />
                {cancelling ? "Cancelando..." : "Cancelar viaje"}
              </Button>
            )}

            {/* Review form after completed ride */}
            {rideStatus === "completed" && taxiDriver && rideId && !reviewSubmitted && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
                <ReviewForm
                  rideId={rideId}
                  authorUsername={username}
                  targetUsername={taxiDriver}
                  authorRole="traveler"
                  onSubmitted={() => setReviewSubmitted(true)}
                  onCancel={() => setReviewSubmitted(true)}
                />
              </motion.div>
            )}

            {/* Completed summary */}
            {rideStatus === "completed" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-green-500/10 via-card to-primary/5 border border-green-500/20 rounded-2xl p-5 text-center space-y-3"
              >
                <div className="text-3xl mb-1">🎉</div>
                <p className="text-lg font-bold">¡Viaje Completado!</p>
                <p className="text-2xl font-bold text-primary">{fmt(fare)}</p>
                <div className="flex gap-2">
                  <Button
                    onClick={() => { setPhase("estimate"); setRideId(null); setRideStatus("pending"); setTaxiDriver(null); setReviewSubmitted(false); }}
                    className="flex-1 rounded-xl gap-2 bg-primary text-black font-bold"
                  >
                    <Car className="h-4 w-4" /> Nuevo viaje
                  </Button>
                  <Button
                    onClick={() => window.location.href = "/ride-history"}
                    variant="outline"
                    className="rounded-xl gap-2 border-border/50"
                  >
                    <Clock className="h-4 w-4" /> Historial
                  </Button>
                </div>
              </motion.div>
            )}

            {rideStatus === "cancelled" && (
              <Button
                onClick={() => { setPhase("estimate"); setRideId(null); setRideStatus("pending"); setTaxiDriver(null); setReviewSubmitted(false); }}
                className="w-full rounded-xl gap-2 bg-primary text-black font-bold"
              >
                <Car className="h-4 w-4" /> Solicitar otro viaje
              </Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
