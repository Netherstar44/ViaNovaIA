import { apiBase } from "@/lib/queryClient";
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Star, Trash2 } from 'lucide-react';
import TranslatedText from "./TranslatedText";
import { useTranslation } from "react-i18next";

interface CommentItem {
  id: string;
  authorUsername: string;
  content: string;
  rating?: number | null;
  createdAt?: string;
}

export default function Comments({ locationId }: { locationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [content, setContent] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);

  const avgRating = useMemo(() => {
    if (!comments.length) return null;
    const vals = comments.map(c => c.rating || 0);
    const sum = vals.reduce((a, b) => a + b, 0);
    return (sum / vals.length).toFixed(1);
  }, [comments]);

  useEffect(() => {
    let ignore = false;
    const fetchComments = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/api/comments?locationId=${encodeURIComponent(locationId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Error cargando comentarios');
        if (!ignore) setComments(data.comments || []);
      } catch (e: any) {
        toast({ title: 'Error', description: e.message || 'No se pudieron cargar los comentarios', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchComments();
    return () => { ignore = true; };
  }, [locationId, toast]);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({ title: t('comments.required_title', 'Contenido requerido'), description: t('comments.required_desc', 'Escribe un comentario antes de enviar.') });
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        locationId,
        authorUsername: user?.username || 'anon',
        content,
        rating,
      };
      const res = await fetch(apiBase + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'No se pudo enviar el comentario');
      setComments(prev => [data.comment, ...prev]);
      setContent('');
      setRating(5);
      toast({ title: t('comments.success_title', 'Comentario publicado'), description: t('comments.success_desc', 'Gracias por tu aporte.') });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'No se pudo enviar el comentario', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, authorUsername: string) => {
    try {
      const res = await fetch(`${apiBase}/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: authorUsername }),
      });
      if (!res.ok) throw new Error('No se pudo eliminar el comentario');
      setComments(prev => prev.filter(c => c.id !== id));
      toast({ title: t('comments.deleted_title', 'Comentario eliminado'), description: t('comments.deleted_desc', 'Tu reseña ha sido borrada.') });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold">{t('comments.title', 'Reseñas y Comentarios')}</CardTitle>
          {avgRating && (
            <div className="flex items-center gap-1 text-amber-400" title="Calificación promedio">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold">{avgRating}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Formulario */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold mr-2">{t('comments.your_rating', 'Tu calificación:')}</span>
            <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-6 w-6 cursor-pointer transition-all ${
                    (hoverRating || rating) >= star 
                      ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]' 
                      : 'text-muted-foreground/30 hover:text-amber-200'
                  }`}
                  onMouseEnter={() => setHoverRating(star)}
                  onClick={() => setRating(star)}
                />
              ))}
            </div>
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('comments.placeholder', 'Comparte tu experiencia...')}
            className="bg-background/50"
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? t('comments.submitting', 'Enviando...') : t('comments.submit_btn', 'Publicar comentario')}
            </Button>
          </div>
        </div>

        {/* Listado */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">{t('comments.loading', 'Cargando comentarios...')}</div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('comments.empty', 'Sé el primero en comentar.')}</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="rounded-md border border-border/50 p-3 bg-background/40">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{c.authorUsername}</span>
                    {c.authorUsername === user?.username && (
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(c.id, c.authorUsername)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {typeof c.rating === 'number' && (
                    <span className="text-xs text-amber-400 flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" /> {c.rating}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                  <TranslatedText text={c.content} />
                </p>
                {c.createdAt && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    {new Date(c.createdAt).toLocaleString()}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
