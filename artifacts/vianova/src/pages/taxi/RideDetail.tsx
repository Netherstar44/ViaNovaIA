import { apiBase } from "@/lib/queryClient";
import { useEffect, useRef, useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, MapPin, Navigation, User, DollarSign, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { useAuth } from "@/lib/auth";
import type { Ride } from "@shared/taxi.schema";

interface ChatMessage {
  from: string;
  role: string;
  text: string;
  at: string;
}

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const taxiMarkerRef = useRef<any>(null);
  const socketRef = useRef<any>(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ride", id],
    queryFn: () => fetch(`${apiBase}/api/rides/${id}`, { credentials: "include" }).then((r) => r.json()) as Promise<{ ride: Ride }>,
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const ride = data?.ride;

  // ── Socket.IO connection ────────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return;

    import("socket.io-client").then(({ io }) => {
      const socket = io(apiBase.replace("/api", "") || window.location.origin, {
        transports: ["websocket", "polling"],
        path: "/socket.io",
      });

      socketRef.current = socket;

      socket.emit("join_ride", id);

      // Real-time GPS tracking
      socket.on("taxi_location", (data: { lat: number; lng: number; rideId: string }) => {
        if (data.rideId !== id) return;
        if (taxiMarkerRef.current && mapInstanceRef.current) {
          taxiMarkerRef.current.setLatLng([data.lat, data.lng]);
          mapInstanceRef.current.panTo([data.lat, data.lng], { animate: true, duration: 0.5 });
        }
      });

      // In-ride chat
      socket.on("ride_chat_message", (msg: ChatMessage) => {
        setChatMessages(prev => [...prev, msg]);
      });

      return () => {
        socket.emit("leave_ride", id);
        socket.disconnect();
      };
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave_ride", id);
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [id]);

  // Scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Leaflet map ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ride || !mapRef.current || mapInstanceRef.current) return;

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const originLat = parseFloat(ride.originLat);
      const originLng = parseFloat(ride.originLng);
      const destLat   = parseFloat(ride.destinationLat);
      const destLng   = parseFloat(ride.destinationLng);

      const map = L.map(mapRef.current!, { center: [originLat, originLng], zoom: 14 });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      const originIcon = L.divIcon({
        html: `<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: "",
      });
      L.marker([originLat, originLng], { icon: originIcon }).addTo(map)
        .bindPopup(`<b>🟢 Origen</b><br/>${ride.originAddress || "Punto de recogida"}`).openPopup();

      const destIcon = L.divIcon({
        html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(239,68,68,0.6)"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7], className: "",
      });
      L.marker([destLat, destLng], { icon: destIcon }).addTo(map)
        .bindPopup(`<b>🔴 Destino</b><br/>${ride.destinationAddress}`);

      // Taxi GPS marker (starts at origin)
      const taxiIcon = L.divIcon({
        html: `<div style="background:#c9a227;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(201,162,39,0.8);font-size:10px;text-align:center;line-height:12px">🚕</div>`,
        iconSize: [18, 18], iconAnchor: [9, 9], className: "",
      });
      taxiMarkerRef.current = L.marker([originLat, originLng], { icon: taxiIcon }).addTo(map)
        .bindPopup("<b>🚕 Taxi</b>");

      const polyline = L.polyline([[originLat, originLng], [destLat, destLng]], {
        color: "#c9a227", weight: 4, opacity: 0.8, dashArray: "8, 6",
      }).addTo(map);

      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });
      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, [ride]);

  const openGoogleMaps = () => {
    if (!ride) return;
    window.open(`https://www.google.com/maps/dir/${ride.originLat},${ride.originLng}/${ride.destinationLat},${ride.destinationLng}`, "_blank");
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socketRef.current || !user || !id) return;
    const msg = { rideId: id, from: user.username, role: user.role, text: chatInput.trim() };
    socketRef.current.emit("ride_chat_message", msg);
    setChatMessages(prev => [...prev, { ...msg, at: new Date().toISOString() }]);
    setChatInput("");
  };

  const statusColors: Record<string, string> = {
    accepted:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
    in_progress: "bg-green-500/15 text-green-400 border-green-500/20",
    completed:   "bg-primary/15 text-primary border-primary/20",
    cancelled:   "bg-destructive/15 text-destructive border-destructive/20",
  };
  const statusLabels: Record<string, string> = {
    pending: "Buscando taxi", accepted: "Yendo al origen",
    in_progress: "En curso", completed: "Completado", cancelled: "Cancelado",
  };

  const showChat = ride && ["accepted", "in_progress"].includes(ride.status);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      <div className="container max-w-3xl py-6 px-4 space-y-5">
        <button onClick={() => setLocation("/taxi-dashboard")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver al dashboard
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-heading">Detalle del Viaje</h1>
          {ride && <Badge className={statusColors[ride.status] ?? ""}>{statusLabels[ride.status] ?? ride.status}</Badge>}
        </div>

        {/* Info */}
        {isLoading ? <Skeleton className="h-32 rounded-2xl" /> : ride ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><User className="h-3 w-3" /> Pasajero</p>
              <p className="font-semibold text-sm">{ride.travelerUsername}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><DollarSign className="h-3 w-3" /> Tarifa</p>
              <p className="font-bold text-primary">{ride.fare.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Origen</p>
              <p className="text-sm">{ride.originAddress || `${parseFloat(ride.originLat).toFixed(4)}...`}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Navigation className="h-3 w-3" /> Destino</p>
              <p className="text-sm">{ride.destinationAddress}</p>
            </div>
          </motion.div>
        ) : <p className="text-muted-foreground text-sm">Viaje no encontrado</p>}

        {/* Map */}
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
          <div ref={mapRef} style={{ height: "380px", width: "100%", background: "#0a0a12" }} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Origen</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Destino</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-primary inline-block" /> Taxi</span>
          </div>
          <Button onClick={openGoogleMaps} disabled={!ride} variant="outline" className="gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10">
            <ExternalLink className="h-4 w-4" /> Abrir en Google Maps
          </Button>
        </div>

        {/* In-ride Chat */}
        {showChat && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm">Chat del Viaje</span>
              <span className="text-xs text-muted-foreground ml-auto">Solo visible para pasajero y taxista</span>
            </div>

            <div className="h-48 overflow-y-auto px-4 py-3 space-y-2">
              {chatMessages.length === 0 ? (
                <p className="text-center text-xs text-muted-foreground/60 mt-8">Di algo al {user?.role === "taxi" ? "pasajero" : "taxista"}...</p>
              ) : chatMessages.map((m, i) => {
                const isMe = m.from === user?.username;
                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-3 py-1.5 rounded-xl text-sm ${isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                      {!isMe && <p className="text-xs font-semibold mb-0.5 opacity-70">@{m.from}</p>}
                      <p>{m.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={sendChatMessage} className="flex gap-2 px-4 py-3 border-t border-border/50">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="flex-1 h-9"
              />
              <Button type="submit" size="sm" disabled={!chatInput.trim()} className="h-9 gap-1">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </motion.div>
        )}
      </div>
    </div>
  );
}
