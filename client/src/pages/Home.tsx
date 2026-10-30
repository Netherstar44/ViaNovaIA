import { apiBase } from "@/lib/queryClient";
import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import CardItem from "@/components/CardItem";
import HomeSeoSection from "@/components/HomeSeoSection";
import Comments from "@/components/Comments";
import { LocationItem, locations } from "@/data/mockData";
import { isUsableCoordinatePair, parseCoordinate } from "@/lib/geo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  Filter,
  Navigation2,
  ChevronDown
} from "lucide-react";

import TranslatedText from "@/components/TranslatedText";
import GlassCanvas from "@/components/ui/GlassCanvas";
import { Spinner } from "@/components/ui/spinner";
import type { SimulatedTaxi } from "@/components/TaxiOrderPanel";

// Los visores pesados (MapLibre, Three.js) y los paneles que solo aparecen tras
// una acción se cargan bajo demanda para no bloquear el primer render.
const MapView = lazy(() => import("@/components/MapView"));
const VRViewer = lazy(() => import("@/components/VRViewer"));
const TaxiOrderPanel = lazy(() => import("@/components/TaxiOrderPanel"));

function MapSkeleton() {
  return (
    <div className="h-full w-full min-h-[280px] animate-pulse rounded-3xl bg-muted/70" aria-label="Cargando mapa" />
  );
}

