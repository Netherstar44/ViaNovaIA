// ─────────────────────────────────────────────────────────────────────────────
// client/src/components/taxi/RideCard.tsx
// Tarjeta de solicitud de viaje pendiente
// ─────────────────────────────────────────────────────────────────────────────

import { motion } from "framer-motion";
import { MapPin, Navigation, DollarSign, Route, User, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Ride } from "@shared/taxi.schema";

interface RideCardProps {
  ride: Ride;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAccepting?: boolean;
  isRejecting?: boolean;
}

export function RideCard({ ride, onAccept, onReject, isAccepting, isRejecting }: RideCardProps) {
  const fare = ride.fare.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const dist = ride.distanceKm ? `${ride.distanceKm.toFixed(1)} km` : "—";
  const elapsed = Math.floor((Date.now() - new Date(ride.createdAt!).getTime()) / 60000);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="bg-card border border-border/50 rounded-2xl p-4 hover:border-primary/30 transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-xl">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">{ride.travelerUsername}</p>
            <p className="text-xs text-muted-foreground">Hace {elapsed}m</p>
          </div>
        </div>
        <Badge className="bg-primary/15 text-primary border-primary/20 text-xs font-bold">
          {fare}
        </Badge>
      </div>

      {/* Ruta */}
      <div className="space-y-2 mb-4">
        <div className="flex items-start gap-2">
          <div className="mt-0.5 p-1 bg-green-500/10 rounded-full shrink-0">
            <MapPin className="h-3 w-3 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Origen</p>
            <p className="text-sm font-medium leading-tight">
              {ride.originAddress || `${parseFloat(ride.originLat).toFixed(4)}, ${parseFloat(ride.originLng).toFixed(4)}`}
            </p>
          </div>
        </div>

        <div className="ml-3 w-px h-3 bg-border/60" />

        <div className="flex items-start gap-2">
          <div className="mt-0.5 p-1 bg-red-500/10 rounded-full shrink-0">
            <Navigation className="h-3 w-3 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Destino</p>
            <p className="text-sm font-medium leading-tight">{ride.destinationAddress}</p>
          </div>
        </div>
      </div>

      {/* Info chips */}
      <div className="flex gap-2 mb-4">
        <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-lg text-xs text-muted-foreground">
          <Route className="h-3 w-3" />
          {dist}
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded-lg text-xs text-muted-foreground">
          <DollarSign className="h-3 w-3" />
          Tarifa fija
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2">
        <Button
          onClick={() => onReject(ride.id)}
          disabled={isRejecting || isAccepting}
          variant="outline"
          size="sm"
          className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
        >
          {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
          Rechazar
        </Button>
        <Button
          onClick={() => onAccept(ride.id)}
          disabled={isAccepting || isRejecting}
          size="sm"
          className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold"
        >
          {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
          Aceptar
        </Button>
      </div>
    </motion.div>
  );
}
