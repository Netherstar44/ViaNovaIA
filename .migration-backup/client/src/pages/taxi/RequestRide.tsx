import { apiBase } from "@/lib/queryClient";
import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Car, MapPin, Navigation, Search, Loader2, X,
  CheckCircle, Clock, ArrowLeft, Send, Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import Navbar from "@/components/Navbar";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import type { Ride } from "@shared/taxi.schema";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const FARE_BASE = 5000;   // COP base
const FARE_PER_KM = 3500; // COP por km

function haversineKm(a: [number, number], b: [number, number]) {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:     { label: "Buscando taxista...",  color: "bg-orange-500/15 text-orange-400 border-orange-500/20", icon: <Clock className="h-4 w-4 animate-pulse" /> },
  accepted:    { label: "Taxi en camino",       color: "bg-blue-500/15 text-blue-400 border-blue-500/20",     icon: <Car className="h-4 w-4" /> },
  in_progress: { label: "Viaje en curso",       color: "bg-green-500/15 text-green-400 border-green-500/20",  icon: <Navigation className="h-4 w-4" /> },
  completed:   { label: "Viaje completado",     color: "bg-primary/15 text-primary border-primary/20",        icon: <CheckCircle className="h-4 w-4" /> },
  cancelled:   { label: "Cancelado",            color: "bg-destructive/15 text-destructive border-destructive/20", icon: <X className="h-4 w-4" /> },
};

// ── Geocoding (Nominatim) — biased by user location ─────────────────────────

