import { apiBase } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { motion } from "framer-motion";
import { Loader2, ShoppingCart, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/media/MediaGallery";
import { useLocation } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import { productGallery, type CatalogMedia } from "@shared/catalog-media";
import { useToast } from "@/hooks/use-toast";

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: string;
  currency: string;
  stock: number;
  cover_image: string | null;
  role_category: string;
  provider_name: string;
  provider_username: string;
  avatar_url: string | null;
  media?: CatalogMedia[];
}

export default function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [checkingOut, setCheckingOut] = useState(false);
  const { toast } = useToast();
  
  // Bookings state
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  const maxQuantity = product.stock === -1 ? 99 : Math.max(0, Number(product.stock) || 0);
  const soldOut = maxQuantity === 0;
  const totalPrice = Number(product.price) * quantity;

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setMediaError(false); setMedia([]);
    const loadMedia = async () => {
      try {
        const assets = product.media ?? await fetch(`${apiBase}/api/products/${encodeURIComponent(product.id)}/media`).then(async response => {
          if (!response.ok) throw new Error("No se pudieron cargar los archivos.");
          return (await response.json()).media;
        });
        if (!cancelled) setMedia(productGallery(product.cover_image, product.name, assets));
      } catch { if (!cancelled) { setMedia(productGallery(product.cover_image, product.name, [])); setMediaError(true); } }
      finally { if (!cancelled) setLoading(false); }
    };
    void loadMedia();

    // Fetch availability slots
    fetch(`${apiBase}/api/bookings/slots/${product.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSlots(d))
      .catch(() => setSlots([]));
    return () => { cancelled = true; };
  }, [product]);

  const handleCheckout = async () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    if (soldOut) {
      return toast({ title: "Agotado", description: "Este producto no tiene stock disponible.", variant: "destructive" });
    }
    if (!selectedSlotId && slots.length > 0) {
      return toast({ title: "Atención", description: "Por favor selecciona un horario disponible", variant: "destructive" });
    }
    if (quantity < 1 || quantity > maxQuantity) {
      return toast({ title: "Cantidad inválida", description: `Puedes comprar entre 1 y ${maxQuantity} unidades.`, variant: "destructive" });
    }

    setCheckingOut(true);
    try {
      let finalBookingId = null;

      // 1. Lock slot si hay sistema de reservas
      if (selectedSlotId) {
        const lockRes = await fetch(apiBase + "/api/bookings/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId: selectedSlotId, units: quantity })
        });
        const lockData = await lockRes.json();
        if (!lockRes.ok) throw new Error(lockData.message || "No se pudo bloquear el espacio");
        finalBookingId = lockData.booking.id;

        // 2. Simular pago y confirmar la reserva en lugar de ir a Stripe
        const confirmRes = await fetch(apiBase + "/api/bookings/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId: finalBookingId })
        });
        
        if (!confirmRes.ok) throw new Error("Error en el pago simulado");
        
        toast({ title: "Reserva registrada", description: "El pago PSE queda pendiente de verificación por el proveedor." });
        setTimeout(() => onClose(), 2000);
        return;
      }

      // Fallback: crear la orden directamente (pago simulado PSE / coordinación con el proveedor)
      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(apiBase + "/api/orders", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          buyerUsername: user.username,
          productId: product.id,
          quantity,
          notes: "Compra desde el marketplace — pago simulado PSE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "No se pudo crear la orden");

      toast({
        title: "Orden creada",
        description: `El proveedor confirmará ${quantity}x ${product.name}. Total ${totalPrice.toLocaleString("es-CO", { style: "currency", currency: product.currency, maximumFractionDigits: 0 })}.`,
      });
      setTimeout(() => onClose(), 1600);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setCheckingOut(false);
    }
  };

  const slotsForSelectedDate = slots.filter(s => {
    if (!selectedDate) return false;
    const sDate = new Date(s.startTime);
    return sDate.getDate() === selectedDate.getDate() && sDate.getMonth() === selectedDate.getMonth();
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="glass-scrim glass-scrim--deep fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-6"
    >
      <button onClick={onClose} aria-label="Cerrar producto" className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors">
        <X className="h-6 w-6" />
      </button>

      <motion.div 
        initial={{ y: 50, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.98 }}
        className="w-full h-full sm:h-[85vh] max-w-6xl bg-card border border-border/50 sm:rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-2xl"
      >
        {/* Media Section */}
        <div className="relative h-[52dvh] min-h-[200px] w-full shrink-0 border-b border-border/50 bg-black/50 sm:h-[50vh] lg:h-full lg:w-3/5 lg:shrink lg:border-b-0 lg:border-r">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <><MediaGallery media={media} />{mediaError && <p role="alert" className="absolute bottom-4 left-4 right-4 rounded bg-background p-3 text-sm text-foreground">No se pudieron cargar los archivos adicionales. Reabre el producto para reintentar.</p>}</>
          )}
        </div>

        {/* Info Section */}
        <div className="w-full lg:w-2/5 flex-1 min-h-0 lg:h-full lg:flex-none flex flex-col bg-gradient-to-b from-card to-background overflow-y-auto">
          <div className="p-6 lg:p-10 flex-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-secondary/50 overflow-hidden border border-border/50 shrink-0">
                {product.avatar_url ? (
                  <img src={product.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold">
                    {product.provider_name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{product.provider_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 text-primary fill-primary" />
                  Proveedor verificado
                </p>
              </div>
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase mb-4 border border-primary/20">
              {product.role_category}
            </span>
            
            <h2 className="text-3xl font-extrabold text-foreground mb-2 leading-tight">{product.name}</h2>
            <div className="text-2xl font-bold text-primary mb-6">
              {Number(product.price).toLocaleString("es-CO", { style: "currency", currency: product.currency, maximumFractionDigits: 0 })}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Descripción</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {product.description || "Sin descripción detallada. Contacta al proveedor para más información."}
              </p>
            </div>

            <div className="mt-8 pt-8 border-t border-border/40 space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Disponibilidad y Reservas</h3>
              {slots.length === 0 ? (
                <div className="flex justify-between items-center text-sm p-4 bg-background/50 rounded-xl border border-border/40">
                  <span className="text-muted-foreground">Inventario (Sin turnos asignados)</span>
                  <span className={soldOut ? "font-bold text-red-400" : "text-foreground font-medium"}>
                    {product.stock === -1 ? "Ilimitada" : soldOut ? "Agotado" : `${product.stock} unidades`}
                  </span>
                </div>
              ) : (
                <div className="bg-background/50 border border-border/40 rounded-2xl p-4 space-y-4">
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={es}
                      className="bg-transparent border-none text-foreground pointer-events-auto"
                    />
                  </div>
                  <div className="space-y-2 pt-4 border-t border-border/40">
                    {slotsForSelectedDate.length === 0 ? (
                       <p className="text-sm text-center text-muted-foreground py-2">No hay horarios para este día.</p>
                    ) : (
                      slotsForSelectedDate.map(slot => {
                        const available = slot.capacity - (slot.booked || 0);
                        const isSelected = selectedSlotId === slot.id;
                        return (
                          <button 
                            key={slot.id}
                            onClick={() => setSelectedSlotId(slot.id)}
                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${
                              isSelected 
                                ? "border-primary bg-primary/10" 
                                : "border-border/50 bg-secondary/40 hover:border-primary/40"
                            }`}
                          >
                            <span className="font-bold text-sm">
                              {format(new Date(slot.startTime), "HH:mm")} - {format(new Date(slot.endTime), "HH:mm")}
                            </span>
                            <span className="text-xs bg-black/40 px-2 py-1 rounded text-primary">
                              {available} cupos libres
                            </span>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="p-6 sm:p-10 pt-4 bg-background border-t border-border/40 shrink-0 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Cantidad</p>
                <div className="mt-1 flex items-center rounded-xl border border-border/50 bg-secondary/20">
                  <button
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1 || soldOut || checkingOut}
                    className="h-9 w-9 text-lg font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-bold">{quantity}</span>
                  <button
                    onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))}
                    disabled={quantity >= maxQuantity || soldOut || checkingOut}
                    className="h-9 w-9 text-lg font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Total</p>
                <p className="mt-1 text-xl font-extrabold text-primary">
                  {totalPrice.toLocaleString("es-CO", { style: "currency", currency: product.currency, maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
            <Button 
              onClick={handleCheckout} 
              disabled={checkingOut || soldOut}
              className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-black hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20 disabled:hover:scale-100"
            >
              {checkingOut ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShoppingCart className="h-5 w-5 mr-2" />}
              {checkingOut ? "Procesando..." : soldOut ? "Agotado" : "Comprar Ahora"}
            </Button>
            <p className="text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
              Pago simulado PSE · El proveedor confirma tu orden
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
