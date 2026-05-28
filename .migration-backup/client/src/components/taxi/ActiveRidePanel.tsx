// ─────────────────────────────────────────────────────────────────────────────
// client/src/components/taxi/ActiveRidePanel.tsx
// Panel del viaje activo (accepted o in_progress) + review al completar
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, Navigation, User, Clock, Flag, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import type { Ride } from "@shared/taxi.schema";
import { ReviewForm } from "@/components/ReviewSystem";

interface ActiveRidePanelProps {
  ride: Ride;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onDismiss?: () => void;
  isStarting?: boolean;
  isCompleting?: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  accepted:    { label: "Yendo al origen", color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  in_progress: { label: "En curso",        color: "bg-green-500/15 text-green-400 border-green-500/20" },
  completed:   { label: "Completado",      color: "bg-primary/15 text-primary border-primary/20" },
};

export function ActiveRidePanel({ ride, onStart, onComplete, onDismiss, isStarting, isCompleting }: ActiveRidePanelProps) {
  const [_, setLocation] = useLocation();
  const { user } = useAuth();
  const st = statusLabels[ride.status] ?? { label: ride.status, color: "" };
  const fare = ride.fare.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

  const [showReview, setShowReview] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);

  const openMaps = () => {
    const origin = `${ride.originLat},${ride.originLng}`;
    const dest = `${ride.destinationLat},${ride.destinationLng}`;
    window.open(`https://www.google.com/maps/dir/${origin}/${dest}`, "_blank");
  };

  const handleComplete = (id: string) => {
    onComplete(id);
    // Show review form after completing
    setShowReview(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-gradient-to-br from-card to-card/70 border border-primary/20 rounded-2xl p-5 shadow-lg shadow-primary/5"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-bold text-sm">Viaje Activo</span>
        </div>
        <Badge className={`text-xs ${st.color}`}>{st.label}</Badge>
      </div>

      {/* Cliente */}
      <div className="flex items-center gap-3 bg-secondary/30 rounded-xl p-3 mb-4">
        <div className="p-2 bg-primary/10 rounded-full">
          <User className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Pasajero</p>
          <p className="font-semibold">{ride.travelerUsername}</p>
        </div>
        <Badge className="bg-primary/15 text-primary border-primary/20 font-bold">{fare}</Badge>
      </div>

      {/* Ruta */}
      <div className="space-y-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-1.5 bg-green-500/10 rounded-full">
            <MapPin className="h-3.5 w-3.5 text-green-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Origen</p>
            <p className="text-sm font-medium">
              {ride.originAddress || `${parseFloat(ride.originLat).toFixed(5)}, ${parseFloat(ride.originLng).toFixed(5)}`}
            </p>
          </div>
        </div>
        <div className="ml-4 flex items-center gap-2">
          <div className="w-px flex-1 h-px bg-border/60" />
          <Clock className="h-3 w-3 text-muted-foreground" />
          <div className="w-px flex-1 h-px bg-border/60" />
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-1.5 bg-red-500/10 rounded-full">
            <Navigation className="h-3.5 w-3.5 text-red-400" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Destino</p>
            <p className="text-sm font-medium">{ride.destinationAddress}</p>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocation(`/taxi/ride/${ride.id}`)}
          className="rounded-xl text-xs gap-1 border-border/50"
        >
          <Flag className="h-3.5 w-3.5" />
          Ver Mapa
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={openMaps}
          className="rounded-xl text-xs gap-1 border-border/50"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Google Maps
        </Button>
      </div>

      {ride.status === "accepted" && (
        <Button
          onClick={() => onStart(ride.id)}
          disabled={isStarting}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold"
        >
          {isStarting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Iniciar Viaje
        </Button>
      )}

      {ride.status === "in_progress" && (
        <Button
          onClick={() => handleComplete(ride.id)}
          disabled={isCompleting}
          className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold"
        >
          {isCompleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Finalizar Viaje
        </Button>
      )}

      {/* Review form after completing (taxi reviews traveler) */}
      {(showReview || ride.status === "completed") && user && (
        <div className="mt-4">
          {!reviewDone ? (
            <ReviewForm
              rideId={ride.id}
              authorUsername={user.username}
              targetUsername={ride.travelerUsername}
              authorRole="taxi"
              onSubmitted={() => setReviewDone(true)}
              onCancel={() => setReviewDone(true)}
            />
          ) : (
            <div className="text-center bg-green-500/10 border border-green-500/20 rounded-xl p-4">
              <p className="text-sm font-semibold text-green-400 mb-3">¡Reseña enviada!</p>
              {onDismiss && (
                <Button onClick={onDismiss} variant="outline" className="w-full rounded-xl">
                  Cerrar
                </Button>
              )}
            </div>
          )}
          {/* Allow dismiss even without review if they skip it */}
          {!reviewDone && onDismiss && (
             <Button onClick={onDismiss} variant="ghost" className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground">
               Saltar y cerrar
             </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
