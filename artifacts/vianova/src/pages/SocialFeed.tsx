import { apiBase } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { Heart, MessageCircle, Share2, Plus, X, Send, Image as ImageIcon, Video, Loader2, Trash2, MapPin, Rotate3d, Glasses, Compass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import TranslatedText from "@/components/TranslatedText";
import { MediaViewer } from "@/components/multimedia/MediaViewer";
import { MediaAsset } from "@/components/multimedia/MediaGallery";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface Post {
  id: string;
  username: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
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
function PostCard({ post, currentUser, onDelete, onOpenMedia }: { post: Post; currentUser: string | null; onDelete: (id: string) => void; onOpenMedia: (post: Post) => void }) {
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
        <a href={`/profile/${post.username}`} className="flex-shrink-0">
          <Avatar username={post.username} src={post.avatar_url} size={42} />
        </a>
        <div className="flex-1 min-w-0">
          <a href={`/profile/${post.username}`} className="font-bold text-sm text-foreground leading-tight hover:text-primary transition-colors">@{post.username}</a>
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
          {post.media_type === "video" || post.media_type === "video/mp4" || post.media_type?.includes("video") ? (
            <video
              src={post.media_url}
              className="w-full max-h-[500px] object-cover"
              controls
              playsInline
              preload="metadata"
            />
          ) : post.media_type === "360" || post.media_type === "360_image" || post.media_type === "3d" || post.media_type === "3d_model" || post.media_type === "vr" || post.media_type === "vr_tour" || post.media_type === "IMAGE_360" || post.media_type === "MODEL_3D" || post.media_type === "VR_TOUR" ? (
            <div className="relative w-full h-64 bg-slate-950 flex flex-col items-center justify-center p-6 border-y border-white/5 overflow-hidden">
              {/* Blur background */}
              <div className="absolute inset-0 bg-cover bg-center opacity-20 filter blur-lg" style={{ backgroundImage: `url(${post.media_url})` }}></div>
              <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                <div className="p-4 bg-cyan-500/15 border border-cyan-400/20 rounded-full text-cyan-400">
                  {post.media_type?.includes("3d") || post.media_type?.includes("3D") ? <Rotate3d className="w-8 h-8" /> : (post.media_type?.includes("vr") || post.media_type?.includes("VR") ? <Glasses className="w-8 h-8" /> : <Compass className="w-8 h-8" />)}
                </div>
                <div>
                  <h4 className="font-bold text-slate-200 text-sm uppercase tracking-wider">
                    {post.media_type?.includes("3d") || post.media_type?.includes("3D") ? "Contenido 3D Interactivo" : (post.media_type?.includes("vr") || post.media_type?.includes("VR") ? "Recorrido Virtual VR" : "Fotografía 360° Panorámica")}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs">Haz clic abajo para sumergirte en la experiencia completa.</p>
                </div>
                <button
                  onClick={() => onOpenMedia(post)}
                  className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {post.media_type?.includes("3d") || post.media_type?.includes("3D") ? "Abrir Visor 3D" : (post.media_type?.includes("vr") || post.media_type?.includes("VR") ? "Iniciar VR" : "Explorar en 360°")}
                </button>
              </div>
            </div>
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
  const [mediaType, setMediaType] = useState<"image" | "video" | "360" | "3d" | "vr">("image");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (type: "image" | "video" | "360" | "3d" | "vr") => {
    setMediaType(type);
    if (fileRef.current) {
      if (type === "video") {
        fileRef.current.accept = "video/mp4,video/webm";
      } else if (type === "3d") {
        fileRef.current.accept = ".glb,.gltf";
      } else {
        fileRef.current.accept = "image/jpeg,image/png,image/webp";
      }
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
      let finalMediaType: string = mediaType;
      if (mediaFile) {
        const uploadForm = new FormData();
        uploadForm.append("file", mediaFile);
        uploadForm.append("title", caption ? caption.substring(0, 30) : mediaFile.name);
        uploadForm.append("entityType", "post");
        if (mediaType === "360") {
          uploadForm.append("is360", "true");
        } else if (mediaType === "vr") {
          uploadForm.append("isVR", "true");
        }
        
        // Call unified media assets uploader
        const uploadRes = await fetch(apiBase + "/api/media-assets/upload", { method: "POST", body: uploadForm, credentials: "include" });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.message || "Failed to upload file");
        uploadedUrl = uploadData.fileUrl;
        finalMediaType = uploadData.assetType;
      }

      const postBody = {
        content: caption.trim(),
        mediaUrl: uploadedUrl,
        mediaType: finalMediaType
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

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => pickFile("image")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${mediaType === "image" ? "border-primary text-primary bg-primary/5" : "border-white/10 text-muted-foreground hover:text-primary"}`}
            >
              <ImageIcon className="h-4 w-4" /> Foto
            </button>
            <button
              onClick={() => pickFile("video")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${mediaType === "video" ? "border-primary text-primary bg-primary/5" : "border-white/10 text-muted-foreground hover:text-primary"}`}
            >
              <Video className="h-4 w-4" /> Video
            </button>
            <button
              onClick={() => pickFile("360")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${mediaType === "360" ? "border-primary text-primary bg-primary/5" : "border-white/10 text-muted-foreground hover:text-primary"}`}
            >
              <Compass className="h-4 w-4 text-cyan-400" /> Foto 360°
            </button>
            <button
              onClick={() => pickFile("3d")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${mediaType === "3d" ? "border-primary text-primary bg-primary/5" : "border-white/10 text-muted-foreground hover:text-primary"}`}
            >
              <Rotate3d className="h-4 w-4 text-purple-400" /> 3D GLB
            </button>
            <button
              onClick={() => pickFile("vr")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm transition-colors ${mediaType === "vr" ? "border-primary text-primary bg-primary/5" : "border-white/10 text-muted-foreground hover:text-primary"}`}
            >
              <Glasses className="h-4 w-4 text-pink-400" /> VR Tour
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
  const [activeTab, setActiveTab] = useState<"all" | "mine">("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<MediaAsset | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const fetchFeed = useCallback(async (reset = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      const url = activeTab === "mine" && user
        ? `${apiBase}/api/social/posts/user/${encodeURIComponent(user.username)}`
        : `${apiBase}/api/social/posts`;
      const r = await fetch(url, { credentials: 'include' });
      const raw = await r.json();
      const data = Array.isArray(raw) ? raw : (raw.posts ?? []);

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

      setPosts(prev => {
        const list = reset ? mappedPosts : [...prev, ...mappedPosts];
        const seen = new Set();
        return list.filter(p => {
          if (seen.has(p.id)) return false;
          seen.add(p.id);
          return true;
        });
      });
      setHasMore(false);
    } catch (err) {
      console.error("[SocialFeed] Error al cargar posts:", err);
      if (reset) setPosts([]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [activeTab, user?.username]);

  // Reload when tab changes
  useEffect(() => { fetchFeed(true); }, [activeTab]);

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

      {/* Tabs */}
      {user && (
        <div className="container max-w-2xl mx-auto px-4 pt-4">
          <div className="flex gap-1 bg-secondary/30 rounded-full p-1 w-fit">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Todos
            </button>
            <button
              onClick={() => setActiveTab("mine")}
              className={`px-5 py-1.5 rounded-full text-sm font-medium transition-all ${activeTab === "mine" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Mis Posts
            </button>
          </div>
        </div>
      )}

      {/* Feed */}
      <div className="container max-w-2xl mx-auto px-4 py-4 space-y-5">
        <AnimatePresence mode="popLayout">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              currentUser={user?.username ?? null}
              onDelete={handleDelete}
              onOpenMedia={(p) => {
                let assetType: any = "IMAGE";
                if (p.media_type === "MODEL_3D" || p.media_type === "3d" || p.media_type === "3d_model") assetType = "MODEL_3D";
                else if (p.media_type === "IMAGE_360" || p.media_type === "360" || p.media_type === "360_image") assetType = "IMAGE_360";
                else if (p.media_type === "VR_TOUR" || p.media_type === "vr" || p.media_type === "vr_tour") assetType = "VR_TOUR";
                else if (p.media_type === "VIDEO" || p.media_type === "video") assetType = "VIDEO";

                setSelectedAsset({
                  id: p.id,
                  ownerId: p.username,
                  ownerRole: "traveler",
                  entityType: "post",
                  entityId: p.id,
                  title: p.caption || "Publicación",
                  description: "",
                  assetType,
                  fileUrl: p.media_url || "",
                  thumbnailUrl: p.media_url || "",
                  cloudinaryPublicId: "",
                  mimeType: assetType === "MODEL_3D" ? "application/octet-stream" : (assetType === "VIDEO" ? "video/mp4" : "image/jpeg"),
                  fileSize: 0,
                  width: null,
                  height: null,
                  duration: null,
                  is360: assetType === "IMAGE_360",
                  isVR: assetType === "VR_TOUR",
                  createdAt: p.created_at
                });
              }}
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

      {selectedAsset && (
        <MediaViewer asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  );
}
