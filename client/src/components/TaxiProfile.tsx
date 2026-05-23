import { apiBase } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Car, Star, Phone, MapPin, User, Loader2 } from "lucide-react";
import { StarDisplay, ReviewList } from "./ReviewSystem";

interface TaxiProfileProps {
  username: string;
  compact?: boolean; // modo compacto para dentro del panel de viaje
}

export default function TaxiProfile({ username, compact = false }: TaxiProfileProps) {
  const [profile, setProfile] = useState<any>(null);
  const [taxiData, setTaxiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${apiBase}/api/users/${username}/profile`).then((r) => r.json()),
      fetch(`${apiBase}/api/taxi/profile/${username}`).then((r) => r.json()),
    ])
      .then(([profileData, taxiProfileData]) => {
        setProfile(profileData.profile || null);
        setTaxiData(taxiProfileData.profile || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) return null;

  // Compact mode: minimal info for inside ride panel
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/30"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Car className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate notranslate">{profile.name || username}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {taxiData?.vehicleType && <span>{taxiData.vehicleType}</span>}
            {taxiData?.plate && (
              <span className="bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded font-mono text-[10px]">
                {taxiData.plate}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
            <span className="text-sm font-bold">
              {profile.averageRating > 0 ? profile.averageRating.toFixed(1) : "Nuevo"}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {profile.reviewCount} {profile.reviewCount === 1 ? "reseña" : "reseñas"}
          </span>
        </div>
      </motion.div>
    );
  }

  // Full profile
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="relative bg-gradient-to-br from-primary/10 via-yellow-500/5 to-transparent p-6 border-b border-border/30">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
            <User className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold truncate notranslate">{profile.name || username}</h3>
            <p className="text-sm text-muted-foreground">@{username}</p>
            <div className="flex items-center gap-2 mt-2">
              <StarDisplay rating={profile.averageRating} size={18} />
              <span className="text-sm font-semibold">
                {profile.averageRating > 0 ? profile.averageRating.toFixed(1) : "—"}
              </span>
              <span className="text-xs text-muted-foreground">
                ({profile.reviewCount} {profile.reviewCount === 1 ? "reseña" : "reseñas"})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Vehicle info */}
      {taxiData && (
        <div className="p-5 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Datos del Vehículo</h4>
          <div className="grid grid-cols-2 gap-3">
            {taxiData.vehicleType && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                <Car className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">Tipo</p>
                  <p className="text-sm font-medium truncate">{taxiData.vehicleType}</p>
                </div>
              </div>
            )}
            {taxiData.plate && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
                <MapPin className="h-4 w-4 text-yellow-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">Placa</p>
                  <p className="text-sm font-bold font-mono">{taxiData.plate}</p>
                </div>
              </div>
            )}
            {taxiData.phone && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/30 col-span-2">
                <Phone className="h-4 w-4 text-green-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase text-muted-foreground">Teléfono</p>
                  <p className="text-sm font-medium">{taxiData.phone}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reviews toggle */}
      <div className="border-t border-border/30">
        <button
          onClick={() => setShowReviews(!showReviews)}
          className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold hover:bg-secondary/20 transition-colors"
        >
          <span>Ver reseñas</span>
          <span className="text-xs text-muted-foreground">
            {showReviews ? "Ocultar" : "Mostrar"}
          </span>
        </button>
        {showReviews && (
          <div className="px-5 pb-5">
            <ReviewList username={username} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
