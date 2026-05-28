import { apiBase } from "@/lib/queryClient";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Send, Loader2, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

// ── Star Rating Input ─────────────────────────────────────────────────────────

function StarRating({ value, onChange, size = 28 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="transition-transform hover:scale-110 active:scale-95"
        >
          <Star
            style={{ width: size, height: size }}
            className={`transition-colors ${
              star <= (hover || value)
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── Star Display (read-only) ──────────────────────────────────────────────────

export function StarDisplay({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          style={{ width: size, height: size }}
          className={star <= Math.round(rating) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}
        />
      ))}
    </div>
  );
}

// ── Review Form (para dejar reseña después de un viaje) ───────────────────────

interface ReviewFormProps {
  rideId: string;
  authorUsername: string;
  targetUsername: string;
  authorRole: "traveler" | "taxi";
  onSubmitted?: () => void;
  onCancel?: () => void;
}

export function ReviewForm({ rideId, authorUsername, targetUsername, authorRole, onSubmitted, onCancel }: ReviewFormProps) {
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({ title: "Selecciona una calificación", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(apiBase + "/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rideId, authorUsername, targetUsername, rating,
          comment: comment.trim() || null, authorRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "¡Reseña enviada!", description: "Gracias por tu calificación" });
      onSubmitted?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl p-5 space-y-4"
    >
      <div className="text-center space-y-1">
        <h4 className="text-lg font-bold">
          {authorRole === "traveler" ? "¿Cómo fue tu viaje?" : "¿Cómo fue el pasajero?"}
        </h4>
        <p className="text-sm text-muted-foreground">
          Califica a <span className="font-semibold text-foreground">{targetUsername}</span>
        </p>
      </div>

      <div className="flex justify-center py-2">
        <StarRating value={rating} onChange={setRating} size={36} />
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Escribe un comentario (opcional)..."
        maxLength={300}
        rows={3}
        className="w-full bg-secondary/30 border border-border/40 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-primary/40 transition-colors placeholder:text-muted-foreground/50"
      />

      <div className="flex gap-3">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="flex-1 rounded-xl">
            Omitir
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={submitting || rating === 0}
          className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground font-bold gap-2"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? "Enviando..." : "Enviar Reseña"}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Review List (mostrar reseñas de un usuario) ──────────────────────────────

interface ReviewListProps {
  username: string;
}

export function ReviewList({ username }: ReviewListProps) {
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [loading, setLoading] = useState(true);

  useState(() => {
    fetch(`${apiBase}/api/reviews/${username}`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews || []);
        setAvgRating(data.averageRating || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  });

  if (loading) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/20 border border-border/30">
        <div className="flex items-center gap-1.5">
          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
          <span className="text-lg font-bold">{avgRating > 0 ? avgRating.toFixed(1) : "—"}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {reviews.length} {reviews.length === 1 ? "reseña" : "reseñas"}
        </span>
      </div>

      {/* Reviews */}
      {reviews.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground flex flex-col items-center gap-2">
          <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
          <p>Aún no hay reseñas</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {reviews.map((rev: any) => (
            <motion.div
              key={rev.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-xl bg-secondary/20 border border-border/30 space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">{rev.authorUsername}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    {rev.authorRole === "taxi" ? "Taxista" : "Viajero"}
                  </span>
                </div>
                <StarDisplay rating={rev.rating} size={12} />
              </div>
              {rev.comment && (
                <p className="text-sm text-muted-foreground pl-9">{rev.comment}</p>
              )}
              <p className="text-[10px] text-muted-foreground/60 pl-9">
                {new Date(rev.createdAt).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