function InlineLoader() {
  return (
    <div className="flex items-center justify-center p-6" role="status" aria-label="Cargando">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

function hasValidCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Convierte el precio numérico del servicio al filtro económico/moderado/lujo. */
function priceRangeFor(value: unknown): "$" | "$$" | "$$$" | undefined {
  const price = Number(value);
  if (!Number.isFinite(price) || price <= 0) return undefined;
  if (price <= 120_000) return "$";
  if (price <= 350_000) return "$$";
  return "$$$";
}

/**
 * Destinos reales de Colombia para la portada. Las fotos viven en
 * /public/images/colombia y rotan cada 6 s con un crossfade lento.
 */
const HERO_IMAGES = [
  {
    src: "/images/colombia/cocora-hero.webp",
    alt: "Palmas de cera gigantes en el verde del Valle del Cocora.",
  },
  {
    src: "/images/colombia/cartagena.webp",
    alt: "Calle colonial de Cartagena con balcones de colores y flores.",
  },
  {
    src: "/images/colombia/tayrona.webp",
    alt: "Playa del Parque Nacional Tayrona entre piedras y selva.",
  },
  {
    src: "/images/colombia/tatacoa.webp",
    alt: "Formaciones de arena rojiza bajo un cielo abierto en la Tatacoa.",
  },
  {
    src: "/images/colombia/guatape.webp",
    alt: "Piedra del Peñol y embalse de Guatapé vistos desde el aire.",
  },
];

const HeroSection = ({ children }: { children?: React.ReactNode }) => {
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setHeroIndex((previous) => (previous + 1) % HERO_IMAGES.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, []);

  const { t } = useTranslation();

  return (
    <section className="relative h-[clamp(540px,78vh,680px)] w-full overflow-hidden bg-black">
      {HERO_IMAGES.map((image, index) => (
        <motion.div
          key={image.src}
          initial={false}
          animate={{
            opacity: heroIndex === index ? 1 : 0,
            scale: heroIndex === index ? 1 : 1.08,
          }}
          transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full"
          aria-hidden={heroIndex !== index}
        >
          <img
            src={image.src}
            alt=""
            className="h-full w-full object-cover"
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={index === 0 ? "high" : "auto"}
          />
        </motion.div>
      ))}

      {/* Cinematic scrim: dark in light and dark themes, so the banner never
          turns into a washed-out white haze at the bottom. */}
      <div className="hero-scrim pointer-events-none absolute inset-0 z-10" />

      <div className="relative z-20 mx-auto flex h-full w-full max-w-7xl flex-col items-center justify-center px-4 pb-8 pt-6 text-center sm:px-6 sm:pb-10 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl"
        >
          <h1 className="mb-4 font-heading text-[clamp(2.25rem,7vw,4.75rem)] font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_30px_rgba(0,0,0,0.55)] sm:mb-6">
            {t('home.hero_title')}
            <br className="hidden sm:block" />{" "}
            <span className="notranslate text-primary drop-shadow-[0_0_24px_rgba(255,191,0,0.45)]">VIANova</span>
          </h1>
          <p className="mx-auto max-w-2xl text-balance text-base font-light leading-relaxed text-white/85 drop-shadow-[0_2px_16px_rgba(0,0,0,0.55)] sm:text-lg md:text-xl">
            {t('home.hero_subtitle')}
          </p>
        </motion.div>

        {children}
      </div>

      <p className="absolute bottom-3 right-4 z-20 text-[10px] font-medium text-white/55 sm:bottom-4 sm:right-6">
        <a
          href="https://commons.wikimedia.org/wiki/Category:Tourism_in_Colombia"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-white/30 underline-offset-2 transition-colors hover:text-white/85"
        >
          Fotografías: Wikimedia Commons · CC BY / CC BY-SA
        </a>
      </p>
    </section>
  );
};

export default function Home() {
  const { t, i18n } = useTranslation();
  const { user, loading } = useAuth();
  const [_, setLocation] = useLocation();

  // View Mode: 'landing' (initial grid) or 'dashboard' (detail view)
  const [viewMode, setViewMode] = useState<'landing' | 'dashboard'>('landing');

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<LocationItem | null>(null);
  const [vrMode, setVrMode] = useState<'product' | 'interior' | null>(null);
  const [serviceLocations, setServiceLocations] = useState<LocationItem[]>([]);
  const [commentRatings, setCommentRatings] = useState<Record<string, number>>({});
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
  const [displayLimit, setDisplayLimit] = useState(40);

  // Hero component is defined below to isolate re-renders

  // La portada es pública: un visitante anónimo puede explorar servicios y
  // mapas. Solo las acciones protegidas (reservar, publicar, viajar) piden login.

  // New accounts without a chosen role go through the role picker. Keep this
  // navigation in an effect so React never performs side effects while rendering.
  useEffect(() => {
    if (!loading && user?.roleChangedAt === null && user.role === "traveler") {
      setLocation("/select-role");
    }
  }, [loading, setLocation, user?.role, user?.roleChangedAt]);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setUserLoc([pos.coords.latitude, pos.coords.longitude]),
      (err) => console.warn("Home Geo error:", err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const handleNavigateToLocation = async () => {
    if (!selectedItem || !selectedItem.coordinates) return;
    
    const [destLat, destLng] = selectedItem.coordinates;
    
    // A missing/legacy coordinate must never reach MapLibre or OSRM.
    if (!hasValidCoordinates(destLat, destLng)) {
      const q = encodeURIComponent(selectedItem.name);
      window.open(`https://www.google.com/maps/search/?api=1&query=${q}`, '_blank');
      return;
    }
    
    // Get user location if not available
    let currentLoc = userLoc;
    if (!currentLoc) {
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
        );
        currentLoc = [pos.coords.latitude, pos.coords.longitude];
        setUserLoc(currentLoc);
      } catch (e) {
        // Fallback: open Google Maps directions without origin
        const q = encodeURIComponent(selectedItem.name);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&destination_place_id=${q}`, '_blank');
        return;
      }
    }

    try {
      const start = currentLoc;
      const end = selectedItem.coordinates;
      // Note: OSRM uses longitude, latitude order
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
      const data = await res.json();
      
      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        // OSRM returns lng, lat - route state stores lat, lng
        const coords = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
        setRouteCoords(coords);
        setRouteInfo({
          distanceKm: route.distance / 1000,
          durationMin: Math.round(route.duration / 60)
        });

        // TTS Instruction
        if ('speechSynthesis' in window) {
          const langMap: Record<string, string> = { es: 'es-CO', en: 'en-US', fr: 'fr-FR', pt: 'pt-BR', zh: 'zh-CN' };
          const msg = new SpeechSynthesisUtterance();
          msg.text = t('home.nav_tts', 'Calculando ruta a {{name}}. La distancia es de {{dist}} kilómetros. Tiempo estimado: {{time}} minutos.', {
            name: selectedItem.name,
            dist: (route.distance / 1000).toFixed(1),
            time: Math.round(route.duration / 60)
          });
          msg.lang = langMap[i18n.language] || 'es-CO';
          msg.rate = 1.0;
          window.speechSynthesis.speak(msg);
        }
      } else {
        // OSRM couldn't calculate route — open Google Maps as fallback
        window.open(`https://www.google.com/maps/dir/?api=1&origin=${start[0]},${start[1]}&destination=${end[0]},${end[1]}`, '_blank');
      }
    } catch (e) {
      console.error("Error fetching route:", e);
      // On any error, open Google Maps as fallback
      const start = currentLoc!;
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${start[0]},${start[1]}&destination=${destLat},${destLng}`, '_blank');
    }
  };


  useEffect(() => {
    // cargar servicios por categoría y mapear a LocationItem
    const cats = ['hotel', 'restaurant', 'recreation', 'transport'] as const;
    const fetchAll = async () => {
      const acc: LocationItem[] = [];
      for (const c of cats) {
        try {
          const res = await fetch(`${apiBase}/api/services?category=${c}`);
          const data = await res.json();
          if (res.ok && Array.isArray(data.services)) {
            for (const s of data.services) {
              const lat = parseCoordinate(s.locationLat);
              const lng = parseCoordinate(s.locationLng);
              if (lat === null || lng === null || !isUsableCoordinatePair([lat, lng])) continue;
              acc.push({
                id: s.id,
                name: s.name,
                category: c,
                description: s.description || '',
                image: s.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?fit=crop&w=800&q=80',
                coordinates: [lat, lng],
                rating: s.rating || 0,
                priceRange: priceRangeFor(s.price),
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
        if (!hasValidCoordinates(l.coordinates[0], l.coordinates[1])) return false;
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

  const mapLocations = useMemo(
    () => filteredAll.filter((l) => hasValidCoordinates(l.coordinates[0], l.coordinates[1])),
    [filteredAll],
  );

  const displayedLocations = useMemo(
    () => filteredAll.slice(0, displayLimit),
    [filteredAll, displayLimit],
  );

  useEffect(() => {
    const ids = displayedLocations.map((location) => location.id).filter(Boolean);
    if (ids.length === 0) return;

    const controller = new AbortController();
    fetch(`${apiBase}/api/comments/ratings?locationIds=${encodeURIComponent(ids.join(","))}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.ratings) return;
        const next: Record<string, number> = {};
        for (const [id, value] of Object.entries<any>(data.ratings)) {
          if (typeof value?.average === "number") next[id] = value.average;
        }
        setCommentRatings(next);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [displayedLocations]);

  // Solo bloqueamos mientras se verifica la sesión. Sin sesión se muestra la
  // portada pública en lugar de expulsar al visitante a /login.
  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Spinner className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Verificando sesión…</p>
      </div>
    );
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
            <HeroSection>
              {/* Premium Search / Filter Bar */}
              <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 w-full max-w-5xl sm:mt-10 md:mt-12"
              >
                <div className="glass-search hero-search liquid-glass--refract liquid-glass--interactive lg-surface lg-surface--search mx-auto flex w-full max-w-[850px] items-center rounded-full p-1.5 sm:p-2">
                  <GlassCanvas variant="search" scrim={0.02} ambient={0.08} />
                  <div className="hero-field group relative flex min-w-0 flex-[1.5] cursor-text flex-col justify-center rounded-full px-4 py-2 transition-colors sm:px-6">
                    <span className="hero-field-label truncate text-[10px] font-extrabold uppercase tracking-[0.12em] sm:text-[11px]">
                      {t('home.destination', 'Destino')}
                    </span>
                    <input
                      type="text"
                      placeholder="¿A dónde quieres ir?"
                      aria-label={t('home.search_placeholder') || 'Buscar destino'}
                      className="w-full truncate border-none bg-transparent p-0 text-sm font-medium outline-none focus:ring-0 sm:text-[15px]"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="hidden h-9 w-px bg-black/15 sm:block" />

                  <div className="hero-field relative hidden min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-full px-5 py-2 transition-colors sm:flex sm:px-6">
                    <span className="hero-field-label truncate text-[11px] font-extrabold uppercase tracking-[0.12em]">
                      {t('home.distance') || 'Distancia'}
                    </span>
                    <select
                      value={distanceFilter}
                      onChange={(e) => setDistanceFilter(e.target.value)}
                      aria-label={t('home.distance') || 'Distancia'}
                      className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-5 text-sm font-medium outline-none focus:ring-0 sm:text-[15px]"
                    >
                      <option value="any">Cualquiera</option>
                      <option value="1">A menos de 1 km</option>
                      <option value="5">A menos de 5 km</option>
                      <option value="10">A menos de 10 km</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute bottom-3 right-5 h-4 w-4 text-black/55 sm:right-6" />
                  </div>

                  <div className="hidden h-9 w-px bg-black/15 sm:block" />

                  <div className="hero-field relative hidden min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-full px-5 py-2 transition-colors sm:flex sm:px-6">
                    <span className="hero-field-label truncate text-[11px] font-extrabold uppercase tracking-[0.12em]">
                      {t('home.price') || 'Precio'}
                    </span>
                    <select
                      value={priceFilter}
                      onChange={(e) => setPriceFilter(e.target.value)}
                      aria-label={t('home.price') || 'Precio'}
                      className="w-full cursor-pointer appearance-none border-none bg-transparent p-0 pr-5 text-sm font-medium outline-none focus:ring-0 sm:text-[15px]"
                    >
                      <option value="any">Cualquier precio</option>
                      <option value="$">Económico ($)</option>
                      <option value="$$">Moderado ($$)</option>
                      <option value="$$$">Lujo ($$$)</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute bottom-3 right-5 h-4 w-4 text-black/55 sm:right-6" />
                  </div>

                  <button
                    type="button"
                    aria-label={t('home.search', 'Buscar')}
                    className="ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95 sm:ml-2 sm:h-14 sm:w-14"
                  >
                    <Search className="h-5 w-5 stroke-[2.5px] sm:h-6 sm:w-6" />
                  </button>
                </div>
              </motion.div>
            </HeroSection>

            {/* CATEGORIES & MAP / MAIN CONTENT */}
            <main id="explorar" className="container mx-auto scroll-mt-28 px-4 py-10 sm:px-6 sm:py-16 lg:px-8">

              <div className="mb-10 flex flex-col gap-6 sm:mb-12 md:flex-row">
                <div className="w-full md:w-[65%]">
                  {/* Category Pills */}
                  <div className="mb-6 flex flex-wrap gap-2 sm:mb-8">
                    {[
                      { id: 'all', label: t('categories.all'), icon: null },
                      { id: 'hotel', label: t('categories.hotel'), icon: <Bed className="w-4 h-4" /> },
                      { id: 'restaurant', label: t('categories.restaurant'), icon: <Utensils className="w-4 h-4" /> },
                      { id: 'recreation', label: t('categories.recreation'), icon: <TentTree className="w-4 h-4" /> },
                      { id: 'transport', label: t('categories.transport'), icon: <Car className="w-4 h-4" /> }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        aria-pressed={selectedCategory === cat.id}
                        className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-300 sm:px-5 ${selectedCategory === cat.id
                            ? 'border-primary/50 bg-primary/15 text-primary-ink shadow-sm'
                            : 'border-transparent bg-transparent text-muted-foreground hover:border-border/60 hover:bg-secondary/50 hover:text-foreground'
                          }`}
                      >
                        {cat.icon}
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Layout Grid For Cards */}
                  {filteredAll.length === 0 ? (
                    <div className="flex w-full flex-col items-center justify-center py-20 text-center opacity-70">
                      <Search className="mb-4 h-14 w-14 text-muted-foreground/60" />
                      <h3 className="text-xl font-semibold">{t('home.no_results')}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">Intenta ajustar tus filtros de búsqueda</p>
                    </div>
                  ) : (
                    <motion.div
                      layout
                      className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6"
                    >
                      <AnimatePresence>
                        {displayedLocations.map((item, index) => (
                          <motion.div
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.4, delay: (index % 10) * 0.05 }}
                            key={item.id}
                            onClick={() => handleItemClick(item)}
                            className="cursor-pointer"
                          >
                            <CardItem
                              item={item}
                              ratingOverride={commentRatings[item.id]}
                              onViewMap={() => handleViewOnMap(item)}
                            />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                      {filteredAll.length > displayLimit && (
                        <div className="col-span-1 sm:col-span-2 text-center pt-8 flex flex-col items-center">
                          <p className="opacity-60 text-sm mb-4">
                            {t('home.showing_results', 'Mostrando {{limit}} de {{total}} resultados. Usa los filtros para refinar tu búsqueda.', { limit: displayLimit, total: filteredAll.length })}
                          </p>
                          <Button 
                            variant="outline" 
                            onClick={() => setDisplayLimit(prev => prev + 40)}
                            className="rounded-full border-primary/50 text-primary-ink hover:bg-primary/10"
                          >
                            {t('home.load_more', 'Ver más resultados')}
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </div>

                {/* Map Sidebar Column */}
                <div className="group relative z-10 h-[420px] w-full overflow-hidden rounded-3xl border border-border/50 shadow-xl sm:h-[520px] md:sticky md:top-24 md:h-[calc(100dvh-150px)] md:w-[35%]">
                  <Suspense fallback={<MapSkeleton />}>
                    <MapView
                      locations={mapLocations}
                      selectedCategory={selectedCategory}
                      onMarkerClick={handleItemClick}
                    />
                  </Suspense>

                  {/* Overlay shadow to integrate it beautifully */}
                  <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-inset ring-white/10" />
                </div>
              </div>

            </main>

            <HomeSeoSection />
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
            <div className="relative h-[38vh] min-h-[280px] w-full sm:h-[42vh] sm:min-h-[320px]">
              <div className="hero-scrim pointer-events-none absolute inset-0 z-10" />
              <img src={selectedItem?.image} alt={selectedItem?.name} className="h-full w-full object-cover" />

              <div className="absolute left-4 top-5 z-20 sm:left-6 sm:top-6">
                <Button variant="secondary" onClick={handleBackToLanding} className="glass-pill gap-2 rounded-full pl-3 pr-5 transition-all hover:scale-105 sm:pr-6">
                  <ArrowLeft className="h-4 w-4" /> {t('home.back')}
                </Button>
              </div>
            </div>

            <div className="container relative z-20 mx-auto -mt-20 flex flex-col gap-6 px-4 pb-16 sm:-mt-24 sm:px-6 md:flex-row md:gap-8 lg:px-8">

              {/* Detail Panel */}
              <div className="flex w-full flex-col gap-6 md:w-[60%]">
                <div className="glass-panel liquid-glass--refract rounded-3xl p-5 sm:p-8">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Badge className="mb-3 bg-primary text-black font-bold uppercase tracking-widest text-xs hover:bg-primary/90">
                        {selectedItem ? t(`categories.${selectedItem.category}`) : ''}
                      </Badge>
                      <h1 className="text-balance text-3xl font-heading font-extrabold text-foreground sm:text-4xl md:text-5xl">{selectedItem?.name}</h1>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <div className="liquid-glass-chip liquid-glass-chip--light flex items-center gap-1 rounded-2xl px-3 py-2 sm:px-4">
                        <Star className="h-4 w-4 fill-primary text-primary sm:h-5 sm:w-5" />
                        <span className="text-lg font-bold sm:text-xl">{selectedItem?.rating}</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-muted-foreground/90 text-lg leading-relaxed mb-6 font-light">
                    <TranslatedText text={selectedItem?.description || ''} />
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
                        <Bed className="h-5 w-5 text-primary-ink shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Este restaurante está dentro del hotel</div>
                          <div className="text-base font-bold text-foreground group-hover:text-primary-ink transition-colors">{hotel.name}</div>
                        </div>
                        <span className="text-xs text-primary-ink font-bold">Ver hotel →</span>
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
                          <Utensils className="h-4 w-4 text-primary-ink" />
                          <span className="text-xs uppercase tracking-wider text-primary-ink font-bold">Restaurantes dentro de este hotel ({inside.length})</span>
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
                              <span className="text-xs text-primary-ink font-bold">Ver →</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-6 border-y border-border/40">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Ubicación</span>
                      <div className="flex items-center gap-2 text-foreground font-medium"><MapPin className="h-4 w-4 text-primary-ink" /> Ver Mapa</div>
                    </div>
                    {selectedItem?.priceRange && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Rango de Precio</span>
                        <div className="flex items-center gap-1 text-foreground font-medium"><span className="text-primary-ink">$</span> {selectedItem.priceRange}</div>
                      </div>
                    )}
                    {selectedItem?.contact && (
                      <div className="flex flex-col gap-1 col-span-2">
                        <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Contacto</span>
                        <div className="flex items-center gap-2 text-foreground font-medium"><Phone className="h-4 w-4 text-primary-ink" /> {selectedItem.contact}</div>
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
                          : 'bg-primary text-primary-foreground shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:shadow-[0_0_30px_rgba(255,215,0,0.5)]'
                      }`}
                    >
                      <Car className="h-5 w-5" />
                      {showTaxiPanel ? t('home.hide_taxi') : t('home.order_taxi')}
                    </Button>

                    <Button
                      onClick={(e) => { e.stopPropagation(); handleNavigateToLocation(); }}
                      className="h-12 px-6 rounded-xl font-bold transition-all flex items-center gap-2 bg-blue-500 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:bg-blue-600 hover:shadow-[0_0_25px_rgba(59,130,246,0.6)]"
                    >
                      <Navigation2 className="h-5 w-5" />
                      {t('home.navigate')}
                    </Button>

                    {selectedItem?.hasVR ? (
                      <>
                        <Button onClick={(e) => { e.stopPropagation(); setVrMode('product') }} variant="outline" className="h-12 px-6 rounded-xl border-primary/50 text-foreground hover:bg-primary/10 hover:text-primary transition-all">
                          <Box className="mr-2 h-5 w-5 text-primary-ink" />
                          {t('home.3d_model')}
                        </Button>

                        <Dialog open={vrMode === 'product'} onOpenChange={(open) => !open && setVrMode(null)}>
                          <DialogContent
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="glass-none h-[min(82dvh,720px)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-lg overflow-hidden rounded-2xl border-none bg-transparent p-0 shadow-none sm:h-[80vh] sm:w-full sm:max-w-[800px]"
                            onInteractOutside={(e) => e.preventDefault()}
                            onPointerDownOutside={(e) => e.preventDefault()}
                          >
                            <DialogTitle className="sr-only">Visor de producto 3D</DialogTitle>
                            <Suspense fallback={<InlineLoader />}>
                              <VRViewer mode="product" onClose={() => setVrMode(null)} />
                            </Suspense>
                          </DialogContent>
                        </Dialog>

                        <Button onClick={(e) => { e.stopPropagation(); setVrMode('interior') }} className="h-12 px-8 rounded-xl bg-primary text-black font-bold hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all">
                          <Eye className="mr-2 h-5 w-5" />
                          {t('home.virtual_tour')}
                        </Button>

                        <Dialog open={vrMode === 'interior'} onOpenChange={(open) => !open && setVrMode(null)}>
                          <DialogContent
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            className="glass-none h-[min(82dvh,720px)] max-h-[calc(100dvh-0.75rem)] w-[calc(100vw-0.75rem)] max-w-lg overflow-hidden rounded-2xl border-none bg-transparent p-0 shadow-none sm:h-[80vh] sm:w-full sm:max-w-[800px]"
                            onInteractOutside={(e) => e.preventDefault()}
                            onPointerDownOutside={(e) => e.preventDefault()}
                          >
                            <DialogTitle className="sr-only">Tour virtual interior 360°</DialogTitle>
                            <Suspense fallback={<InlineLoader />}>
                              <VRViewer mode="interior" onClose={() => setVrMode(null)} />
                            </Suspense>
                          </DialogContent>
                        </Dialog>
                      </>
                    ) : (
                      <Button className="h-12 px-8 rounded-xl bg-primary text-black font-bold hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] transition-all flex items-center gap-2">
                        <Info className="h-5 w-5" />
                        {t('home.ask_info')}
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
              <div className="flex w-full flex-col gap-6 md:w-[40%]">
                <div className="relative h-[320px] shrink-0 overflow-hidden rounded-3xl border border-border/50 bg-card shadow-xl sm:h-[400px]">
                  <Suspense fallback={<MapSkeleton />}>
                    <MapView
                      locations={mapLocations}
                      selectedCategory="all"
                      onMarkerClick={handleItemClick}
                      selectedId={selectedItem?.id}
                      routeCoords={routeCoords.length > 0 ? routeCoords : undefined}
                      nearbyTaxis={showTaxiPanel ? nearbyTaxis : undefined}
                      routeInfo={routeInfo ? routeInfo : undefined}
                    />
                  </Suspense>
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-3xl pointer-events-none" />
                </div>

                {/* Taxi Order Panel */}
                <AnimatePresence>
                  {showTaxiPanel && selectedItem && (
                    <Suspense fallback={<InlineLoader />}>
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
                    </Suspense>
                  )}
                </AnimatePresence>

                {/* "Relacionados" Panel with glass effect */}
                <div className="glass-panel rounded-3xl p-6">
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
                          <h5 className="font-semibold text-foreground truncate group-hover:text-primary-ink transition-colors">
                            {item.name}
                          </h5>
                          <p className="text-xs text-muted-foreground/80 truncate">
                            {item.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary-ink group-hover:translate-x-1 transition-all" />
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
