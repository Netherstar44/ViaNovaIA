import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { apiBase } from "@/lib/queryClient";
import { MessageCircle, MapPin, Star, Image, Car, Calendar, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface ProfileData {
  id: string;
  username: string;
  name?: string;
  bio?: string;
  avatarUrl?: string;
  role: string;
  city?: string;
  createdAt?: string;
}

interface ActivityItem {
  type: "post" | "ride" | "booking";
  title: string;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  traveler: "Viajero",
  hotel: "Hotel",
  restaurant: "Restaurante",
  recreation: "Recreación",
  taxi: "Taxista",
  translator: "Traductor",
  admin: "Admin",
};

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  post: <Image className="h-4 w-4 text-primary" />,
  ride: <Car className="h-4 w-4 text-yellow-500" />,
  booking: <Calendar className="h-4 w-4 text-blue-500" />,
};

const ACTIVITY_LABELS: Record<string, string> = {
  post: "Publicó",
  ride: "Viaje a",
  booking: "Reserva con",
};

export default function UserProfile() {
  const params = useParams<{ username: string }>();
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const username = params.username;
  const isOwn = user?.username === username;

  useEffect(() => {
    if (!username) return;
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/users/${username}/profile`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null).then(d => d?.profile && setProfile(d.profile)),
      fetch(`${apiBase}/api/users/${username}/activity`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null).then(d => d?.activity && setActivity(d.activity)),
      fetch(`${apiBase}/api/reviews/${username}`, { credentials: "include" })
        .then(r => r.ok ? r.json() : null).then(d => { if (d) { setReviews(d.reviews || []); setAvgRating(d.averageRating); } }),
    ]).finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Usuario no encontrado</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="container max-w-2xl mx-auto p-4 space-y-6">
        <button onClick={() => window.history.back()} className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mt-2">
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden border-4 border-primary/30">
              {profile.avatarUrl
                ? <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover" />
                : <span className="text-3xl font-bold text-primary">{(profile.name || profile.username)[0].toUpperCase()}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{profile.name || profile.username}</h1>
              <p className="text-muted-foreground text-sm">@{profile.username}</p>
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full capitalize">
                  {ROLE_LABELS[profile.role] || profile.role}
                </span>
                {profile.city && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {profile.city}
                  </span>
                )}
                {avgRating !== null && avgRating > 0 && (
                  <span className="text-xs text-yellow-500 flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-500" /> {Number(avgRating).toFixed(1)}
                  </span>
                )}
              </div>
              {profile.bio && <p className="text-sm text-muted-foreground mt-2">{profile.bio}</p>}
            </div>
          </div>

          {!isOwn && user && (
            <div className="flex gap-2 mt-4">
              <Button size="sm" onClick={() => setLocation(`/messages/${profile.username}`)} className="gap-2">
                <MessageCircle className="h-4 w-4" /> Mensaje directo
              </Button>
            </div>
          )}
          {isOwn && (
            <div className="mt-4">
              <Button size="sm" variant="outline" onClick={() => setLocation("/settings")}>
                Editar perfil
              </Button>
            </div>
          )}
        </motion.div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" /> Reseñas ({reviews.length})
            </h2>
            <div className="space-y-3">
              {reviews.slice(0, 5).map((r: any) => (
                <div key={r.id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">@{r.authorUsername}</span>
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < r.rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Activity */}
        {activity.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-card border border-border rounded-2xl p-5">
            <h2 className="font-semibold mb-4">Actividad reciente</h2>
            <div className="space-y-3">
              {activity.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 mt-0.5">
                    {ACTIVITY_ICONS[item.type]}
                  </div>
                  <div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">{ACTIVITY_LABELS[item.type]}: </span>
                      <span className="font-medium">{item.title || "—"}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activity.length === 0 && reviews.length === 0 && (
          <div className="text-center text-muted-foreground py-8 text-sm">Sin actividad reciente.</div>
        )}
      </div>
    </div>
  );
}
