import { apiBase } from "@/lib/queryClient";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User } from "lucide-react";

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const statusLabels: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  completed: { label: "Completado", color: "bg-green-500/15 text-green-400 border-green-500/20", icon: <CheckCircle className="h-4 w-4 text-green-400" /> },
  cancelled: { label: "Cancelado", color: "bg-red-500/15 text-red-400 border-red-500/20", icon: <XCircle className="h-4 w-4 text-red-400" /> },
  pending: { label: "Pendiente", color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20", icon: <Clock className="h-4 w-4 text-yellow-400" /> },
  accepted: { label: "Aceptado", color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: <Car className="h-4 w-4 text-blue-400" /> },
  in_progress: { label: "En curso", color: "bg-primary/15 text-primary border-primary/20", icon: <Navigation className="h-4 w-4 text-primary" /> },
  confirmed: { label: "Confirmado (Pago Pendiente)", color: "bg-purple-500/15 text-purple-400 border-purple-500/20", icon: <DollarSign className="h-4 w-4 text-purple-400" /> },
};

interface HistoryItem {
  id: string;
  type: "ride" | "service_booking"; // 'ride' para taxis, 'service_booking' para hoteles/restaurantes
  serviceCategory?: string; // e.g., 'hotel', 'restaurant'
  serviceName?: string;
  travelerUsername: string;
  providerUsername: string | null;
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
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "completed" | "cancelled" | "confirmed">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "ride" | "service">("all");
  const [reviewingItem, setReviewingItem] = useState<string | null>(null);
  const [reviewedItems, setReviewedItems] = useState<Set<string>>(new Set());
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [itemReviews, setItemReviews] = useState<Record<string, any[]>>({});
  const [chatHistory, setChatHistory] = useState<any[]>([]);

  // Payment mock state
  const [processingPayment, setProcessingPayment] = useState<string | null>(null);

  const isTaxi = user?.role === "taxi";

