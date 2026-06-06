import { apiBase } from "@/lib/queryClient";
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Star, Trash2, Edit2, Check, X, Reply, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import TranslatedText from "./TranslatedText";
import { useTranslation } from "react-i18next";

interface CommentReply {
  id: string;
  authorUsername: string;
  content: string;
  rating?: number | null;
  createdAt?: string;
  updatedAt?: string;
  parentCommentId?: string | null;
}

interface CommentItem {
  id: string;
  authorUsername: string;
  content: string;
  rating?: number | null;
  createdAt?: string;
  updatedAt?: string;
  hidden?: boolean;
  replyContent?: string | null;
  replyCreatedAt?: string | null;
  parentCommentId?: string | null;
  replies?: CommentReply[];
}

/** Devuelve los minutos restantes de la ventana de edición (0 si ya expiró) */
function getEditMinutesLeft(createdAt?: string): number {
  if (!createdAt) return 0;
  const ms = 10 * 60 * 1000 - (Date.now() - new Date(createdAt).getTime());
  return Math.max(0, Math.floor(ms / 60000));
}

export default function Comments({ locationId }: { locationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Nuevo comentario
  const [content, setContent] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);

  // Edición de comentario propio (ventana 10 min)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');

  // Respuestas anidadas de usuarios
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState<string>('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const avgRating = useMemo(() => {
    if (!comments.length) return null;
    const vals = comments.map(c => c.rating || 0).filter(v => v > 0);
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return (sum / vals.length).toFixed(1);
  }, [comments]);

  const fetchComments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${apiBase}/api/comments?locationId=${encodeURIComponent(locationId)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'Error cargando comentarios');
      // Filtrar comentarios ocultos para la vista pública
      const visible = (data.comments || []).filter((c: CommentItem) => !c.hidden);
      setComments(visible);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'No se pudieron cargar los comentarios', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${apiBase}/api/comments?locationId=${encodeURIComponent(locationId)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Error cargando comentarios');
        if (!ignore) {
          const visible = (data.comments || []).filter((c: CommentItem) => !c.hidden);
          setComments(visible);
        }
      } catch (e: any) {
        toast({ title: 'Error', description: e.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    run();
    return () => { ignore = true; };
  }, [locationId, toast]);

  // ── Publicar nuevo comentario ────────────────────────────────────────────────
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
        credentials: 'include',
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

  // ── Publicar respuesta anidada (usuario → comentario) ────────────────────────
  const handleSubmitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    if (!user?.username) {
      toast({ title: 'Inicia sesión', description: 'Debes estar autenticado para responder.', variant: 'destructive' });
      return;
    }
    try {
      setSubmitting(true);
      const body = {
        locationId,
        authorUsername: user.username,
        content: replyContent,
        parentCommentId: parentId,
      };
      const res = await fetch(apiBase + '/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message);
      // Agregar respuesta al comentario padre en UI
      setComments(prev => prev.map(c =>
        c.id === parentId
          ? { ...c, replies: [...(c.replies || []), data.comment] }
          : c
      ));
      setReplyContent('');
      setReplyingToId(null);
      setExpandedReplies(prev => new Set(prev).add(parentId));
      toast({ title: 'Respuesta publicada' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Editar comentario propio (solo dentro de 10 min) ─────────────────────────
  const handleStartEdit = (c: CommentItem) => {
    const minsLeft = getEditMinutesLeft(c.createdAt);
    if (minsLeft <= 0) {
      toast({ title: 'Tiempo expirado', description: 'Solo puedes editar dentro de los primeros 10 minutos.', variant: 'destructive' });
      return;
    }
    setEditingId(c.id);
    setEditContent(c.content);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`${apiBase}/api/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: user?.username, content: editContent }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.expired) {
          toast({ title: 'Tiempo expirado', description: 'La ventana de 10 minutos ha cerrado.', variant: 'destructive' });
        } else {
          throw new Error(data?.message);
        }
        return;
      }
      setComments(prev => prev.map(c => c.id === id ? { ...c, content: data.comment.content, updatedAt: data.comment.updatedAt } : c));
      setEditingId(null);
      toast({ title: 'Comentario actualizado' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  // ── Eliminar comentario propio ───────────────────────────────────────────────
  const handleDelete = async (id: string, authorUsername: string) => {
    try {
      const res = await fetch(`${apiBase}/api/comments/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        {/* Formulario nuevo comentario */}
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

        {/* Listado de comentarios */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-sm text-muted-foreground">{t('comments.loading', 'Cargando comentarios...')}</div>
          ) : comments.length === 0 ? (
            <div className="text-sm text-muted-foreground">{t('comments.empty', 'Sé el primero en comentar.')}</div>
          ) : (
            comments.map((c) => {
              const isOwn = c.authorUsername === user?.username;
              const minsLeft = isOwn ? getEditMinutesLeft(c.createdAt) : 0;
              const canEdit = isOwn && minsLeft > 0;
              const hasReplies = (c.replies?.length ?? 0) > 0;
              const repliesExpanded = expandedReplies.has(c.id);

              return (
                <div key={c.id} className="rounded-md border border-border/50 p-3 bg-background/40 space-y-2">
                  {/* Cabecera comentario */}
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{c.authorUsername}</span>
                      {c.updatedAt && (
                        <span className="text-[10px] text-muted-foreground italic">(editado)</span>
                      )}
                      {/* Acciones del autor */}
                      {isOwn && (
                        <div className="flex items-center gap-1 ml-1">
                          {canEdit && editingId !== c.id && (
                            <Button
                              variant="ghost" size="sm"
                              className="h-6 w-6 p-0 text-blue-400/70 hover:text-blue-400"
                              title={`Editar (${minsLeft} min restantes)`}
                              onClick={() => handleStartEdit(c)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost" size="sm"
                            className="h-6 w-6 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(c.id, c.authorUsername)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {typeof c.rating === 'number' && c.rating > 0 && (
                        <span className="text-xs text-amber-400 flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" /> {c.rating}
                        </span>
                      )}
                      {canEdit && editingId !== c.id && (
                        <span className="text-[10px] text-blue-400 flex items-center gap-0.5">
                          <Clock className="h-3 w-3" /> {minsLeft}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Contenido (normal o en edición) */}
                  {editingId === c.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                        className="text-sm bg-background/50"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                          <X className="h-4 w-4 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" onClick={() => handleSaveEdit(c.id)}>
                          <Check className="h-4 w-4 mr-1" /> Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                      <TranslatedText text={c.content} />
                    </p>
                  )}

                  {/* Fecha */}
                  {c.createdAt && (
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                  )}

                  {/* Respuesta oficial del restaurante */}
                  {c.replyContent && (
                    <div className="ml-4 pl-3 border-l-2 border-primary/30 bg-primary/5 rounded-r-md py-2 pr-2">
                      <p className="text-xs font-semibold text-primary mb-0.5">🍽️ Respuesta del Restaurante</p>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{c.replyContent}</p>
                      {c.replyCreatedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(c.replyCreatedAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Respuestas anidadas de otros usuarios */}
                  {hasReplies && (
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
                      onClick={() => setExpandedReplies(prev => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        return next;
                      })}
                    >
                      {repliesExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {c.replies!.length} {c.replies!.length === 1 ? 'respuesta' : 'respuestas'}
                    </button>
                  )}

                  {repliesExpanded && c.replies && c.replies.length > 0 && (
                    <div className="ml-4 space-y-2 pt-1">
                      {c.replies.map(r => (
                        <div key={r.id} className="rounded border border-border/30 bg-background/30 p-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold">{r.authorUsername}</span>
                            {r.createdAt && (
                              <span className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</span>
                            )}
                          </div>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap">{r.content}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Botón / formulario de respuesta de usuario */}
                  {user && replyingToId !== c.id && (
                    <button
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => { setReplyingToId(c.id); setReplyContent(''); }}
                    >
                      <Reply className="h-3 w-3" /> Responder
                    </button>
                  )}

                  {replyingToId === c.id && (
                    <div className="ml-4 space-y-2 mt-1">
                      <Textarea
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Escribe tu respuesta..."
                        rows={2}
                        className="text-sm bg-background/50"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => setReplyingToId(null)}>
                          <X className="h-3 w-3 mr-1" /> Cancelar
                        </Button>
                        <Button size="sm" disabled={submitting} onClick={() => handleSubmitReply(c.id)}>
                          <Check className="h-3 w-3 mr-1" /> Publicar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
