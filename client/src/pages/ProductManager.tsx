import { apiBase } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, X, Loader2, Image as Img, Video, Package, ShoppingBag, CheckCircle2, Clock, XCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  stock: number;
  is_active: boolean;
  cover_image: string | null;
  role_category: string;
  created_at: string;
  media?: MediaAsset[];
}

interface MediaAsset {
  id: string;
  url: string;
  type: string;
  caption: string | null;
  sort_order: number;
}

interface Order {
  id: string;
  product_name: string;
  buyer_username: string;
  quantity: number;
  total: string;
  status: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  paid: "bg-green-500/10 text-green-400 border-green-500/20",
  completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  refunded: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

function formatCOP(n: string | number) {
  return Number(n).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

/* ─── ProductForm ─────────────────────────────────────────────────────────── */
function ProductForm({
  existing, username, roleCategory, onSave, onClose,
}: {
  existing?: Product | null;
  username: string;
  roleCategory: string;
  onSave: (p: Product) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(existing?.name || "");
  const [description, setDescription] = useState(existing?.description || "");
  const [price, setPrice] = useState(existing?.price || "");
  const [stock, setStock] = useState(existing?.stock !== undefined ? String(existing.stock) : "-1");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(existing?.cover_image || null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mediaType, setMediaType] = useState("image");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const mediaRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCoverFile(f);
    setCoverPreview(URL.createObjectURL(f));
  };

  const handleMediaUpload = async () => {
    if (!mediaFile || !existing?.id) return;
    setUploadingMedia(true);
    try {
      const form = new FormData();
      form.append("mediaType", mediaType);
      form.append("file", mediaFile);
      const res = await fetch(`${apiBase}/api/products/${existing.id}/media`, { method: "POST", body: form });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      
      toast({ title: "Medio añadido ✓" });
      onSave({ ...existing, media: [...(existing.media || []), d.asset] });
      setMediaFile(null);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleDeleteMedia = async (assetId: string) => {
    if (!existing?.id) return;
    try {
      await fetch(`${apiBase}/api/products/${existing.id}/media/${assetId}`, { method: "DELETE" });
      onSave({ ...existing, media: (existing.media || []).filter(m => m.id !== assetId) });
      toast({ title: "Medio eliminado" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const submit = async () => {
    if (!name || !price) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("username", username);
      form.append("name", name);
      form.append("description", description);
      form.append("price", price);
      form.append("stock", stock);
      form.append("roleCategory", roleCategory);
      if (coverFile) form.append("coverImage", coverFile);

      const url = existing ? `/api/products/${existing.id}` : "/api/products";
      const method = existing ? "PATCH" : "POST";
      const r = await fetch(url, { method, body: form });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message);
      onSave(d.product);
      toast({ title: existing ? "Producto actualizado ✓" : "Producto creado ✓" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.96 }}
        className="bg-card border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <h2 className="font-bold text-lg">{existing ? "Editar Producto" : "Nuevo Producto"}</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-secondary/50 rounded-lg"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Cover Image */}
          <div
            onClick={() => fileRef.current?.click()}
            className="relative w-full h-40 rounded-xl border-2 border-dashed border-white/10 overflow-hidden cursor-pointer hover:border-primary/40 transition-colors group bg-secondary/20 flex items-center justify-center"
          >
            {coverPreview ? (
              <>
                <img src={coverPreview} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Img className="h-6 w-6 text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Img className="h-8 w-8" /><span className="text-sm">Imagen de portada</span>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Habitación Doble con Vista"
              className="w-full bg-secondary/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Descripción</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Describe tu producto o servicio..."
              className="w-full bg-secondary/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Precio (COP) *</label>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0"
                className="w-full bg-secondary/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Stock (-1 = ilimitado)</label>
              <input type="number" value={stock} onChange={e => setStock(e.target.value)}
                className="w-full bg-secondary/20 border border-white/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-primary/50" />
            </div>
          </div>

          {existing && (
            <div className="mt-6 pt-6 border-t border-white/5 space-y-4">
              <h3 className="text-sm font-semibold">Galería Inmersiva</h3>
              
              <div className="flex flex-col gap-2 p-4 rounded-xl bg-secondary/10 border border-white/5">
                <div className="flex gap-2">
                  <select 
                    value={mediaType} 
                    onChange={(e) => setMediaType(e.target.value)}
                    className="bg-background border border-white/10 rounded-lg px-2 py-1.5 text-sm outline-none"
                  >
                    <option value="image">Imagen Normal</option>
                    <option value="video">Video</option>
                    <option value="360_image">Imagen 360°</option>
                    <option value="3d_model">Modelo 3D (.glb)</option>
                  </select>
                  <input 
                    type="file" 
                    onChange={e => setMediaFile(e.target.files?.[0] || null)} 
                    className="flex-1 text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary/20 file:text-primary file:font-semibold" 
                    accept={mediaType === '3d_model' ? '.glb' : mediaType === 'video' ? 'video/*' : 'image/*'}
                  />
                </div>
                <Button 
                  onClick={handleMediaUpload} 
                  disabled={!mediaFile || uploadingMedia} 
                  variant="outline" 
                  size="sm"
                  className="w-full border-primary/30 hover:bg-primary/10 mt-1"
                >
                  {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Subir a Galería
                </Button>
              </div>

              {existing.media && existing.media.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {existing.media.map(m => (
                    <div key={m.id} className="relative group rounded-lg overflow-hidden border border-white/10 aspect-video bg-black/40 flex items-center justify-center">
                      {m.type === 'image' || m.type === '360_image' ? (
                        <img src={m.url} className="w-full h-full object-cover opacity-60" />
                      ) : (
                        <span className="text-xs font-bold text-muted-foreground uppercase">{m.type.replace('_', ' ')}</span>
                      )}
                      <div className="absolute top-1 right-1 p-1 bg-black/60 rounded cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteMedia(m.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </div>
                      <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-black/60 rounded text-[10px] uppercase font-bold text-primary">
                        {m.type === '360_image' ? '360°' : m.type === '3d_model' ? '3D' : m.type}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">Cancelar</Button>
          <Button onClick={submit} disabled={saving || !name || !price} className="flex-1 bg-primary text-black font-bold rounded-xl hover:bg-primary/80">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {existing ? "Guardar" : "Crear"}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── ProductCard ─────────────────────────────────────────────────────────── */
function ProductCard({ product, username, onEdit, onDelete, onToggle }: {
  product: Product; username: string;
  onEdit: (p: Product) => void;
  onDelete: (id: string) => void;
  onToggle: (p: Product) => void;
}) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
      className={`bg-card/60 border rounded-2xl overflow-hidden transition-all ${product.is_active ? "border-white/5" : "border-white/5 opacity-60"}`}
    >
      {product.cover_image && (
        <div className="relative h-36 overflow-hidden">
          <img src={product.cover_image} alt={product.name} className="w-full h-full object-cover" />
          {!product.is_active && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Inactivo</span>
            </div>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-sm leading-tight">{product.name}</h3>
          <span className="text-primary font-bold text-sm whitespace-nowrap">{formatCOP(product.price)}</span>
        </div>
        {product.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{product.description}</p>}
        <div className="flex items-center gap-1.5 mt-auto">
          <button onClick={() => onEdit(product)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 text-xs transition-colors">
            <Pencil className="h-3 w-3" /> Editar
          </button>
          <button onClick={() => onToggle(product)} className="p-1.5 rounded-lg bg-secondary/40 hover:bg-secondary/70 transition-colors" title={product.is_active ? "Desactivar" : "Activar"}>
            {product.is_active ? <EyeOff className="h-3.5 w-3.5 text-yellow-400" /> : <Eye className="h-3.5 w-3.5 text-green-400" />}
          </button>
          <button onClick={() => onDelete(product.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function ProductManager() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    if (!user?.username) return;
    setLoading(true);
    Promise.all([
      fetch(`${apiBase}/api/products/provider/${user.username}`).then(r => r.json()),
      fetch(`${apiBase}/api/orders/provider/${user.username}`).then(r => r.json()),
    ]).then(([pd, od]) => {
      setProducts(pd.products || []);
      setOrders(od.orders || []);
    }).finally(() => setLoading(false));
  }, [user?.username]);

  const handleSave = (p: Product) => {
    setProducts(prev => {
      const idx = prev.findIndex(x => x.id === p.id);
      if (idx >= 0) { const next = [...prev]; next[idx] = p; return next; }
      return [p, ...prev];
    });
    setShowForm(false); setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!user?.username) return;
    await fetch(`${apiBase}/api/products/${id}`, {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user.username }),
    });
    setProducts(p => p.filter(x => x.id !== id));
    toast({ title: "Producto eliminado" });
  };

  const handleToggle = async (product: Product) => {
    if (!user?.username) return;
    const form = new FormData();
    form.append("username", user.username);
    form.append("isActive", String(!product.is_active));
    await fetch(`${apiBase}/api/products/${product.id}`, { method: "PATCH", body: form });
    setProducts(p => p.map(x => x.id === product.id ? { ...x, is_active: !x.is_active } : x));
  };

  const handleOrderStatus = async (id: string, status: string) => {
    await fetch(`${apiBase}/api/orders/${id}/status`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setOrders(o => o.map(x => x.id === id ? { ...x, status } : x));
    toast({ title: "Estado actualizado" });
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Header */}
      <div className="border-b border-white/5 bg-gradient-to-r from-primary/5 via-background to-background">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight">Mis Productos</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Gestiona tu catálogo, precios y órdenes recibidas.
              </p>
            </div>
            <Button onClick={() => { setEditing(null); setShowForm(true); }}
              className="bg-primary text-black font-bold rounded-xl gap-2 hover:bg-primary/80">
              <Plus className="h-4 w-4" /> Nuevo Producto
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-6 bg-secondary/20 border border-white/5 rounded-xl p-1 w-fit">
            {[
              { id: "products" as const, label: "Catálogo", icon: <Package className="h-4 w-4" />, count: products.length },
              { id: "orders" as const, label: "Órdenes", icon: <ShoppingBag className="h-4 w-4" />, count: orders.length },
            ].map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-primary text-black" : "text-muted-foreground hover:text-foreground"}`}>
                {t.icon} {t.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${tab === t.id ? "bg-black/20" : "bg-secondary"}`}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : tab === "products" ? (
          <>
            {products.length === 0 ? (
              <div className="text-center py-20 space-y-4">
                <Package className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-lg font-semibold">Sin productos aún</p>
                <p className="text-sm text-muted-foreground">Crea tu primer producto para que los viajeros puedan encontrarte.</p>
                <Button onClick={() => setShowForm(true)} className="bg-primary text-black rounded-xl font-bold mt-2 gap-2 hover:bg-primary/80">
                  <Plus className="h-4 w-4" /> Crear Producto
                </Button>
              </div>
            ) : (
              <AnimatePresence>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {products.map(p => (
                    <ProductCard key={p.id} product={p} username={user.username}
                      onEdit={p => { setEditing(p); setShowForm(true); }}
                      onDelete={handleDelete} onToggle={handleToggle}
                    />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </>
        ) : (
          /* Orders Tab */
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="text-center py-20 space-y-3">
                <ShoppingBag className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-lg font-semibold">Sin órdenes aún</p>
                <p className="text-sm text-muted-foreground">Las órdenes de los viajeros aparecerán aquí.</p>
              </div>
            ) : (
              orders.map(order => (
                <motion.div key={order.id} layout
                  className="bg-card/60 border border-white/5 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{order.product_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[order.status] || STATUS_COLORS.pending}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      @{order.buyer_username} · {order.quantity}x · <span className="text-primary font-bold">{formatCOP(order.total)}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/50 mt-0.5">{new Date(order.created_at).toLocaleString("es-CO")}</p>
                  </div>
                  {order.status === "pending" && (
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => handleOrderStatus(order.id, "completed")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 text-xs font-medium transition-colors">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Completar
                      </button>
                      <button onClick={() => handleOrderStatus(order.id, "cancelled")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-medium transition-colors">
                        <XCircle className="h-3.5 w-3.5" /> Cancelar
                      </button>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <ProductForm
            existing={editing}
            username={user.username}
            roleCategory={user.role}
            onSave={handleSave}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
