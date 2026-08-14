import { apiBase } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { Heart, MessageCircle, Share2, Plus, X, Send, Image as ImageIcon, Video, Loader2, Trash2, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import TranslatedText from "@/components/TranslatedText";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Post {
  id: string;
  username: string;
  caption: string | null;
  media_url: string | null;
  media_type: "image" | "video" | "360_image" | "360_video" | "3d_model";
  likes_count: number;
  comments_count: number;
  created_at: string;
  avatar_url: string | null;
}

interface Comment {
  id: string;
  username: string;
  content: string;
  created_at: string;
  avatar_url: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function timeAgo(iso: string) {
  // Ensure the timestamp is treated as UTC if it doesn't specify a timezone
  const dateStr = iso.endsWith("Z") ? iso : `${iso}Z`;
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  
  if (diff < 0) return "ahora"; // Handle minor clock skews
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function Avatar({ username, src, size = 36 }: { username: string; src?: string | null; size?: number }) {
  const initials = username.slice(0, 2).toUpperCase();
  return src ? (
    <img src={src} alt={username} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-bold text-xs text-black"
      style={{
        width: size,
        height: size,
        background: `hsl(${username.charCodeAt(0) * 15 % 360}, 70%, 60%)`,
        fontSize: size * 0.35,
      }}
    >
      {initials}
    </div>
  );
}

/* ─── PostCard ────────────────────────────────────────────────────────────── */
function PostCard({ post, currentUser, onDelete }: { post: Post; currentUser: string | null; onDelete: (id: string) => void }) {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(post.likes_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const { toast } = useToast();

  // Check if current user liked this post
  useEffect(() => {
    if (!currentUser) return;
    fetch(`${apiBase}/api/social/posts/${post.id}/likes/check?username=${encodeURIComponent(currentUser)}`)
      .then(r => r.json())
      .then(d => setLiked(d.liked))
      .catch(() => {});
  }, [post.id, currentUser]);

  const handleLike = async () => {
    if (!currentUser) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikes(l => wasLiked ? l - 1 : l + 1);
    try {
      const method = wasLiked ? "DELETE" : "POST";
      await fetch(`${apiBase}/api/social/posts/${post.id}/like`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser }),
      });
    } catch {
      setLiked(wasLiked);
      setLikes(l => wasLiked ? l + 1 : l - 1);
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    try {
      const r = await fetch(`${apiBase}/api/social/posts/${post.id}/comments`);
      const d = await r.json();
      setComments(d.comments || []);
    } finally {
      setLoadingComments(false);
    }
  };

  const toggleComments = () => {
    if (!showComments) loadComments();
    setShowComments(s => !s);
  };

  const postComment = async () => {
    if (!currentUser || !newComment.trim()) return;
    setPostingComment(true);
    try {
      const r = await fetch(`${apiBase}/api/social/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser, content: newComment.trim() }),
      });
      if (r.ok) {
        setNewComment("");
        loadComments();
      }
    } finally {
      setPostingComment(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `@${post.username} en VIANova`, text: post.caption || "", url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiado al portapapeles" });
    }
  };

  const handleDelete = async () => {
    if (!currentUser || currentUser !== post.username) return;
    await fetch(`${apiBase}/api/social/posts/${post.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser }),
    });
    onDelete(post.id);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card/60 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-xl hover:shadow-primary/5 transition-shadow"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Avatar username={post.username} src={post.avatar_url} size={42} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground leading-tight">@{post.username}</p>
          <p className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</p>
        </div>
        {currentUser === post.username && (
          <button
            onClick={handleDelete}
            className="p-1.5 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Caption */}
      {post.caption && (
        <p className="px-5 pb-3 text-sm leading-relaxed text-foreground/90"><TranslatedText text={post.caption} /></p>
      )}

      {/* Media */}
      {post.media_url && (
        <div className="relative bg-black/30">
          {post.media_type.includes("video") ? (
            <video
              src={post.media_url}
              className="w-full max-h-[500px] object-cover"
              controls
              playsInline
              preload="metadata"
            />
          ) : (
            <img
              src={post.media_url}
              alt={post.caption || "post"}
              className="w-full max-h-[500px] object-cover"
              loading="lazy"
            />
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-4 py-3 border-t border-white/5">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all select-none ${
            liked ? "text-red-400 bg-red-400/10" : "text-muted-foreground hover:text-red-400 hover:bg-red-400/10"
          }`}
        >
          <Heart className={`h-4 w-4 transition-transform ${liked ? "fill-red-400 scale-110" : ""}`} />
          <span>{likes}</span>
        </button>

        <button
          onClick={toggleComments}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
        >
          <MessageCircle className="h-4 w-4" />
          <span>{post.comments_count}</span>
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-blue-400 hover:bg-blue-400/10 transition-all"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
              {loadingComments ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">Sé el primero en comentar</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} className="flex gap-2.5">
                    <Avatar username={c.username} src={c.avatar_url} size={28} />
                    <div className="bg-secondary/30 rounded-xl px-3 py-2 flex-1">
                      <p className="text-xs font-bold text-primary mb-0.5">@{c.username}</p>
                      <p className="text-sm text-foreground/90">{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {currentUser && (
              <div className="px-5 pb-4 flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && postComment()}
                  placeholder="Escribe un comentario…"
                  className="flex-1 bg-secondary/30 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={postComment}
                  disabled={postingComment || !newComment.trim()}
                  className="p-2 bg-primary text-black rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-50"
                >
                  {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
}

/* ─── CreatePostModal ─────────────────────────────────────────────────────── */
function CreatePostModal({ onClose, onCreated, username }: { onClose: () => void; onCreated: (p: Post) => void; username: string }) {
  const [caption, setCaption] = useState("");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (type: "image" | "video") => {
    setMediaType(type);
    if (fileRef.current) {
      fileRef.current.accept = type === "video" ? "video/*" : "image/*";
      fileRef.current.click();
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setMediaFile(f);
    const url = URL.createObjectURL(f);
    setMediaPreview(url);
  };

  const submit = async () => {
    if (!caption.trim() && !mediaFile) return;
    setLoading(true);
    try {
      let uploadedUrl = null;
      if (mediaFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", mediaFile);
        uploadForm.append("category", "social");
        uploadForm.append("userId", username);
        const uploadRes = await fetch(apiBase + "/api/upload", { method: "POST", body: uploadForm });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.message || "Failed to upload file");
        uploadedUrl = uploadData.url;
      }

      const postBody = {
        content: caption.trim(),
        mediaUrl: uploadedUrl,
        mediaType: mediaType
      };

      const r = await fetch(apiBase + "/api/social/posts", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody) 
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      
      // Remapear al formato frontend esperado
      const frontendPost = {
        id: d.id,
        username: username,
        caption: d.content,
        media_url: d.mediaUrl,
        media_type: d.mediaType,
        likes_count: 0,
        comments_count: 0,
        created_at: d.createdAt,
        avatar_url: null
      };

      onCreated(frontendPost);
      toast({ title: "¡Publicado! 🎉" });
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.95 }}
        className="bg-card border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-lg">Nueva Publicación</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary/50 rounded-lg transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <Textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="¿Qué estás pensando?"
            className="min-h-[100px] bg-secondary/20 border-white/10 rounded-xl resize-none focus:border-primary/50"
          />

          {mediaPreview && (
            <div className="relative rounded-xl overflow-hidden">
              {mediaType === "video" ? (
                <video src={mediaPreview} className="w-full max-h-64 object-cover" controls />
              ) : (
                <img src={mediaPreview} alt="preview" className="w-full max-h-64 object-cover" />
              )}
              <button
                onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                className="absolute top-2 right-2 p-1 bg-black/60 rounded-full hover:bg-black/80 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => pickFile("image")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            >
              <ImageIcon className="h-4 w-4" /> Foto
            </button>
            <button
              onClick={() => pickFile("video")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
            >
              <Video className="h-4 w-4" /> Video
            </button>
            <input ref={fileRef} type="file" className="hidden" onChange={onFileChange} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6">
          <Button
            onClick={submit}
            disabled={loading || (!caption.trim() && !mediaFile)}
            className="w-full bg-primary text-black font-bold rounded-xl hover:bg-primary/80"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Publicar
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── Main Social Feed Page ───────────────────────────────────────────────── */
export default function SocialFeed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false); // Ref para evitar doble fetch sin romper useCallback

  const fetchFeed = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const r = await fetch(`${apiBase}/api/social/posts`, { credentials: 'include' });
      const data = await r.json();

      if (!Array.isArray(data)) {
        console.warn("[SocialFeed] Backend devolvió no-array:", data);
        if (reset) setPosts([]);
        setHasMore(false);
        return;
      }

      // Soportar campos camelCase (alias) Y snake_case (directo de BD)
      const mappedPosts: Post[] = data.map((p: any) => ({
        id: p.id,
        username: p.authorUsername ?? p.username ?? 'Anónimo',
        caption: p.content ?? p.caption ?? '',
        media_url: p.mediaUrl ?? p.media_url ?? null,
        media_type: p.mediaType ?? p.media_type ?? 'image',
        likes_count: p.likesCount ?? p.likes_count ?? p.likes?.length ?? 0,
        comments_count: p.commentsCount ?? p.comments_count ?? p.comments?.length ?? 0,
        created_at: p.createdAt ?? p.created_at ?? new Date().toISOString(),
        avatar_url: p.authorAvatar ?? p.avatar_url ?? null,
      }));

      setPosts(prev => reset ? mappedPosts : [...prev, ...mappedPosts]);
      setHasMore(false);
    } catch (err) {
      console.error("[SocialFeed] Error al cargar posts:", err);
      if (reset) setPosts([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []); // Sin dependencias — usa ref para la guard

  // Initial load
  useEffect(() => { fetchFeed(true); }, []);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !loading) fetchFeed(); },
      { threshold: 0.1 }
    );
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [fetchFeed, hasMore, loading]);

  const handleDelete = (id: string) => setPosts(p => p.filter(post => post.id !== id));

  const handleCreated = (post: Post) => setPosts(p => [post, ...p]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Hero Banner */}
      <div className="relative overflow-hidden border-b border-white/5 bg-gradient-to-r from-background via-primary/5 to-background">
        <div className="container max-w-2xl mx-auto px-4 py-10 text-center">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter flex justify-center items-center gap-3 mb-3">
              <MapPin className="h-8 w-8 md:h-10 md:w-10 text-primary animate-bounce" />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary via-orange-400 to-primary bg-[length:300%] animate-gradient">
                ViaSocial
              </span>
            </h1>
            <h2 className="text-2xl font-bold text-foreground/90">
              Comparte tu <span className="text-primary">Aventura</span>
            </h2>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
              Hoteles, restaurantes, destinos — comparte tu experiencia con viajeros de todo el país.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Feed */}
      <div className="container max-w-2xl mx-auto px-4 py-8 space-y-5">
        <AnimatePresence mode="popLayout">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user?.username ?? null}
              onDelete={handleDelete}
            />
          ))}
        </AnimatePresence>

        {/* Loader sentinel */}
        <div ref={loaderRef} className="py-8 flex justify-center">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Cargando más...
            </div>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-xs text-muted-foreground/50">Has llegado al final del feed ✨</p>
          )}
          {!loading && posts.length === 0 && (
            <div className="text-center py-16 space-y-3">
              <div className="text-5xl">🌟</div>
              <p className="font-semibold text-lg">¡Sé el primero en publicar!</p>
              <p className="text-muted-foreground text-sm">Comparte tu experiencia de viaje con la comunidad.</p>
            </div>
          )}
        </div>
      </div>

      {/* FAB — Create post */}
      {user && (
        <motion.button
          onClick={() => setShowCreate(true)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="fixed bottom-8 right-6 z-40 w-14 h-14 rounded-full bg-primary text-black shadow-2xl shadow-primary/40 flex items-center justify-center hover:bg-primary/80 transition-colors"
        >
          <Plus className="h-7 w-7 font-bold" />
        </motion.button>
      )}

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && user && (
          <CreatePostModal
            username={user.username}
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
