import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Car, MapPin, Navigation, Clock, Star,
  Calendar, DollarSign, MessageSquare, ChevronDown,
  CheckCircle, XCircle, Loader2, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import { ReviewForm, StarDisplay } from "@/components/ReviewSystem";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: "Completado", color: "bg-green-500/15 text-green-400 border-green-500/20", icon: <CheckCircle className="h-4 w-4 text-green-400" /> },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: <XCircle className="h-4 w-4 text-red-400" /> },
  pending: { label: "Pendiente", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock className="h-4 w-4 text-yellow-400" /> },
  accepted: { label: "Aceptado", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: <Car className="h-4 w-4 text-blue-400" /> },
  in_progress: { label: "En curso", color: "bg-primary/15 text-primary border-primary/20", icon: <Navigation className="h-4 w-4 text-primary" /> },
};

interface RideItem {
  id: string;
  travelerUsername: string;
  taxiUsername: string | null;
  originAddress: string | null;
  destinationAddress: string;
  fare: number;
  status: string;
  createdAt: string;
  completedAt: string | null;
  startedAt: string | null;
}

export default function RideHistory() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const [rides, setRides] = useState<RideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [reviewingRide, setReviewingRide] = useState<string | null>(null);
  const [reviewedRides, setReviewedRides] = useState<Set<string>>(new Set());
  const [expandedRide, setExpandedRide] = useState<string | null>(null);
  const [rideReviews, setRideReviews] = useState<Record<string, any[]>>({});

  const isTaxi = user?.role === "taxi";

  useEffect(() => {
    if (!user) return;
    const endpoint = isTaxi
      ? `/api/rides/taxi/${user.username}`
      : `/api/rides/traveler/${user.username}`;
    
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        // Combine active + history, show all rides
        const allRides: RideItem[] = [];
        if (data.activeRide) allRides.push(data.activeRide);
        if (data.history) allRides.push(...data.history);
        setRides(allRides);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user?.username, user?.role]);

  // Check which rides user has already reviewed
  useEffect(() => {
    if (!user || rides.length === 0) return;
    const completedIds = rides.filter(r => r.status === "completed").map(r => r.id);
    if (completedIds.length === 0) return;

    Promise.all(
      completedIds.map(id =>
        fetch(`/api/reviews/ride/${id}`).then(r => r.json())
      )
    ).then(results => {
      const reviewed = new Set<string>();
      const reviewMap: Record<string, any[]> = {};
      results.forEach((data, i) => {
        const rideId = completedIds[i];
        reviewMap[rideId] = data.reviews || [];
        const hasMyReview = (data.reviews || []).some(
          (rev: any) => rev.authorUsername === user.username
        );
        if (hasMyReview) reviewed.add(rideId);
      });
      setReviewedRides(reviewed);
      setRideReviews(reviewMap);
    });
  }, [rides, user?.username]);

  if (!user) {
    setLocation("/login");
    return null;
  }

  const filteredRides = rides.filter(r => {
    if (filter === "all") return true;
    return r.status === filter;
  });

  const completedCount = rides.filter(r => r.status === "completed").length;
  const cancelledCount = rides.filter(r => r.status === "cancelled").length;
  const totalEarned = rides.filter(r => r.status === "completed").reduce((s, r) => s + r.fare, 0);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container max-w-3xl py-8 px-4">
        <button
          onClick={() => setLocation(isTaxi ? "/taxi-dashboard" : "/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> {isTaxi ? "Panel de Taxista" : "Volver al inicio"}
        </button>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-primary/10 rounded-xl border border-primary/20">
              <Clock className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Historial de Viajes</h1>
              <p className="text-sm text-muted-foreground">
                {isTaxi ? "Viajes realizados como conductor" : "Tus viajes como pasajero"}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 my-6">
            <div className="bg-card border border-border/40 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-primary">{completedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Completados</p>
            </div>
            <div className="bg-card border border-border/40 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-foreground">{fmt(totalEarned)}</p>
              <p className="text-xs text-muted-foreground mt-1">{isTaxi ? "Ganado" : "Gastado"}</p>
            </div>
            <div className="bg-card border border-border/40 rounded-2xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{cancelledCount}</p>
              <p className="text-xs text-muted-foreground mt-1">Cancelados</p>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2 mb-4">
            {([
              { key: "all", label: "Todos", count: rides.length },
              { key: "completed", label: "Completados", count: completedCount },
              { key: "cancelled", label: "Cancelados", count: cancelledCount },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  filter === f.key
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary/50"
                }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>

          {/* Rides list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredRides.length === 0 ? (
            <div className="bg-card border border-border/40 rounded-2xl p-12 text-center">
              <Car className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay viajes para mostrar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRides.map((ride) => {
                const st = statusLabels[ride.status] || statusLabels.pending;
                const otherUser = isTaxi ? ride.travelerUsername : (ride.taxiUsername || "Sin asignar");
                const isExpanded = expandedRide === ride.id;
                const hasReviewed = reviewedRides.has(ride.id);
                const isReviewing = reviewingRide === ride.id;
                const reviews = rideReviews[ride.id] || [];

                return (
                  <motion.div
                    key={ride.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/40 rounded-2xl overflow-hidden hover:border-border/60 transition-all"
                  >
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedRide(isExpanded ? null : ride.id)}
                      className="w-full text-left p-4 flex items-center gap-4"
                    >
                      {/* Status icon */}
                      <div className={`p-2.5 rounded-xl ${ride.status === "completed" ? "bg-green-500/10" : ride.status === "cancelled" ? "bg-red-500/10" : "bg-primary/10"}`}>
                        {st.icon}
                      </div>

                      {/* Ride info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">{ride.destinationAddress}</p>
                          <Badge className={`text-[10px] shrink-0 ${st.color}`}>{st.label}</Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(ride.completedAt || ride.createdAt).toLocaleDateString("es-CO", {
                              day: "numeric", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            {isTaxi ? <MapPin className="h-3 w-3" /> : <Car className="h-3 w-3" />}
                            {otherUser}
                          </span>
                        </div>
                      </div>

                      {/* Fare + expand */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold text-primary">{fmt(ride.fare)}</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </div>
                    </button>

                    {/* Expanded detail */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 border-t border-border/30 pt-3 space-y-3">
                            {/* Route detail */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-xl bg-secondary/20 border border-border/30">
                                <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                                  <MapPin className="h-2.5 w-2.5 text-green-400" /> Origen
                                </p>
                                <p className="text-xs font-medium mt-1 line-clamp-2">{ride.originAddress || "N/A"}</p>
                              </div>
                              <div className="p-3 rounded-xl bg-secondary/20 border border-border/30">
                                <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                                  <Navigation className="h-2.5 w-2.5 text-red-400" /> Destino
                                </p>
                                <p className="text-xs font-medium mt-1 line-clamp-2">{ride.destinationAddress}</p>
                              </div>
                            </div>

                            {/* Time details */}
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                              {ride.createdAt && (
                                <span className="bg-secondary/30 px-2 py-1 rounded-lg">
                                  Creado: {new Date(ride.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              {ride.startedAt && (
                                <span className="bg-secondary/30 px-2 py-1 rounded-lg">
                                  Iniciado: {new Date(ride.startedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              {ride.completedAt && (
                                <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded-lg">
                                  Completado: {new Date(ride.completedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>

                            {/* Existing reviews for this ride */}
                            {reviews.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reseñas del viaje</p>
                                {reviews.map((rev: any) => (
                                  <div key={rev.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/20 border border-border/30">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <Star className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium">{rev.authorUsername}</span>
                                        <StarDisplay rating={rev.rating} size={10} />
                                      </div>
                                      {rev.comment && <p className="text-xs text-muted-foreground mt-0.5 truncate">{rev.comment}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Review button or form */}
                            {ride.status === "completed" && (
                              <>
                                {hasReviewed ? (
                                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 rounded-xl px-3 py-2 border border-green-500/20">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Ya dejaste una reseña para este viaje
                                  </div>
                                ) : isReviewing ? (
                                  <ReviewForm
                                    rideId={ride.id}
                                    authorUsername={user.username}
                                    targetUsername={otherUser}
                                    authorRole={isTaxi ? "taxi" : "traveler"}
                                    onSubmitted={() => {
                                      setReviewingRide(null);
                                      setReviewedRides(prev => new Set([...prev, ride.id]));
                                    }}
                                    onCancel={() => setReviewingRide(null)}
                                  />
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReviewingRide(ride.id)}
                                    className="w-full rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                  >
                                    <Star className="h-4 w-4" />
                                    Dejar Reseña
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
