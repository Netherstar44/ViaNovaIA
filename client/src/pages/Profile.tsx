import { apiBase } from "@/lib/queryClient";
import { authHeaders } from "@/lib/secureStorage";
import { useAuth } from "@/lib/auth";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  Camera,
  Check,
  Eye,
  EyeOff,
  Globe,
  ImagePlus,
  Loader2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";

type ContactVisibility = "public" | "followers" | "private";

type ProfileForm = {
  name: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactWebsite: string;
  contactVisibility: ContactVisibility;
};

const EMPTY_FORM: ProfileForm = {
  name: "",
  bio: "",
  avatarUrl: "",
  bannerUrl: "",
  contactEmail: "",
  contactPhone: "",
  contactWebsite: "",
  contactVisibility: "private",
};

const VISIBILITY_OPTIONS: Array<{
  value: ContactVisibility;
  label: string;
  description: string;
  icon: typeof Eye;
}> = [
  {
    value: "public",
    label: "Todos",
    description: "Cualquier persona que visite tu perfil.",
    icon: Globe,
  },
  {
    value: "followers",
    label: "Seguidores",
    description: "Solo quienes te siguen en ViaSocial.",
    icon: UserRound,
  },
  {
    value: "private",
    label: "Solo yo",
    description: "Nadie más puede ver tus datos de contacto.",
    icon: EyeOff,
  },
];

function initials(name: string, username: string) {
  const source = (name || username || "?").trim();
  return source.slice(0, 2).toUpperCase();
}

function toForm(user: any): ProfileForm {
  return {
    name: user?.name || "",
    bio: user?.bio || "",
    avatarUrl: user?.avatarUrl || "",
    bannerUrl: user?.bannerUrl || "",
    contactEmail: user?.contactEmail || "",
    contactPhone: user?.contactPhone || "",
    contactWebsite: user?.contactWebsite || "",
    contactVisibility: (user?.contactVisibility || "private") as ContactVisibility,
  };
}

