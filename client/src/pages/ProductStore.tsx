import { apiBase } from "@/lib/queryClient";
import { lazy, Suspense, useState, useEffect } from "react";
import Navbar from "@/components/Navbar";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, Loader2, Search, ShoppingCart, Filter } from "lucide-react";
import type { Product } from "@/components/marketplace/ProductModal";

// El modal (calendario + date-fns) se carga solo al abrir un producto. Así la
// ruta /explore no paga ese parseo en la primera navegación.
const ProductModal = lazy(() => import("@/components/marketplace/ProductModal"));

function prefetchProductModal() {
  void import("@/components/marketplace/ProductModal");
}

export default function ProductStore() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Abortar la petición anterior evita que una respuesta lenta de otra categoría
    // sobrescriba los productos que el usuario está viendo ahora.
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "50" });
    if (category) params.set("category", category);
    fetch(`${apiBase}/api/products?${params.toString()}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`El servidor respondió ${response.status}.`);
        const data = await response.json();
        if (controller.signal.aborted) return;
        setProducts(Array.isArray(data.products) ? data.products : []);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        // Un aborto es el cambio de categoría, no un fallo que deba ver el usuario.
        if (controller.signal.aborted) return;
        setProducts([]);
        setError(cause instanceof Error ? cause.message : "No hubo respuesta del servidor.");
        setLoading(false);
      });
    return () => controller.abort();
  }, [category, reloadKey]);

  const categories = [
    { id: null, label: "Todos" },
    { id: "hotel", label: "Hoteles" },
    { id: "restaurant", label: "Restaurantes" },
    { id: "recreation", label: "Experiencias" },
    { id: "taxi", label: "Transporte" },
    { id: "translator", label: "Traducción" },
  ];

  const normalizedSearch = search.trim().toLowerCase();
  const visibleProducts = normalizedSearch
    ? products.filter((product) =>
        [product.name, product.description, product.provider_name, product.role_category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch)),
      )
    : products;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main>
      {/* Hero Section */}
      <div className="relative pt-20 pb-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background pointer-events-none" />
        <div className="container relative z-10 text-center px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-full bg-secondary/50 text-muted-foreground text-xs font-semibold tracking-wide uppercase mb-4 border border-border/50">
              VIANova Marketplace
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-foreground tracking-tight mb-6 leading-tight">
              Descubre experiencias <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-amber-500">inolvidables</span>
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
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary border border-border/40"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="relative mx-auto mt-5 max-w-md"
          >
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar hoteles, experiencias, transporte..."
              className="h-11 w-full rounded-full border border-border/50 bg-secondary/30 pl-11 pr-4 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
            />
          </motion.div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="container px-4 pb-24">
        <h2 className="sr-only">Productos disponibles</h2>
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : error ? (
          <div role="alert" className="text-center py-20 border border-dashed border-destructive/40 rounded-3xl bg-secondary/10">
            <AlertCircle className="h-12 w-12 text-destructive/70 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No pudimos cargar el catálogo</h3>
            <p className="text-muted-foreground">{error} Inténtalo de nuevo en unos segundos.</p>
            <button
              type="button"
              onClick={() => setReloadKey((value) => value + 1)}
              className="mt-6 px-5 py-2.5 rounded-full bg-primary text-black text-sm font-medium shadow-lg shadow-primary/20"
            >
              Reintentar
            </button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border/50 rounded-3xl bg-secondary/10">
            <Filter className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground mb-2">No se encontraron productos</h3>
            <p className="text-muted-foreground">Intenta cambiar los filtros o el término de búsqueda.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 gap-y-10">
            {visibleProducts.map((product, i) => (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                onPointerEnter={prefetchProductModal}
                onTouchStart={prefetchProductModal}
                className="group flex flex-col h-full cursor-pointer"
              >
                <div className="relative aspect-[1/1] w-full overflow-hidden rounded-[12px] mb-3">
                  {product.cover_image ? (
                    <img 
                      src={product.cover_image} 
                      alt={product.name} 
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-secondary/30 text-muted-foreground/30">
                      <ShoppingCart className="h-10 w-10 mb-2" />
                    </div>
                  )}
                  
                  {product.stock === 0 && <div className="absolute inset-0 bg-black/50" />}
                  {/* Badge */}
                  <div className="liquid-glass-chip absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-semibold text-[#1f1f1f]">
                    {product.role_category}
                  </div>
                  <div className={`liquid-glass-chip absolute top-3 left-3 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                    product.stock === 0
                      ? "bg-red-700/90 text-white"
                      : product.stock === -1
                        ? "bg-black/75 text-white"
                        : "bg-black/75 text-primary"
                  }`}>
                    {product.stock === 0 ? "Agotado" : product.stock === -1 ? "Disponible" : `${product.stock} cupos`}
                  </div>
                </div>

                <div className="flex flex-col px-1">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-[15px] text-foreground leading-tight truncate pr-2">
                      {product.name}
                    </h3>
                  </div>
                  <p className="text-[15px] text-muted-foreground mt-1 truncate">
                    {product.provider_name}
                  </p>
                  <div className="mt-1">
                    <span className="text-foreground font-bold text-[15px]">
                      {Number(product.price).toLocaleString("es-CO", { style: "currency", currency: product.currency, maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      </main>

      <Suspense
        fallback={
          <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        }
      >
        <AnimatePresence>
          {selectedProduct && (
            <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
