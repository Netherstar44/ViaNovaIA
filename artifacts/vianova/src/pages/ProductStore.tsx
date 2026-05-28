import { apiBase } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, MapPin, ShoppingCart, Filter, Star, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaGallery } from "@/components/media/MediaGallery";
import { useLocation } from "wouter";
import { Calendar } from "@/components/ui/calendar";
import { es } from "date-fns/locale";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Product {
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
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [checkingOut, setCheckingOut] = useState(false);
  const { toast } = useToast();
  
  // Bookings state
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  useEffect(() => {
    // Fetch full product details including all media assets
    fetch(`${apiBase}/api/products/provider/${product.provider_username}`)
      .then(r => r.json())
      .then(d => {
        const fullProduct = d.products?.find((p: any) => p.id === product.id);
        const assets = fullProduct?.media || [];
        // always put cover_image first if it exists
        const formatted = [];
        if (product.cover_image) {
          formatted.push({ id: 'cover', url: product.cover_image, type: 'image', caption: product.name });
        }
        assets.forEach((a: any) => {
          if (a.url !== product.cover_image) formatted.push(a);
        });
        setMedia(formatted);
      })
      .finally(() => setLoading(false));

    // Fetch availability slots
    fetch(`${apiBase}/api/bookings/slots/${product.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSlots(d))
      .catch(() => setSlots([]));
  }, [product]);

  const handleCheckout = async () => {
    if (!user) {
      setLocation("/login");
      return;
    }
    if (!selectedSlotId && slots.length > 0) {
      return toast({ title: "Atención", description: "Por favor selecciona un horario disponible", variant: "destructive" });
    }

    setCheckingOut(true);
    try {
      let finalBookingId = null;

      // 1. Lock slot si hay sistema de reservas
      if (selectedSlotId) {
        const lockRes = await fetch(apiBase + "/api/bookings/lock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slotId: selectedSlotId, units: 1 })
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
        
        toast({ title: "¡Reserva Confirmada!", description: "El pago se procesó con éxito simulando PSE." });
        setTimeout(() => onClose(), 2000);
        return;
      }

      // Si no hay slots (fallback e-commerce normal), usar Stripe
      const res = await fetch(apiBase + "/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, buyerUsername: user.username, quantity: 1 })
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      
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
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-0 sm:p-6"
    >
      <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white transition-colors">
        <X className="h-6 w-6" />
      </button>

      <motion.div 
        initial={{ y: 50, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.98 }}
        className="w-full h-full sm:h-[85vh] max-w-6xl bg-card border border-white/10 sm:rounded-3xl overflow-hidden flex flex-col lg:flex-row shadow-2xl"
      >
        {/* Media Section */}
        <div className="w-full lg:w-3/5 h-[50vh] lg:h-full bg-black/50 relative border-b lg:border-b-0 lg:border-r border-white/10">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <MediaGallery media={media} />
          )}
        </div>

        {/* Info Section */}
        <div className="w-full lg:w-2/5 h-full flex flex-col bg-gradient-to-b from-card to-background overflow-y-auto">
          <div className="p-6 sm:p-10 flex-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-secondary/50 overflow-hidden border border-white/10 shrink-0">
                {product.avatar_url ? (
                  <img src={product.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/20 text-primary font-bold">
                    {product.provider_name.charAt(0)}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{product.provider_name}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Star className="h-3 w-3 text-primary fill-primary" />
                  Proveedor verificado
                </p>
              </div>
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase mb-4 border border-primary/20">
              {product.role_category}
            </span>
            
            <h2 className="text-3xl font-extrabold text-white mb-2 leading-tight">{product.name}</h2>
            <div className="text-2xl font-bold text-primary mb-6">
              {Number(product.price).toLocaleString("es-CO", { style: "currency", currency: product.currency, maximumFractionDigits: 0 })}
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Descripción</h3>
              <p className="text-muted-foreground leading-relaxed text-sm">
                {product.description || "Sin descripción detallada. Contacta al proveedor para más información."}
              </p>
            </div>

            <div className="mt-8 pt-8 border-t border-white/5 space-y-4">
              <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wider mb-2">Disponibilidad y Reservas</h3>
              {slots.length === 0 ? (
                <div className="flex justify-between items-center text-sm p-4 bg-background/50 rounded-xl border border-white/5">
                  <span className="text-muted-foreground">Inventario (Sin turnos asignados)</span>
                  <span className="text-white font-medium">
                    {product.stock === -1 ? "Ilimitada" : `${product.stock} unidades`}
                  </span>
                </div>
              ) : (
                <div className="bg-background/50 border border-white/5 rounded-2xl p-4 space-y-4">
                  <div className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      locale={es}
                      className="bg-transparent border-none text-white pointer-events-auto"
                    />
                  </div>
                  <div className="space-y-2 pt-4 border-t border-white/5">
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
                                : "border-white/10 bg-black/20 hover:border-white/30"
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

          <div className="p-6 sm:p-10 pt-4 bg-background border-t border-white/5 shrink-0">
            <Button 
              onClick={handleCheckout} 
              disabled={checkingOut}
              className="w-full h-14 text-base font-bold rounded-2xl bg-primary text-black hover:bg-primary/90 hover:scale-[1.02] transition-all shadow-lg shadow-primary/20"
            >
              {checkingOut ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <ShoppingCart className="h-5 w-5 mr-2" />}
              {checkingOut ? "Procesando pago..." : "Comprar Ahora"}
            </Button>
            <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1">
               Pagos seguros procesados por Stripe
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ProductStore() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    setLoading(true);
    const url = category ? `/api/products?category=${category}` : `/api/products`;
    fetch(url)
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .finally(() => setLoading(false));
  }, [category]);

  const categories = [
    { id: null, label: "Todos" },
    { id: "hotel", label: "Hoteles" },
    { id: "restaurant", label: "Restaurantes" },
    { id: "recreation", label: "Experiencias" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <div className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background pointer-events-none" />
        <div className="container relative z-10 text-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-full bg-secondary/50 text-muted-foreground text-xs font-semibold tracking-wide uppercase mb-4 border border-white/10">
              VIANova Marketplace
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight mb-6 leading-tight">
              Descubre experiencias <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-yellow-200">inolvidables</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Reserva hoteles, mesas y aventuras directamente con proveedores locales. Visualiza en 3D y 360° antes de comprar.
            </p>
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} 
            className="flex flex-wrap justify-center gap-2 mt-10"
          >
            {categories.map(cat => (
              <button
                key={cat.id || "all"}
                onClick={() => setCategory(cat.id)}
                className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                  category === cat.id 
                    ? "bg-primary text-black shadow-lg shadow-primary/20 scale-105" 
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary border border-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="container px-4 pb-24">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : products.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/10 rounded-3xl bg-secondary/10">
            <Filter className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">No se encontraron productos</h3>
            <p className="text-muted-foreground">Intenta cambiar los filtros de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="group bg-card/40 border border-white/5 rounded-3xl overflow-hidden hover:border-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/5 cursor-pointer flex flex-col h-full"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-secondary/30">
                  {product.cover_image ? (
                    <img 
                      src={product.cover_image} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/30">
                      <ShoppingCart className="h-10 w-10 mb-2" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {/* Badge */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider border border-white/10">
                    {product.role_category}
                  </div>
                </div>

                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate">{product.provider_name}</span>
                  </div>
                  <h3 className="font-bold text-white text-lg leading-tight mb-1 group-hover:text-primary transition-colors line-clamp-2">
                    {product.name}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 mt-auto pt-4">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <span className="text-primary font-bold text-lg">
                      {Number(product.price).toLocaleString("es-CO", { style: "currency", currency: product.currency, maximumFractionDigits: 0 })}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {selectedProduct && (
          <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
