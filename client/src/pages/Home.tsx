import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import MapView from "@/components/MapView";
import CardItem from "@/components/CardItem";
import Comments from "@/components/Comments";
import VRViewer from "@/components/VRViewer";
import { LocationItem, locations } from "@/data/mockData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils,
  Bed,
  TentTree,
  Car,
  MapPin,
  Star,
  ArrowRight,
  Phone,
  Box,
  Eye,
  Info,
  ArrowLeft,
  Search,
  Filter
} from "lucide-react";

import Chatbot from "@/components/Chatbot";
import ProviderDashboard from "@/pages/ProviderDashboard";
import TaxiOrderPanel, { type SimulatedTaxi } from "@/components/TaxiOrderPanel";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [_, setLocation] = useLocation();

  // View Mode: 'landing' (initial grid) or 'dashboard' (detail view)
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>('landing');

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<LocationItem | null>(null);
  const [vrMode, setVrMode] = useState<'product' | 'interior' | null>(null);
  const [serviceLocations, setServiceLocations] = useState<LocationItem[]>([]);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);

  // Taxi panel state
  const [showTaxiPanel, setShowTaxiPanel] = useState(false);
  const [routeCoords, setRouteCoords] = useState<[number, number][]>([]);
  const [nearbyTaxis, setNearbyTaxis] = useState<SimulatedTaxi[]>([]);
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [distanceFilter, setDistanceFilter] = useState<string>('any');
  const [priceFilter, setPriceFilter] = useState<string>('any');
  const [popularityFilter, setPopularityFilter] = useState<string>('any');

  // Hero background image rotation
  const heroImages = [
    "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80",
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
  ];
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const int = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % heroImages.length);
    }, 6000);
    return () => clearInterval(int);
  }, []);

  // Route protection
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
      () => { },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    // cargar servicios por categoría y mapear a LocationItem
    const cats = ['hotel', 'restaurant', 'recreation', 'transport'] as const;
    const fetchAll = async () => {
      const acc: LocationItem[] = [];
      for (const c of cats) {
        try {
          const res = await fetch(`/api/services?category=${c}`);
          const data = await res.json();
          if (res.ok && Array.isArray(data.services)) {
            for (const s of data.services) {
              const lat = parseFloat(s.locationLat || '0');
              const lng = parseFloat(s.locationLng || '0');
              if (!isFinite(lat) || !isFinite(lng)) continue;
              acc.push({
                id: s.id,
                name: s.name,
                category: c,
                description: s.description || '',
                image: s.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?fit=crop&w=800&q=80',
                coordinates: [lat, lng],
                rating: s.rating || 0,
                priceRange: undefined,
                hasVR: false,
                hasAR: false,
                contact: undefined,
                parentHotelId: s.parentHotelId || undefined,
              });
            }
          }
        } catch { }
      }
      setServiceLocations(acc);
    };
    fetchAll();
  }, []);

  const allLocations = useMemo(() => {
    return [...locations, ...serviceLocations];
  }, [serviceLocations]);

  function haversineKm(a: [number, number], b: [number, number]) {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const lat1 = toRad(a[0]);
    const lat2 = toRad(b[0]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  const filteredAll = useMemo(() => {
    return allLocations.filter((l) => {
      // Búsqueda por texto
      if (searchQuery && !l.name.toLowerCase().includes(searchQuery.toLowerCase()) && !l.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      // Categoría
      if (selectedCategory !== 'all' && l.category !== selectedCategory) {
        return false;
      }
      // distancia
      if (distanceFilter !== 'any' && userLoc) {
        const d = haversineKm(userLoc, l.coordinates);
        if (d > parseInt(distanceFilter)) return false;
      }
      // precio
      if (priceFilter !== 'any') {
        if (!l.priceRange) return false;
        if (l.priceRange !== priceFilter) return false;
      }
      // popularidad
      if (popularityFilter !== 'any') {
        const min = popularityFilter === '4' ? 4 : popularityFilter === '4.5' ? 4.5 : 5;
        if ((l.rating || 0) < min) return false;
      }
      return true;
    });
  }, [allLocations, userLoc, distanceFilter, priceFilter, popularityFilter, selectedCategory, searchQuery]);

  const mapLocations = filteredAll;

  if (!isAuthenticated) return null;

  // Redirect to role selection ONLY for brand-new users (roleChangedAt explicitly null from server)
  // Skip if user data came from old localStorage cache (missing the field entirely)
  if (user && user.roleChangedAt === null) {
    window.location.href = "/select-role";
    return null;
  }

  const handleItemClick = (item: LocationItem) => {
    setSelectedItem(item);
    setViewMode('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToLanding = () => {
    setViewMode('landing');
    setSelectedItem(null);
    setShowTaxiPanel(false);
    setRouteCoords([]);
    setNearbyTaxis([]);
    setRouteInfo(null);
  };

  const handleViewOnMap = (item: LocationItem) => {
    setSelectedItem(item);
    setViewMode('dashboard');
  };

  return (
    <div className="min-h-screen bg-background pb-20 flex flex-col font-sans text-foreground">
      <Navbar />
      <Chatbot />

      <AnimatePresence mode="wait">
        {viewMode === 'landing' ? (
          <motion.div
            key="landing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="flex flex-col w-full"
          >
            {/* HERO SECTION - PREMIUM IMMERSIVE */}
            <section className="relative w-full h-[65vh] min-h-[500px] flex items-center justify-center overflow-hidden">
              {/* Background Crossfade */}
              {heroImages.map((src, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{
                    opacity: heroIndex === idx ? 1 : 0,
                    scale: heroIndex === idx ? 1 : 1.1
                  }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="absolute inset-0 w-full h-full"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-background z-10" />
                  <img src={src} alt="Hero" className="w-full h-full object-cover" />
                </motion.div>
              ))}

              <div className="relative z-20 container mx-auto px-4 flex flex-col items-center text-center mt-12">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >

                  <h1 className="text-5xl md:text-7xl font-heading font-extrabold text-white tracking-tight mb-6">
                    Descubre el mundo con <br className="hidden md:block" /> <span className="text-primary drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]">VIANova</span>
                  </h1>
                  <p className="text-lg md:text-xl text-white/80 max-w-2xl mx-auto font-light">
                    Explora los destinos más exclusivos, sabores inolvidables y experiencias inmersivas impulsadas por inteligencia artificial.
                  </p>
                </motion.div>

                {/* Premium Search / Filter Bar */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                  className="mt-12 w-full max-w-5xl"
                >
                  <div className="bg-card/90 backdrop-blur-md border border-border/40 rounded-2xl p-2 shadow-xl flex flex-col md:flex-row gap-2 items-center">

                    <div className="flex-1 w-full bg-secondary/30 rounded-xl flex items-center px-4 h-12 hover:bg-secondary/50 transition-colors border border-transparent focus-within:border-primary/50 group">
                      <Search className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                      <input
                        type="text"
                        placeholder="Buscar por nombre, descripción o ciudad..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-transparent border-none outline-none focus:ring-0 px-4 text-sm md:text-base text-white placeholder:text-muted-foreground"
                      />
                    </div>

                    <div className="flex flex-wrap md:flex-nowrap w-full md:w-auto gap-2">
                      <div className="relative flex-1 md:flex-none">
                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <select
                          value={distanceFilter}
                          onChange={(e) => setDistanceFilter(e.target.value)}
                          className="w-full h-12 pl-9 pr-4 rounded-xl border border-transparent bg-secondary/30 hover:bg-secondary/50 text-sm appearance-none outline-none focus:border-primary/50 transition-colors"
                        >
                          <option value="any">Distancia</option>
                          <option value="1">Menos de 1 km</option>
                          <option value="5">Menos de 5 km</option>
                          <option value="10">Menos de 10 km</option>
                        </select>
                      </div>

                      <div className="relative flex-1 md:flex-none">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                        <select
                          value={priceFilter}
                          onChange={(e) => setPriceFilter(e.target.value)}
                          className="w-full h-12 pl-9 pr-4 rounded-xl border border-transparent bg-secondary/30 hover:bg-secondary/50 text-sm appearance-none outline-none focus:border-primary/50 transition-colors"
                        >
                          <option value="any">Precio</option>
                          <option value="$">Asequible ($)</option>
                          <option value="$$">Moderado ($$)</option>
                          <option value="$$$">Lujo ($$$)</option>
                        </select>
                      </div>

                      <Button className="w-full md:w-auto h-12 rounded-xl bg-primary text-black font-bold px-8 hover:bg-primary/90 transition-all">
                        Explorar
                      </Button>
                    </div>

                  </div>
                </motion.div>
              </div>
            </section>

            {/* CATEGORIES & MAP / MAIN CONTENT */}
            <main className="container mx-auto px-4 py-16">

              <div className="flex flex-col md:flex-row gap-6 mb-12">
                <div className="w-full md:w-[65%]">
                  {/* Category Pills */}
                  <div className="flex flex-wrap gap-2 mb-8">
                    {[
                      { id: 'all', label: 'Todos los Destinos', icon: null },
                      { id: 'hotel', label: 'Alojamientos', icon: <Bed className="w-4 h-4" /> },
                      { id: 'restaurant', label: 'Gastronomía', icon: <Utensils className="w-4 h-4" /> },
                      { id: 'recreation', label: 'Experiencias', icon: <TentTree className="w-4 h-4" /> },
                      { id: 'transport', label: 'Movilidad', icon: <Car className="w-4 h-4" /> }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${selectedCategory === cat.id
                            ? 'bg-primary/10 text-primary border-primary/50'
                            : 'bg-transparent text-muted-foreground hover:text-foreground border-transparent hover:border-border/50'
                          }`}
                      >
                        {cat.icon}
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Layout Grid For Cards */}
                  {filteredAll.length === 0 ? (
                    <div className="w-full py-20 text-center flex flex-col items-center justify-center opacity-60">
                      <Search className="h-16 w-16 mb-4 text-muted-foreground" />
                      <h3 className="text-xl font-medium">No se encontraron resultados</h3>
                      <p>Intenta ajustar tus filtros de búsqueda</p>
                    </div>
                  ) : (
                    <motion.div
                      layout
                      className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                    >
                      <AnimatePresence>
                        {filteredAll.map((item, index) => (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className="cursor-pointer"
                          >
                            <CardItem item={item} onViewMap={() => handleViewOnMap(item)} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>

                {/* Map Sidebar Column */}
                <div className="w-full md:w-[35%] h-[600px] md:h-[calc(100vh-150px)] sticky top-24 rounded-3xl overflow-hidden border border-border/50 shadow-2xl z-10 group">
                  <MapView
                    locations={mapLocations}
                    selectedCategory={selectedCategory}
                    onMarkerClick={handleItemClick}
                  />

                  {/* Overlay shadow to integrate it beautifully */}
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none" />
                </div>
              </div>

            </main>
          </motion.div>
        ) : (
          // ================= DASHBOARD VIEW (Detail Focus Layout) =================
          <motion.main
            key="dashboard"
            initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
            className="flex-1 w-full bg-background"
          >
            {/* Hero specific to the item */}
            <div className="relative w-full h-[40vh] min-h-[300px]">
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent z-10" />
              <img src={selectedItem?.image} alt={selectedItem?.name} className="w-full h-full object-cover" />

              <div className="absolute top-6 left-6 z-20">
                <Button variant="secondary" onClick={handleBackToLanding} className="gap-2 bg-background/60 backdrop-blur hover:bg-background rounded-full pl-3 pr-6 transition-all hover:scale-105">
                  <ArrowLeft className="h-4 w-4" /> Volver a Explorar
                </Button>
              </div>
            </div>

            <div className="container mx-auto px-4 -mt-24 relative z-20 pb-16 flex flex-col md:flex-row gap-8">

              {/* Detail Panel */}
              <div className="w-full md:w-[60%] flex flex-col gap-6">
                <div className="bg-card/80 backdrop-blur-2xl border border-border/50 rounded-3xl p-8 shadow-2xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <Badge className="bg-primary hover:bg-primary/90 text-black font-bold uppercase tracking-widest text-xs mb-3">
                        {selectedItem?.category}
                      </Badge>
                      <h1 className="text-4xl md:text-5xl font-heading font-extrabold text-foreground">{selectedItem?.name}</h1>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="flex items-center gap-1 bg-secondary/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-border/50">
                        <Star className="h-5 w-5 fill-primary text-primary" />
                        <span className="font-bold text-xl">{selectedItem?.rating}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground/90 text-lg leading-relaxed mb-6 font-light">
                    {selectedItem?.description}
                  </p>

                  {/* Restaurant inside a hotel */}
                  {selectedItem?.category === 'restaurant' && selectedItem?.parentHotelId && (() => {
                    const hotel = allLocations.find(l => l.id === selectedItem.parentHotelId);
                    if (!hotel) return null;
                    return (
                      <button
                        onClick={() => handleItemClick(hotel)}
                        className="mb-6 w-full text-left flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 transition-all group"
                      >
                        <Bed className="h-5 w-5 text-primary shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Este restaurante está dentro del hotel</div>
                          <div className="text-base font-bold text-foreground group-hover:text-primary transition-colors">{hotel.name}</div>
                        </div>
                        <span className="text-xs text-primary font-bold">Ver hotel →</span>
                      </button>
                    );
                  })()}

                  {/* Hotel: list restaurants inside */}
                  {selectedItem?.category === 'hotel' && (() => {
                    const inside = allLocations.filter(l => l.category === 'restaurant' && l.parentHotelId === selectedItem.id);
                    if (inside.length === 0) return null;
                    return (
                      <div className="mb-6 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                        <div className="flex items-center gap-2 mb-3">
                          <Utensils className="h-4 w-4 text-primary" />
                          <span className="text-xs uppercase tracking-wider text-primary font-bold">Restaurantes dentro de este hotel ({inside.length})</span>
                        </div>
                        <div className="space-y-2">
                          {inside.map(r => (
                            <button
                              key={r.id}
                              onClick={() => handleItemClick(r)}
                              className="w-full text-left flex items-center gap-3 p-3 rounded-xl bg-card/60 hover:bg-card border border-transparent hover:border-primary/40 transition-all"
                            >
                              <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden">
                                <img src={r.image} alt={r.name} className="h-full w-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-bold text-foreground truncate">{r.name}</div>
                                <div className="text-xs text-muted-foreground truncate">{r.description}</div>
                              </div>
                              <span className="text-xs text-primary font-bold">Ver →</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-border/40">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Ubicación</span>
                      <div className="flex items-center gap-2 text-foreground font-medium"><MapPin className="h-4 w-4 text-primary" /> Ver Mapa</div>
                    </div>
                    {selectedItem?.priceRange && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Rango de Precio</span>
                        <div className="flex items-center gap-1 text-foreground font-medium"><span className="text-primary">$</span> {selectedItem.priceRange}</div>
                      </div>
                    )}
                    {selectedItem?.contact && (
                      <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Contacto</span>
                        <div className="flex items-center gap-2 text-foreground font-medium"><Phone className="h-4 w-4 text-primary" /> {selectedItem.contact}</div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4 mt-8">
                    {/* TAXI ORDER BUTTON — FIRST OPTION (all users) */}
                    <Button
                      onClick={(e) => { e.stopPropagation(); setShowTaxiPanel(!showTaxiPanel); }}
                      className={`h-12 px-6 rounded-xl font-bold transition-all flex items-center gap-2 ${
                        showTaxiPanel
                          ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)]'
                          : 'bg-gradient-to-r from-primary via-primary/90 to-emerald-500 text-black shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:shadow-[0_0_30px_rgba(255,215,0,0.5)]'
                      }`}
                    >
                      <Car className="h-5 w-5" />
                      {showTaxiPanel ? 'Ocultar Taxi' : 'Ordenar Taxi'}
                    </Button>

                    {selectedItem?.hasVR ? (
                      <>
                        <Button onClick={(e) => { e.stopPropagation(); setVrMode('product') }} variant="outline" className="h-12 px-6 rounded-xl border-primary/50 text-foreground hover:bg-primary/10 hover:text-primary transition-all">
                          <Box className="mr-2 h-5 w-5 text-primary" />
                          Ver Modelo 3D
                        </Button>

                        <Dialog open={vrMode === 'product'} onOpenChange={(open) => !open && setVrMode(null)}>
                          <DialogContent
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="sm:max-w-[800px] h-[80vh] p-0 border-none bg-transparent shadow-none"
                            onInteractOutside={(e) => e.preventDefault()}
                            onPointerDownOutside={(e) => e.preventDefault()}
                          >
                            <VRViewer mode="product" onClose={() => setVrMode(null)} />
                          </DialogContent>
                        </Dialog>

                        <Button onClick={(e) => { e.stopPropagation(); setVrMode('interior') }} className="h-12 px-8 rounded-xl bg-primary text-black font-bold hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all">
                          <Eye className="mr-2 h-5 w-5" />
                          Explorar Tour Virtual
                        </Button>

                        <Dialog open={vrMode === 'interior'} onOpenChange={(open) => !open && setVrMode(null)}>
                          <DialogContent
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="sm:max-w-[800px] h-[80vh] p-0 border-none bg-transparent shadow-none"
                            onInteractOutside={(e) => e.preventDefault()}
                            onPointerDownOutside={(e) => e.preventDefault()}
                          >
                            <VRViewer mode="interior" onClose={() => setVrMode(null)} />
                          </DialogContent>
                        </Dialog>
                      </>
                    ) : (
                      <Button className="h-12 px-8 rounded-xl bg-primary text-black font-bold hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        Solicitar Información
                      </Button>
                    )}
                  </div>
                </div>

                {/* Comments Section */}
                {selectedItem && (
                  <div className="mt-4">
                    <Comments locationId={selectedItem.id} />
                  </div>
                )}
              </div>

              {/* Map View & Mini Explorer Panel */}
              <div className="w-full md:w-[40%] flex flex-col gap-6">
                <div className="h-[400px] shrink-0 rounded-3xl overflow-hidden border border-border/50 shadow-2xl relative bg-card">
                  <MapView
                    locations={mapLocations}
                    selectedCategory="all"
                    onMarkerClick={handleItemClick}
                    selectedId={selectedItem?.id}
                    routeCoords={showTaxiPanel ? routeCoords : undefined}
                    nearbyTaxis={showTaxiPanel ? nearbyTaxis : undefined}
                    routeInfo={showTaxiPanel ? routeInfo : undefined}
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none" />
                </div>

                {/* Taxi Order Panel */}
                <AnimatePresence>
                  {showTaxiPanel && selectedItem && (
                    <TaxiOrderPanel
                      destination={selectedItem}
                      userLocation={userLoc}
                      onClose={() => setShowTaxiPanel(false)}
                      onTaxiRadarUpdate={setNearbyTaxis}
                      onRouteReady={(coords, km, min) => {
                        setRouteCoords(coords);
                        setRouteInfo({ distanceKm: Math.round(km * 10) / 10, durationMin: min });
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* "Relacionados" Panel with glass effect */}
                <div className="rounded-3xl bg-secondary/30 backdrop-blur-xl border border-border/30 p-6 shadow-xl">
                  <h3 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
                    <Star className="text-primary w-5 h-5 fill-primary" />
                    Sugerencias Similares
                  </h3>
                  <div className="space-y-3">
                    {mapLocations.filter(l => l.category === selectedItem?.category && l.id !== selectedItem?.id).slice(0, 4).map(item => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all duration-300 bg-card/50 hover:bg-card border border-transparent hover:border-border shadow-sm hover:shadow-md group"
                      >
                        <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden shadow-inner">
                          <img src={item.image} alt={item.name} className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h5 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {item.name}
                          </h5>
                          <p className="text-xs text-muted-foreground/80 truncate">
                            {item.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
