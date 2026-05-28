import { apiBase } from "@/lib/queryClient";
// ─────────────────────────────────────────────────────────────────────────────
// client/src/pages/taxi/RideDetail.tsx
// Vista de detalle del viaje con mapa Leaflet — /taxi/ride/:id
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, ExternalLink, MapPin, Navigation, User, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import type { Ride } from "@shared/taxi.schema";

// Leaflet se importa dinámicamente para evitar SSR issues
// Asegúrate de tener: npm install leaflet react-leaflet @types/leaflet
// Y en index.html o index.css: import "leaflet/dist/leaflet.css"

export default function RideDetail() {
  const { id } = useParams<{ id: string }>();
  const [_, setLocation] = useLocation();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ride", id],
    queryFn: () => fetch(`${apiBase}/api/rides/${id}`).then((r) => r.json()) as Promise<{ ride: Ride }>,
    enabled: !!id,
    refetchInterval: 10_000,
  });

  const ride = data?.ride;

  // ── Inicializar mapa Leaflet ────────────────────────────────────────────────
  useEffect(() => {
    if (!ride || !mapRef.current || mapInstanceRef.current) return;

    // Import dinámico para compatibilidad con bundlers
    import("leaflet").then((L) => {
      // Fix default icon path (problema conocido de Leaflet + Webpack/Vite)
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

      const map = L.map(mapRef.current!, {
        center: [originLat, originLng],
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // ── Marcador origen (verde) ────────────────────────────────────────────
      const originIcon = L.divIcon({
        html: `<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: "",
      });
      L.marker([originLat, originLng], { icon: originIcon })
        .addTo(map)
        .bindPopup(`<b>🟢 Origen</b><br/>${ride.originAddress || "Punto de recogida"}`)
        .openPopup();

      // ── Marcador destino (rojo) ────────────────────────────────────────────
      const destIcon = L.divIcon({
        html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(239,68,68,0.6)"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
        className: "",
      });
      L.marker([destLat, destLng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<b>🔴 Destino</b><br/>${ride.destinationAddress}`);

      // ── Línea de ruta estimada ─────────────────────────────────────────────
      const polyline = L.polyline(
        [[originLat, originLng], [destLat, destLng]],
        {
          color: "#c9a227",
          weight: 4,
          opacity: 0.8,
          dashArray: "8, 6",
        }
      ).addTo(map);

      // Ajustar el mapa para mostrar toda la ruta
      map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [ride]);

  const openGoogleMaps = () => {
    if (!ride) return;
    const origin = `${ride.originLat},${ride.originLng}`;
    const dest   = `${ride.destinationLat},${ride.destinationLng}`;
    window.open(`https://www.google.com/maps/dir/${origin}/${dest}`, "_blank");
  };

  const statusColors: Record<string, string> = {
    accepted:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
    in_progress: "bg-green-500/15 text-green-400 border-green-500/20",
    completed:   "bg-primary/15 text-primary border-primary/20",
    cancelled:   "bg-destructive/15 text-destructive border-destructive/20",
  };
  const statusLabels: Record<string, string> = {
    accepted: "Yendo al origen", in_progress: "En curso",
    completed: "Completado", cancelled: "Cancelado",
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <div className="container max-w-3xl py-6 px-4 space-y-5">

        {/* Back */}
        <button
          onClick={() => setLocation("/taxi-dashboard")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al dashboard
        </button>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-heading">Detalle del Viaje</h1>
          {ride && (
            <Badge className={statusColors[ride.status] ?? ""}>
              {statusLabels[ride.status] ?? ride.status}
            </Badge>
          )}
        </div>

        {/* Info del viaje */}
        {isLoading ? (
          <Skeleton className="h-32 rounded-2xl" />
        ) : ride ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border/50 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <User className="h-3 w-3" /> Pasajero
              </p>
              <p className="font-semibold text-sm">{ride.travelerUsername}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <DollarSign className="h-3 w-3" /> Tarifa
              </p>
              <p className="font-bold text-primary">
                {ride.fare.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Origen
              </p>
              <p className="text-sm">{ride.originAddress || `${parseFloat(ride.originLat).toFixed(4)}...`}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Navigation className="h-3 w-3" /> Destino
              </p>
              <p className="text-sm">{ride.destinationAddress}</p>
            </div>
          </motion.div>
        ) : (
          <p className="text-muted-foreground text-sm">Viaje no encontrado</p>
        )}

        {/* Mapa */}
        <div className="rounded-2xl overflow-hidden border border-border/50 shadow-lg">
          {/* Leaflet CSS inline para que funcione sin configuración extra */}
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
          />
          <div ref={mapRef} style={{ height: "420px", width: "100%", background: "#0a0a12" }} />
        </div>

        {/* Leyenda + botón Google Maps */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Origen
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Destino
            </span>
            <span className="flex items-center gap-1">
              <span className="w-8 border-t-2 border-primary border-dashed inline-block" /> Ruta
            </span>
          </div>
          <Button
            onClick={openGoogleMaps}
            disabled={!ride}
            variant="outline"
            className="gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir en Google Maps
          </Button>
        </div>
      </div>
    </div>
  );
}
