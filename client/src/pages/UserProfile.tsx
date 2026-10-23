import { apiBase } from "@/lib/queryClient";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import {
  ArrowLeft, Ban, Calendar, Flag, Loader2, MessageCircle, Pencil, UserMinus,
  UserPlus, X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  username: string;
  name?: string | null;
  avatarUrl?: string | null;
  bio?: string | null;
  role?: string | null;
  createdAt?: string;
  postsCount: number;
  followers: number;
  following: number;
  isFollowing: boolean;
  isBlocked: boolean;
  isBlockedBy: boolean;
}

interface Post {
  id: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: string | null;
  likesCount?: number;
  commentsCount?: number;
  createdAt?: string;
}

function Media({ url, type }: { url: string; type?: string | null }) {
  if (type === "video") {
    return <video src={url} controls className="w-full max-h-80 object-cover" />;
  }
  if (type === "3d_model") {
    return (
      <div className="w-full h-56 bg-black flex items-center justify-center">
        {createElement("model-viewer" as any, { src: url, "camera-controls": true, "auto-rotate": true, style: { width: "100%", height: "100%" } })}
      </div>
    );
  }
  return <img src={url} alt="Publicación" className="w-full max-h-80 object-cover" loading="lazy" />;
}

export default function UserProfile() {
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params.username || "");
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const avatarRef = useRef<HTMLInputElement>(null);

  const isOwn = user?.username === username;

  const load = useCallback(async () => {
    if (!username) return;
    try {
      const viewer = user?.username ? `?viewer=${encodeURIComponent(user.username)}` : "";
      const [profileRes, postsRes] = await Promise.all([
        fetch(`${apiBase}/api/social/users/${encodeURIComponent(username)}/profile${viewer}`, { credentials: "include" }),
        fetch(`${apiBase}/api/social/users/${encodeURIComponent(username)}/posts`, { credentials: "include" }),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.profile);
        setBio(data.profile.bio || "");
        setName(data.profile.name || "");
      } else {
        setProfile(null);
      }
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts || []);
      }
    } finally {
      setLoading(false);
    }
  }, [username, user?.username]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!profile || !user) return;
    const method = profile.isFollowing ? "DELETE" : "POST";
    const res = await fetch(`${apiBase}/api/social/follow`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ followingUsername: profile.username }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast({ title: "Acción no disponible", description: data.message, variant: "destructive" });
      return;
    }
    load();
  };

  const toggleBlock = async () => {
    if (!profile) return;
    if (!profile.isBlocked && !window.confirm(`¿Bloquear a @${profile.username}? Dejarán de ver tu contenido.`)) return;
    const res = await fetch(`${apiBase}/api/social/block`, {
      method: profile.isBlocked ? "DELETE" : "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: profile.username }),
    });
    if (res.ok) {
      toast({ title: profile.isBlocked ? "Usuario desbloqueado" : "Usuario bloqueado" });
      load();
    }
  };

  const sendReport = async () => {
    const res = await fetch(`${apiBase}/api/social/report`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, reason: reportReason, details: reportDetails }),
    });
    const data = await res.json();
    if (res.ok) {
      toast({ title: "Reporte enviado", description: data.message });
      setReportOpen(false);
      setReportDetails("");
    } else {
      toast({ title: "Error", description: data.message, variant: "destructive" });
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${apiBase}/api/user/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, name, bio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast({ title: "Perfil actualizado" });
      setEditing(false);
      load();
    } catch (err: any) {
      toast({ title: "No se pudo guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Imagen demasiado grande", description: "Máximo 10 MB", variant: "destructive" });
      return;
    }
    const form = new FormData();
    form.append("file", file);
    form.append("category", "avatars");
    form.append("userId", username);
    const uploadRes = await fetch(`${apiBase}/api/upload`, { method: "POST", body: form, credentials: "include" });
    const uploaded = await uploadRes.json();
    if (!uploadRes.ok) {
      toast({ title: "Error al subir la imagen", description: uploaded.message, variant: "destructive" });
      return;
    }
    await fetch(`${apiBase}/api/user/profile`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, avatarUrl: uploaded.url }),
    });
    load();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="container mx-auto py-24 text-center space-y-4">
          <h1 className="text-2xl font-bold">Usuario no encontrado</h1>
          <Button onClick={() => setLocation("/social")}>Volver a ViaSocial</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-3xl mx-auto px-4 py-8 mt-16 space-y-6">
        <button onClick={() => setLocation("/social")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Volver al feed
        </button>

        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative">
              {profile.avatarUrl ? (
                <img src={profile.avatarUrl} alt={profile.username} className="w-24 h-24 rounded-full object-cover border-2 border-primary/40" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-secondary flex items-center justify-center text-2xl font-bold text-primary">
                  {profile.username.slice(0, 2).toUpperCase()}
                </div>
              )}
              {isOwn && (
                <>
                  <button onClick={() => avatarRef.current?.click()} className="absolute -bottom-1 -right-1 p-2 rounded-full bg-primary text-black shadow">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <input ref={avatarRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                    onChange={e => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
                </>
              )}
            </div>

            <div className="flex-1 space-y-1">
              <h1 className="text-2xl font-bold">@{profile.username}</h1>
              <p className="text-sm text-muted-foreground">{profile.name || profile.username} · {profile.role || "traveler"}</p>
              <div className="flex gap-4 text-sm">
                <span><strong>{profile.postsCount}</strong> publicaciones</span>
                <span><strong>{profile.followers}</strong> seguidores</span>
                <span><strong>{profile.following}</strong> siguiendo</span>
              </div>
            </div>
          </div>

          {editing ? (
            <div className="space-y-3">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={120}
                className="w-full bg-secondary/30 border border-border/50 rounded-xl px-3 py-2 text-sm" placeholder="Nombre" />
              <Textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={500}
                className="bg-secondary/30 border-border/50 rounded-xl min-h-[80px]" placeholder="Cuéntanos sobre ti" />
              <div className="flex gap-2">
                <Button onClick={saveProfile} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}</Button>
                <Button variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {profile.bio || (isOwn ? "Añade una biografía para que la comunidad te conozca." : "Sin biografía todavía.")}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40">
            {profile.createdAt && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground mr-auto">
                <Calendar className="h-3.5 w-3.5" /> Miembro desde {new Date(profile.createdAt).toLocaleDateString("es-CO")}
              </span>
            )}
            {isOwn ? (
              <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4 mr-2" /> Editar perfil</Button>
            ) : (
              <>
                {!profile.isBlocked && (
                  <Button onClick={toggleFollow} variant={profile.isFollowing ? "outline" : "default"}>
                    {profile.isFollowing ? <UserMinus className="h-4 w-4 mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    {profile.isFollowing ? "Dejar de seguir" : "Seguir"}
                  </Button>
                )}
                {!profile.isBlockedBy && (
                  <Link href={`/messages?to=${encodeURIComponent(profile.username)}`}>
                    <Button variant="outline"><MessageCircle className="h-4 w-4 mr-2" /> Mensaje</Button>
                  </Link>
                )}
                <Button variant="outline" onClick={toggleBlock}>
                  <Ban className="h-4 w-4 mr-2" /> {profile.isBlocked ? "Desbloquear" : "Bloquear"}
                </Button>
                <Button variant="ghost" onClick={() => setReportOpen(true)}>
                  <Flag className="h-4 w-4 mr-2" /> Reportar
                </Button>
              </>
            )}
          </div>
        </section>

        {profile.isBlocked || profile.isBlockedBy ? (
          <p className="text-center text-sm text-muted-foreground py-12">Contenido no disponible.</p>
        ) : (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">Actividad</h2>
            {posts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Aún no hay publicaciones.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {posts.map(post => (
                  <div key={post.id} className="rounded-xl overflow-hidden border border-border/40 bg-card">
                    {post.mediaUrl ? (
                      <Media url={post.mediaUrl} type={post.mediaType} />
                    ) : (
                      <div className="h-32 p-3 text-xs text-muted-foreground overflow-hidden">{post.content}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      {reportOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setReportOpen(false)}>
          <div className="bg-card border border-border/50 rounded-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Reportar a @{profile.username}</h2>
              <button onClick={() => setReportOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <select value={reportReason} onChange={e => setReportReason(e.target.value)}
              className="w-full bg-secondary/30 border border-border/50 rounded-xl px-3 py-2 text-sm">
              <option value="spam">Spam</option>
              <option value="acoso">Acoso</option>
              <option value="contenido_inapropiado">Contenido inapropiado</option>
              <option value="suplantacion">Suplantación de identidad</option>
              <option value="otro">Otro</option>
            </select>
            <Textarea value={reportDetails} onChange={e => setReportDetails(e.target.value)} maxLength={1000}
              placeholder="Detalles adicionales (opcional)" className="bg-secondary/30 border-border/50 rounded-xl" />
            <Button className="w-full" onClick={sendReport}><Flag className="h-4 w-4 mr-2" /> Enviar reporte</Button>
          </div>
        </div>
      )}
    </div>
  );
}