  useEffect(() => {
    if (!user) return;
    const endpoint = isTaxi
      ? `/api/rides/taxi/${user.username}`
      : `/api/rides/traveler/${user.username}`;
    
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        // Combine active + history, show all items
        const allItems: HistoryItem[] = [];
        const mapRide = (r: any): HistoryItem => ({
          ...r,
          type: "ride",
          providerUsername: r.taxiUsername,
        });

        if (data.activeRide) allItems.push(mapRide(data.activeRide));
        if (data.history) allItems.push(...data.history.map(mapRide));

        // MOCK: Add some fake service bookings so the user can see the structure
        if (!isTaxi) {
          allItems.push({
            id: "mock_hotel_1",
            type: "service_booking",
            serviceCategory: "hotel",
            serviceName: "Hotel El Dorado Premium",
            travelerUsername: user.username,
            providerUsername: "hotel_dorado",
            originAddress: null,
            destinationAddress: "Habitación Doble - 3 Noches",
            fare: 450000,
            status: "confirmed", // requires payment
            createdAt: new Date(Date.now() - 86400000).toISOString(),
            completedAt: null,
            startedAt: null,
          });
          allItems.push({
            id: "mock_rest_1",
            type: "service_booking",
            serviceCategory: "restaurant",
            serviceName: "Restaurante La Casona",
            travelerUsername: user.username,
            providerUsername: "la_casona",
            originAddress: null,
            destinationAddress: "Reserva Mesa para 4 - Cena",
            fare: 120000,
            status: "completed",
            createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
            completedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            startedAt: null,
          });
        }

        setItems(allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    if (user?.username) {
      fetch(`${apiBase}/api/chat/history?username=${encodeURIComponent(user.username)}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setChatHistory(data);
          } else {
            setChatHistory([]);
          }
        })
        .catch((e) => {
          console.error(e);
          setChatHistory([]);
        });
    }
  }, [user?.username, user?.role, isTaxi]);

  // Check which items user has already reviewed
  useEffect(() => {
    if (!user || items.length === 0) return;
    const completedIds = items.filter(r => r.status === "completed" && r.type === "ride").map(r => r.id);
    if (completedIds.length === 0) return;

    Promise.all(
      completedIds.map(id =>
        fetch(`${apiBase}/api/reviews/ride/${id}`).then(r => r.json())
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
      setReviewedItems(reviewed);
      setItemReviews(reviewMap);
    });
  }, [items, user?.username]);

  if (!user) {
    setLocation("/login");
    return null;
  }

  const filteredItems = items.filter(r => {
    if (filter !== "all" && r.status !== filter) return false;
    if (typeFilter !== "all" && ((typeFilter === "ride" && r.type !== "ride") || (typeFilter === "service" && r.type !== "service_booking"))) return false;
    return true;
  });

  const completedCount = items.filter(r => r.status === "completed").length;
  const cancelledCount = items.filter(r => r.status === "cancelled").length;
  const totalEarned = items.filter(r => r.status === "completed").reduce((s, r) => s + r.fare, 0);

  const handlePayService = (id: string) => {
    setProcessingPayment(id);
    setTimeout(() => {
      setItems(prev => prev.map(i => i.id === id ? { ...i, status: "completed" } : i));
      setProcessingPayment(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="max-w-[1600px] mx-auto w-full py-8 px-4 lg:px-8">
        <button
          onClick={() => setLocation(isTaxi ? "/taxi-dashboard" : "/")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" /> {isTaxi ? "Panel de Taxista" : "Volver al inicio"}
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-8 xl:col-span-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <Clock className="h-8 w-8 text-primary drop-shadow-sm" strokeWidth={2} />
              <div>
                <h1 className="text-2xl font-bold">Historial de Reservas y Viajes</h1>
                <p className="text-sm text-muted-foreground">
                  {isTaxi ? "Viajes realizados como conductor" : "Tus viajes, hospedajes y reservas"}
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
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { key: "all", label: "Todos", count: items.length },
              { key: "completed", label: "Completados", count: completedCount },
              { key: "cancelled", label: "Cancelados", count: cancelledCount },
              { key: "confirmed", label: "Por Pagar", count: items.filter(i => i.status === "confirmed").length },
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
            
            <div className="w-px h-6 bg-border/40 my-auto mx-2" />
            
            {([
              { key: "all", label: "Cualquier Tipo" },
              { key: "ride", label: "Taxis" },
              { key: "service", label: "Servicios/Hoteles" },
            ] as const).map(f => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  typeFilter === f.key
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                    : "bg-secondary/30 text-muted-foreground border border-border/30 hover:bg-secondary/50"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Items list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-card border border-border/40 rounded-2xl p-12 text-center">
              <Car className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No hay registros para mostrar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const st = statusLabels[item.status] || statusLabels.pending;
                const otherUser = isTaxi ? item.travelerUsername : (item.providerUsername || "Sin asignar");
                const isExpanded = expandedItem === item.id;
                const hasReviewed = reviewedItems.has(item.id);
                const isReviewing = reviewingItem === item.id;
                const reviews = itemReviews[item.id] || [];
                const isService = item.type === "service_booking";

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-border/40 rounded-2xl overflow-hidden hover:border-border/60 transition-all"
                  >
                    {/* Main row */}
                    <button
                      onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                      className="w-full text-left p-4 flex items-center gap-4"
                    >
                      {/* Status icon */}
                      {isService ? <Star className={`h-6 w-6 ${st.color.split(' ')[1]}`} /> : st.icon}

                      {/* item info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold truncate">{isService ? item.serviceName : item.destinationAddress}</p>
                          <div className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${st.color}`}>{st.label}</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(item.completedAt || item.createdAt).toLocaleDateString("es-CO", {
                              day: "numeric", month: "short", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                          <span className="flex items-center gap-1">
                            {isService ? <Star className="h-3 w-3" /> : (isTaxi ? <MapPin className="h-3 w-3" /> : <Car className="h-3 w-3" />)}
                            {otherUser}
                          </span>
                        </div>
                      </div>

                      {/* Fare + expand */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-bold text-primary">{fmt(item.fare)}</span>
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
                            {/* Route/Service detail */}
                            <div className="grid grid-cols-2 gap-3">
                              {isService ? (
                                <div className="col-span-2 p-3 rounded-xl bg-secondary/20 border border-border/30">
                                  <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                                    <Star className="h-2.5 w-2.5 text-primary" /> Detalles de Reserva
                                  </p>
                                  <p className="text-xs font-medium mt-1">{item.destinationAddress}</p>
                                </div>
                              ) : (
                                <>
                                  <div className="p-3 rounded-xl bg-secondary/20 border border-border/30">
                                    <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                                      <MapPin className="h-2.5 w-2.5 text-green-400" /> Origen
                                    </p>
                                    <p className="text-xs font-medium mt-1 line-clamp-2">{item.originAddress || "N/A"}</p>
                                  </div>
                                  <div className="p-3 rounded-xl bg-secondary/20 border border-border/30">
                                    <p className="text-[10px] uppercase text-muted-foreground font-semibold flex items-center gap-1">
                                      <Navigation className="h-2.5 w-2.5 text-red-400" /> Destino
                                    </p>
                                    <p className="text-xs font-medium mt-1 line-clamp-2">{item.destinationAddress}</p>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Payment Section for Confirmed Bookings */}
                            {item.status === "confirmed" && (
                              <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col gap-3">
                                <p className="text-sm font-semibold text-primary">El proveedor ha confirmado tu solicitud.</p>
                                <p className="text-xs text-muted-foreground mb-1">Para asegurar la reserva, por favor realiza el pago por {fmt(item.fare)}.</p>
                                <Button 
                                  onClick={() => handlePayService(item.id)}
                                  disabled={processingPayment === item.id}
                                  className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 font-bold"
                                >
                                  {processingPayment === item.id ? (
                                    <><Loader2 className="h-4 w-4 animate-spin" /> Procesando pago...</>
                                  ) : (
                                    <>Pagar con PSE (Simulado)</>
                                  )}
                                </Button>
                              </div>
                            )}

                            {/* Time details */}
                            <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground mt-2">
                              {item.createdAt && (
                                <span className="bg-secondary/30 px-2 py-1 rounded-lg">
                                  Creado: {new Date(item.createdAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              {item.startedAt && (
                                <span className="bg-secondary/30 px-2 py-1 rounded-lg">
                                  Iniciado: {new Date(item.startedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              {item.completedAt && (
                                <span className="bg-green-500/10 text-green-400 px-2 py-1 rounded-lg">
                                  Completado: {new Date(item.completedAt).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                            </div>

                            {/* Existing reviews for this item */}
                            {reviews.length > 0 && (
                              <div className="space-y-2 mt-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reseñas</p>
                                {reviews.map((rev: any) => (
                                  <div key={rev.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/20 border border-border/30">
                                    <Star className="h-5 w-5 text-primary shrink-0" />
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
                            {item.status === "completed" && !isService && (
                              <div className="mt-3">
                                {hasReviewed ? (
                                  <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 rounded-xl px-3 py-2 border border-green-500/20">
                                    <CheckCircle className="h-3.5 w-3.5" />
                                    Ya dejaste una reseña para este viaje
                                  </div>
                                ) : isReviewing ? (
                                  <ReviewForm
                                    rideId={item.id}
                                    authorUsername={user.username}
                                    targetUsername={otherUser}
                                    authorRole={isTaxi ? "taxi" : "traveler"}
                                    onSubmitted={() => {
                                      setReviewingItem(null);
                                      setReviewedItems(prev => new Set([...Array.from(prev), item.id]));
                                    }}
                                    onCancel={() => setReviewingItem(null)}
                                  />
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setReviewingItem(item.id)}
                                    className="w-full rounded-xl gap-2 border-primary/30 text-primary hover:bg-primary/10"
                                  >
                                    <Star className="h-4 w-4" />
                                    Dejar Reseña
                                  </Button>
                                )}
                              </div>
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

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-4 xl:col-span-4">
            <div className="bg-card border border-border/40 rounded-2xl overflow-hidden flex flex-col h-[700px] sticky top-24 shadow-xl">
              <div className="p-4 border-b border-border/40 bg-secondary/20 flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-primary" strokeWidth={2} />
                <div>
                  <h2 className="font-bold">Historial del Asistente</h2>
                  <p className="text-xs text-muted-foreground">Tus últimas conversaciones con VIANova</p>
                </div>
              </div>
              <ScrollArea className="flex-1 p-4">
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-50">
                    <MessageSquare className="h-12 w-12 mb-4" />
                    <p>No tienes mensajes aún con el asistente.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {chatHistory.map((msg, i) => (
                      <div key={msg.id || i} className={`flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary' : 'bg-primary/20 text-primary border border-primary/30'}`}>
                          {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                        </div>
                        <div className={`rounded-2xl p-3 text-sm max-w-[85%] ${
                          msg.role === 'user'
                            ? 'bg-primary text-black rounded-tr-sm'
                            : 'bg-secondary/40 text-foreground border border-white/5 rounded-tl-sm'
                        }`}>
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