async function geocode(
  query: string,
  nearLat?: number,
  nearLng?: number
): Promise<{ lat: number; lng: number; display: string }[]> {
  if (!query || query.length < 3) return [];
  // Build Nominatim URL with location bias
  let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&countrycodes=co`;
  if (nearLat != null && nearLng != null) {
    // Create a ~30km viewbox around the user for local-biased results
    const delta = 0.27; // ~30km
    url += `&viewbox=${nearLng - delta},${nearLat + delta},${nearLng + delta},${nearLat - delta}&bounded=0`;
  }
  try {
    const res = await fetch(url, { headers: { "User-Agent": "VIANova/1.0" } });
    const data: any[] = await res.json();
    return data.map((d) => {
      // Build a shorter display name from address components
      const a = d.address || {};
      const parts = [
        a.road || a.pedestrian || a.neighbourhood,
        a.suburb || a.city_district,
        a.city || a.town || a.village,
      ].filter(Boolean);
      const short = parts.length > 0 ? parts.join(", ") : d.display_name;
      return { lat: parseFloat(d.lat), lng: parseFloat(d.lon), display: short };
    });
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
      { headers: { "User-Agent": "VIANova/1.0" } }
    );
    const data: any = await res.json();
    // Build a short readable address
    const a = data.address || {};
    const parts = [
      a.road || a.pedestrian || a.neighbourhood,
      a.suburb || a.city_district,
      a.city || a.town || a.village,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}

/** IP-based fallback geolocation (when browser geolocation fails) */
async function ipGeolocate(): Promise<[number, number] | null> {
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data: any = await res.json();
    if (data.latitude && data.longitude) {
      return [data.latitude, data.longitude];
    }
    return null;
  } catch {
    return null;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export default function RequestRide() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Form state
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [originCoords, setOriginCoords] = useState<[number, number] | null>(null);
  const [destCoords, setDestCoords] = useState<[number, number] | null>(null);
  const [originResults, setOriginResults] = useState<any[]>([]);
  const [destResults, setDestResults] = useState<any[]>([]);
  const [searchingOrigin, setSearchingOrigin] = useState(false);
  const [searchingDest, setSearchingDest] = useState(false);
  const [geolocating, setGeolocating] = useState(false);
  const [createdRideId, setCreatedRideId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const username = user?.username ?? "";

  // ── Check for existing active ride ──────────────────────────────────────
  const { data: travelerData } = useQuery<{ activeRide: Ride | null; history: Ride[] }>({
    queryKey: ["rides", "traveler", username],
    queryFn: () => fetch(`${apiBase}/api/rides/traveler/${username}`).then((r) => r.json()),
    refetchInterval: createdRideId ? 5000 : 30000,
    enabled: !!username,
  });

  const activeRide = createdRideId
    ? travelerData?.activeRide ?? null
    : travelerData?.activeRide ?? null;

  // If there's an active ride on mount, go straight to tracking
  useEffect(() => {
    if (travelerData?.activeRide && !createdRideId) {
      setCreatedRideId(travelerData.activeRide.id);
    }
  }, [travelerData?.activeRide]);

  // ── Geolocation (with IP fallback) ───────────────────────────────────────
  const detectLocation = useCallback(async () => {
    setGeolocating(true);

    // Try browser geolocation first
    const tryBrowser = (): Promise<[number, number] | null> =>
      new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });

    let coords = await tryBrowser();

    // Fallback: IP-based geolocation
    if (!coords) {
      coords = await ipGeolocate();
    }

    if (coords) {
      setOriginCoords(coords);
      const address = await reverseGeocode(coords[0], coords[1]);
      setOriginText(address);
    } else {
      toast({ title: "No se pudo detectar tu ubicación", description: "Escribe tu dirección manualmente", variant: "destructive" });
    }
    setGeolocating(false);
  }, [toast]);

  // Auto-detect on mount
  useEffect(() => { if (!createdRideId) { detectLocation(); } }, []);

  // ── Debounced auto-search as user types ─────────────────────────────────
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Origin auto-search
  useEffect(() => {
    if (originCoords || originText.length < 3) { setOriginResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchingOrigin(true);
      const results = await geocode(originText, originCoords?.[0], originCoords?.[1]);
      setOriginResults(results);
      setSearchingOrigin(false);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [originText, originCoords]);

  // Destination auto-search
  const debounceDestRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (destCoords || destText.length < 3) { setDestResults([]); return; }
    if (debounceDestRef.current) clearTimeout(debounceDestRef.current);
    debounceDestRef.current = setTimeout(async () => {
      setSearchingDest(true);
      // Bias destination search around the origin (user's location)
      const results = await geocode(destText, originCoords?.[0], originCoords?.[1]);
      setDestResults(results);
      setSearchingDest(false);
    }, 500);
    return () => { if (debounceDestRef.current) clearTimeout(debounceDestRef.current); };
  }, [destText, destCoords, originCoords]);

  // Manual search (for Enter key / button click)
  const searchOrigin = useCallback(async () => {
    if (originText.length < 3) return;
    setSearchingOrigin(true);
    const results = await geocode(originText, originCoords?.[0], originCoords?.[1]);
    setOriginResults(results);
    setSearchingOrigin(false);
  }, [originText, originCoords]);

  const searchDest = useCallback(async () => {
    if (destText.length < 3) return;
    setSearchingDest(true);
    const results = await geocode(destText, originCoords?.[0], originCoords?.[1]);
    setDestResults(results);
    setSearchingDest(false);
  }, [destText, originCoords]);

  // ── Fare calculation ────────────────────────────────────────────────────
  const distanceKm = originCoords && destCoords ? haversineKm(originCoords, destCoords) : 0;
  const fare = distanceKm > 0 ? Math.round((FARE_BASE + FARE_PER_KM * distanceKm) / 100) * 100 : 0;

  // ── Map rendering ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || createdRideId) return;
    import("leaflet").then((L) => {
      // Cleanup previous
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
      });

      const center = originCoords || [4.711, -74.0721]; // Bogotá default
      const map = L.map(mapRef.current!, { center, zoom: 13, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>', maxZoom: 19,
      }).addTo(map);

      if (originCoords) {
        const oi = L.divIcon({ html: `<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], className: "" });
        L.marker(originCoords, { icon: oi }).addTo(map).bindPopup("🟢 Tu ubicación");
      }
      if (destCoords) {
        const di = L.divIcon({ html: `<div style="background:#ef4444;width:14px;height:14px;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(239,68,68,0.6)"></div>`, iconSize: [14, 14], iconAnchor: [7, 7], className: "" });
        L.marker(destCoords, { icon: di }).addTo(map).bindPopup("🔴 Destino");
      }
      if (originCoords && destCoords) {
        const poly = L.polyline([originCoords, destCoords], { color: "#c9a227", weight: 4, opacity: 0.8, dashArray: "8, 6" }).addTo(map);
        map.fitBounds(poly.getBounds(), { padding: [40, 40] });
      }
      mapInstanceRef.current = map;
    });
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [originCoords, destCoords, createdRideId]);

  // ── Create ride mutation ────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!originCoords || !destCoords) throw new Error("Faltan coordenadas");
      const body = {
        travelerUsername: username,
        originLat: originCoords[0].toString(),
        originLng: originCoords[1].toString(),
        originAddress: originText,
        destinationLat: destCoords[0].toString(),
        destinationLng: destCoords[1].toString(),
        destinationAddress: destText,
        fare,
        distanceKm: Math.round(distanceKm * 10) / 10,
      };
      const res = await fetch(apiBase + "/api/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Error al crear solicitud");
      return d.ride as Ride;
    },
    onSuccess: (ride) => {
      setCreatedRideId(ride.id);
      qc.invalidateQueries({ queryKey: ["rides", "traveler"] });
      toast({ title: "🚕 Solicitud enviada", description: "Buscando un taxista cerca de ti..." });
    },
    onError: (err: Error) => setFormError(err.message),
  });

  // ── Cancel ride mutation ────────────────────────────────────────────────
  const cancelMutation = useMutation({
    mutationFn: async (rideId: string) => {
      const res = await fetch(`${apiBase}/api/rides/${rideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message); }
    },
    onSuccess: () => {
      setCreatedRideId(null);
      qc.invalidateQueries({ queryKey: ["rides", "traveler"] });
      toast({ title: "Viaje cancelado" });
    },
  });

  const handleSubmit = () => {
    setFormError("");
    if (!originCoords) { setFormError("Selecciona una ubicación de origen"); return; }
    if (!destCoords) { setFormError("Selecciona un destino"); return; }
    if (fare <= 0) { setFormError("No se pudo calcular la tarifa"); return; }
    createMutation.mutate();
  };

  // Redirect guard AFTER all hooks
  if (!user) { setLocation("/login"); return null; }

  const isTracking = !!createdRideId && activeRide;
  const rideFinished = createdRideId && activeRide && (activeRide.status === "completed" || activeRide.status === "cancelled");

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />

      <div className="w-full max-w-[1200px] mx-auto py-4 px-4 sm:px-6 lg:px-8 space-y-5">

        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </button>

        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-3">
            <Car className="h-8 w-8 text-primary" />
            {isTracking ? "Tu Viaje" : "Pedir un Taxi"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isTracking ? "Sigue el estado de tu viaje en tiempo real" : "Indica tu origen y destino para solicitar un taxi"}
          </p>
        </motion.div>

        {/* ── TRACKING VIEW ─────────────────────────────────────────── */}
        {isTracking && activeRide ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            {/* Status banner */}
            <div className={`flex items-center justify-between p-5 rounded-2xl border ${statusConfig[activeRide.status]?.color ?? ""}`}>
              <div className="flex items-center gap-3">
                {statusConfig[activeRide.status]?.icon}
                <div>
                  <p className="font-bold text-lg">{statusConfig[activeRide.status]?.label}</p>
                  {activeRide.taxiUsername && (
                    <p className="text-sm opacity-80">Conductor: {activeRide.taxiUsername}</p>
                  )}
                </div>
              </div>
              <Badge className={statusConfig[activeRide.status]?.color}>{activeRide.status}</Badge>
            </div>

            {/* Ride info */}
            <div className="bg-card border border-border/50 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> Origen</p>
                <p className="text-sm font-medium">{activeRide.originAddress || "Tu ubicación"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Navigation className="h-3 w-3" /> Destino</p>
                <p className="text-sm font-medium">{activeRide.destinationAddress}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tarifa</p>
                <p className="text-lg font-bold text-primary">{fmt(activeRide.fare)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Distancia</p>
                <p className="text-sm font-medium">{activeRide.distanceKm ? `${activeRide.distanceKm} km` : "—"}</p>
              </div>
            </div>

            {/* Progress steps */}
            <div className="bg-card border border-border/50 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                {["pending", "accepted", "in_progress", "completed"].map((s, i) => {
                  const steps = ["pending", "accepted", "in_progress", "completed"];
                  const currentIdx = steps.indexOf(activeRide.status);
                  const done = i <= currentIdx;
                  return (
                    <div key={s} className="flex items-center gap-2 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? "bg-primary text-black" : "bg-secondary text-muted-foreground"}`}>
                        {i + 1}
                      </div>
                      <span className={`text-xs hidden sm:inline ${done ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                        {["Solicitado", "Aceptado", "En curso", "Finalizado"][i]}
                      </span>
                      {i < 3 && <div className={`flex-1 h-0.5 mx-1 ${done && i < currentIdx ? "bg-primary" : "bg-border"}`} />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {(activeRide.status === "pending" || activeRide.status === "accepted") && (
                <Button
                  onClick={() => cancelMutation.mutate(activeRide.id)}
                  disabled={cancelMutation.isPending}
                  variant="destructive"
                  className="rounded-xl gap-2"
                >
                  <Ban className="h-4 w-4" />
                  {cancelMutation.isPending ? "Cancelando..." : "Cancelar viaje"}
                </Button>
              )}
              {rideFinished && (
                <Button onClick={() => { setCreatedRideId(null); }} className="rounded-xl gap-2 bg-primary text-primary-foreground">
                  <Car className="h-4 w-4" /> Solicitar otro viaje
                </Button>
              )}
            </div>
          </motion.div>
        ) : (
          /* ── FORM VIEW ────────────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Form */}
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              {/* Origin */}
              <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-green-500 inline-block" /> Origen
                  </Label>
                  <Button onClick={detectLocation} disabled={geolocating} variant="ghost" size="sm" className="text-xs gap-1">
                    <MapPin className="h-3 w-3" /> {geolocating ? "Detectando..." : "Mi ubicación"}
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    value={originText}
                    onChange={(e) => { setOriginText(e.target.value); setOriginCoords(null); }}
                    onKeyDown={(e) => e.key === "Enter" && searchOrigin()}
                    placeholder="Escribe una dirección de origen..."
                    className="bg-secondary/30 border-border/50 rounded-xl pr-10"
                  />
                  <button onClick={searchOrigin} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                    {searchingOrigin ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </button>
                </div>
                {originResults.length > 0 && !originCoords && (
                  <div className="bg-secondary/40 rounded-xl border border-border/30 divide-y divide-border/20 max-h-40 overflow-y-auto">
                    {originResults.map((r, i) => (
                      <button key={i} onClick={() => { setOriginCoords([r.lat, r.lng]); setOriginText(r.display); setOriginResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors truncate"
                      >{r.display}</button>
                    ))}
                  </div>
                )}
                {originCoords && <p className="text-xs text-green-400">✓ Coordenadas: {originCoords[0].toFixed(4)}, {originCoords[1].toFixed(4)}</p>}
              </div>

              {/* Destination */}
              <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Destino
                </Label>
                <div className="relative">
                  <Input
                    value={destText}
                    onChange={(e) => { setDestText(e.target.value); setDestCoords(null); }}
                    onKeyDown={(e) => e.key === "Enter" && searchDest()}
                    placeholder="¿A dónde quieres ir?"
                    className="bg-secondary/30 border-border/50 rounded-xl pr-10"
                  />
                  <button onClick={searchDest} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary">
                    {searchingDest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </button>
                </div>
                {destResults.length > 0 && !destCoords && (
                  <div className="bg-secondary/40 rounded-xl border border-border/30 divide-y divide-border/20 max-h-40 overflow-y-auto">
                    {destResults.map((r, i) => (
                      <button key={i} onClick={() => { setDestCoords([r.lat, r.lng]); setDestText(r.display); setDestResults([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 transition-colors truncate"
                      >{r.display}</button>
                    ))}
                  </div>
                )}
                {destCoords && <p className="text-xs text-green-400">✓ Coordenadas: {destCoords[0].toFixed(4)}, {destCoords[1].toFixed(4)}</p>}
              </div>

              {/* Fare preview */}
              {fare > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Tarifa estimada</p>
                      <p className="text-2xl font-bold text-primary">{fmt(fare)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Distancia aprox.</p>
                      <p className="text-lg font-semibold">{distanceKm.toFixed(1)} km</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {formError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-sm text-destructive">{formError}</div>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || !originCoords || !destCoords}
                className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-bold text-base
                  shadow-[0_0_20px_rgba(var(--primary-rgb,99,102,241),0.3)]
                  hover:shadow-[0_0_30px_rgba(var(--primary-rgb,99,102,241),0.5)]
                  transition-all duration-300 gap-2"
              >
                {createMutation.isPending ? (
                  <><Loader2 className="h-5 w-5 animate-spin" /> Solicitando...</>
                ) : (
                  <><Send className="h-5 w-5" /> Solicitar Taxi</>
                )}
              </Button>
            </motion.div>

            {/* Right: Map */}
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="rounded-2xl border border-border/50 overflow-hidden shadow-lg sticky top-20">
                <div ref={mapRef} style={{ height: "520px", width: "100%", background: "#0a0a12" }} />
                {/* Legend */}
                <div className="bg-card border-t border-border/40 px-4 py-2.5 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Origen</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Destino</span>
                  {distanceKm > 0 && <span className="ml-auto font-medium text-foreground">{distanceKm.toFixed(1)} km</span>}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