export default function Profile() {
  const { user, loading: authLoading, refreshUser } = useAuth();
  const [, setLocation] = useLocation();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const [initialForm, setInitialForm] = useState<ProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      if (!authLoading) setLocation("/login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/user/profile`, {
          credentials: "include",
          headers: await authHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "No se pudo cargar tu perfil");
        if (!cancelled) {
          const loaded = toForm(data.user);
          setForm(loaded);
          setInitialForm(loaded);
        }
      } catch (err: any) {
        if (!cancelled) {
          setMessage({ type: "error", text: err?.message || "No se pudo cargar tu perfil" });
          const fallback = toForm(user);
          setForm(fallback);
          setInitialForm(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.username, authLoading, setLocation]);

  if (!user) {
    return authLoading ? (
      <div className="min-h-screen bg-background"><Navbar />
        <div className="flex justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    ) : null;
  }

  const update = <K extends keyof ProfileForm>(field: K, value: ProfileForm[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleUpload = async (file: File, kind: "avatars" | "banners") => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage({ type: "error", text: "Usa una imagen JPG, PNG o WebP." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "La imagen debe pesar máximo 5 MB." });
      return;
    }

    const field = kind === "avatars" ? "avatarUrl" : "bannerUrl";
    setUploading(kind === "avatars" ? "avatar" : "banner");
    setMessage(null);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("category", kind);
      const res = await fetch(`${apiBase}/api/upload`, {
        method: "POST",
        credentials: "include",
        headers: await authHeaders(),
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo subir la imagen");
      update(field, data.url || "");
      setMessage({ type: "success", text: "Imagen subida. Pulsa «Guardar cambios» para aplicarla." });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "No se pudo subir la imagen" });
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage({ type: "error", text: "El nombre no puede estar vacío." });
      return;
    }

    // Enviar solo campos modificados: evita revalidar URLs heredadas que el
    // usuario no ha tocado y reduce escrituras/auditoría innecesarias.
    const normalized: ProfileForm = {
      name: form.name.trim(),
      bio: form.bio.trim(),
      avatarUrl: form.avatarUrl,
      bannerUrl: form.bannerUrl,
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      contactWebsite: form.contactWebsite.trim(),
      contactVisibility: form.contactVisibility,
    };
    const initial: ProfileForm = {
      ...initialForm,
      name: initialForm.name.trim(),
      bio: initialForm.bio.trim(),
      contactEmail: initialForm.contactEmail.trim(),
      contactPhone: initialForm.contactPhone.trim(),
      contactWebsite: initialForm.contactWebsite.trim(),
    };
    const payload: Record<string, unknown> = {};
    if (normalized.name !== initial.name) payload.name = normalized.name;
    if (normalized.bio !== initial.bio) payload.bio = normalized.bio;
    if (normalized.avatarUrl !== initial.avatarUrl) payload.avatarUrl = normalized.avatarUrl || null;
    if (normalized.bannerUrl !== initial.bannerUrl) payload.bannerUrl = normalized.bannerUrl || null;
    if (normalized.contactEmail !== initial.contactEmail) payload.contactEmail = normalized.contactEmail || null;
    if (normalized.contactPhone !== initial.contactPhone) payload.contactPhone = normalized.contactPhone || null;
    if (normalized.contactWebsite !== initial.contactWebsite) payload.contactWebsite = normalized.contactWebsite || null;
    if (normalized.contactVisibility !== initial.contactVisibility) payload.contactVisibility = normalized.contactVisibility;

    if (Object.keys(payload).length === 0) {
      setMessage({ type: "success", text: "No hay cambios para guardar." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${apiBase}/api/user/profile`, {
        method: "PATCH",
        credentials: "include",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "No se pudo guardar el perfil");

      const current = useAuth.getState().user;
      if (current) {
        localStorage.setItem("user", JSON.stringify({ ...current, ...data.user }));
        refreshUser();
      }
      const saved = toForm(data.user);
      setForm(saved);
      setInitialForm(saved);
      setMessage({ type: "success", text: "Perfil actualizado correctamente." });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "No se pudo guardar el perfil" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="container max-w-4xl px-4 py-8 mt-16">
        <button
          onClick={() => setLocation("/dashboard")}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Volver al panel
        </button>

        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Mi Perfil</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Personaliza cómo te ven los demás en VIANova.
            </p>
          </div>
          <Link href={`/u/${encodeURIComponent(user.username)}`}>
            <Button variant="outline" className="rounded-xl">
              <Eye className="mr-2 h-4 w-4" /> Ver perfil público
            </Button>
          </Link>
        </div>

        {message && (
          <div
            className={`mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm ${
              message.type === "success"
                ? "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400"
                : "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400"
            }`}
            role="status"
          >
            {message.type === "success" ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto opacity-70 hover:opacity-100" aria-label="Cerrar aviso">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="overflow-hidden rounded-3xl border border-border/40 bg-card shadow-sm">
          {/* Banner */}
          <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-primary/40 via-primary/15 to-transparent sm:h-56">
            {form.bannerUrl ? (
              <img src={form.bannerUrl} alt="Banner del perfil" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground/70">
                Añade un banner para darle personalidad a tu perfil
              </div>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/45 to-transparent p-3">
              {form.bannerUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="rounded-xl"
                  onClick={() => update("bannerUrl", "")}
                  disabled={Boolean(uploading)}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Quitar
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="rounded-xl"
                onClick={() => bannerInputRef.current?.click()}
                disabled={Boolean(uploading)}
              >
                {uploading === "banner" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="mr-2 h-4 w-4" />
                )}
                Cambiar banner
              </Button>
              <input
                ref={bannerInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleUpload(file, "banners");
                  event.currentTarget.value = "";
                }}
              />
            </div>
          </div>

          <div className="px-5 pb-8 sm:px-8">
            <div className="-mt-14 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full border-4 border-card bg-secondary shadow-lg">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt={`Avatar de ${user.username}`} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-primary-ink">
                    {initials(form.name, user.username)}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={Boolean(uploading)}
                  className="absolute bottom-1 right-1 rounded-full bg-primary p-2 text-primary-foreground shadow transition hover:bg-primary/90 disabled:opacity-60"
                  aria-label="Cambiar avatar"
                >
                  {uploading === "avatar" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleUpload(file, "avatars");
                    event.currentTarget.value = "";
                  }}
                />
              </div>

              <div className="min-w-0 flex-1 sm:pb-2">
                <h2 className="truncate text-2xl font-bold">{form.name || user.name || user.username}</h2>
                <p className="text-sm text-muted-foreground">
                  @{user.username} · {user.role}
                </p>
              </div>

              {form.avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-start text-muted-foreground hover:text-destructive sm:self-auto sm:pb-3"
                  onClick={() => update("avatarUrl", "")}
                >
                  <Trash2 className="mr-2 h-4 w-4" /> Quitar avatar
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-7 w-7 animate-spin text-primary" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-8">
                <section className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Información pública</h3>
                    <p className="mt-1 text-xs text-muted-foreground">Tu nombre y biografía son visibles para todos.</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="profile-name" className="text-xs font-medium text-muted-foreground">Nombre</label>
                      <input
                        id="profile-name"
                        value={form.name}
                        onChange={(event) => update("name", event.target.value)}
                        maxLength={120}
                        required
                        className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
                        placeholder="Tu nombre"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="profile-bio" className="text-xs font-medium text-muted-foreground">Biografía</label>
                      <textarea
                        id="profile-bio"
                        value={form.bio}
                        onChange={(event) => update("bio", event.target.value)}
                        maxLength={500}
                        rows={4}
                        className="w-full resize-none rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
                        placeholder="Cuéntanos sobre ti, tu negocio o tus viajes"
                      />
                      <p className="text-right text-[11px] text-muted-foreground">{form.bio.length}/500</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-4 border-t border-border/40 pt-6">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">Contacto</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Elige qué datos compartes y con quién. Por defecto tu contacto es privado.
                    </p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label htmlFor="profile-email" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Mail className="h-3.5 w-3.5" /> Correo
                      </label>
                      <input
                        id="profile-email"
                        type="email"
                        value={form.contactEmail}
                        onChange={(event) => update("contactEmail", event.target.value)}
                        maxLength={254}
                        autoComplete="email"
                        className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
                        placeholder="contacto@ejemplo.com"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label htmlFor="profile-phone" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" /> Teléfono
                      </label>
                      <input
                        id="profile-phone"
                        type="tel"
                        value={form.contactPhone}
                        onChange={(event) => update("contactPhone", event.target.value)}
                        maxLength={32}
                        autoComplete="tel"
                        className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
                        placeholder="+57 300 123 4567"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <label htmlFor="profile-website" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Globe className="h-3.5 w-3.5" /> Sitio web o red social
                      </label>
                      <input
                        id="profile-website"
                        type="url"
                        value={form.contactWebsite}
                        onChange={(event) => update("contactWebsite", event.target.value)}
                        maxLength={300}
                        inputMode="url"
                        className="w-full rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 text-sm outline-none transition focus:border-primary/60 focus:ring-1 focus:ring-primary/40"
                        placeholder="https://tu-sitio.com"
                      />
                      <p className="text-[11px] text-muted-foreground">Solo se aceptan enlaces HTTPS públicos.</p>
                    </div>
                  </div>

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-muted-foreground">¿Quién puede ver tu contacto?</legend>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {VISIBILITY_OPTIONS.map((option) => {
                        const Icon = option.icon;
                        const active = form.contactVisibility === option.value;
                        return (
                          <label
                            key={option.value}
                            className={`flex cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm transition ${
                              active
                                ? "border-primary/60 bg-primary/10"
                                : "border-border/50 bg-secondary/20 hover:border-border"
                            }`}
                          >
                            <input
                              type="radio"
                              name="contactVisibility"
                              value={option.value}
                              checked={active}
                              onChange={() => update("contactVisibility", option.value)}
                              className="mt-0.5 accent-primary"
                            />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-medium">
                                <Icon className="h-3.5 w-3.5" /> {option.label}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-muted-foreground">{option.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="flex items-start gap-2 rounded-xl border border-border/40 bg-secondary/20 p-3 text-[11px] text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary-ink" />
                    <p>
                      Nunca mostramos tu correo de inicio de sesión. Los datos de contacto solo se publican si eliges una
                      visibilidad distinta de «Solo yo» y se validan en el servidor antes de guardarse.
                    </p>
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-5">
                  <Link href={`/u/${encodeURIComponent(user.username)}`}>
                    <Button type="button" variant="ghost" className="rounded-xl">
                      Cancelar
                    </Button>
                  </Link>
                  <Button type="submit" disabled={saving} className="rounded-xl bg-primary font-semibold text-primary-foreground hover:bg-primary/90">
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Guardar cambios
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
