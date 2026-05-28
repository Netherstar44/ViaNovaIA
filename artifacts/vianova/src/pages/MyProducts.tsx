import { apiBase } from "@/lib/queryClient";
import React, { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Plus, Pencil, Trash2, X, Loader2, Package, ImagePlus,
  Check, AlertCircle, DollarSign, Clock, Users, Mountain, Baby, Sparkles, MapPin, Calendar, Hotel,
  Link as LinkIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "@/components/Navbar";

interface Service {
  id: string;
  providerUsername: string;
  category: string;
  name: string;
  description?: string;
  imageUrl?: string;
  locationLat?: string;
  locationLng?: string;
  rating?: number;
  // Pricing
  price?: number;
  currency?: string;
  priceType?: string;
  // Recreation-only
  duration?: string;
  minCapacity?: number;
  maxCapacity?: number;
  difficulty?: string;
  minAge?: number;
  included?: string[];
  whatToBring?: string;
  schedule?: string;
  // Restaurant-only
  parentHotelId?: string;
  createdAt?: string;
}

interface HotelOption {
  id: string;
  name: string;
}

type FormMode = "idle" | "add" | "edit";

const CATEGORY_MAP: Record<string, string> = {
  hotel: "Hotel",
  restaurant: "Restaurante",
  recreation: "Recreación",
  transport: "Transporte",
};

const PRICE_TYPE_LABELS: Record<string, string> = {
  per_person: "por persona",
  per_group: "por grupo",
  per_hour: "por hora",
  per_day: "por día",
  from: "desde",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Fácil",
  moderate: "Moderado",
  hard: "Difícil",
  extreme: "Extremo",
};

function roleToCat(role: string): string {
  if (role === "hotel") return "hotel";
  if (role === "restaurant") return "restaurant";
  if (role === "recreation") return "recreation";
  if (role === "taxi") return "transport";
  return "hotel";
}

/**
 * Extrae lat/lng de un link de Google Maps (formato largo).
 * Soporta:
 *   - https://www.google.com/maps/@7.0847,-73.1198,15z
 *   - https://www.google.com/maps/place/Nombre/@7.0847,-73.1198,15z/data=!3m1!4b1!4m6!3m5!1s.../!8m2!3d7.0847!4d-73.1198
 *   - https://www.google.com/maps?q=7.0847,-73.1198
 *   - https://maps.google.com/?q=7.0847,-73.1198
 *   - "7.0847, -73.1198" (pegado directo)
 */
function parseMapsLink(input: string): { lat: string; lng: string } | null {
  if (!input) return null;
  const url = input.trim();

  // Patrón 1: @lat,lng (URL larga típica)
  const atMatch = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) return { lat: atMatch[1], lng: atMatch[2] };

  // Patrón 2: !3dLAT!4dLNG (parámetro "data" del place page)
  const dataMatch = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) return { lat: dataMatch[1], lng: dataMatch[2] };

  // Patrón 3: ?q=lat,lng / &q= / ll= / destination=
  const qMatch = url.match(/[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i);
  if (qMatch) return { lat: qMatch[1], lng: qMatch[2] };

  // Patrón 4: lat,lng pegado tal cual
  const bareMatch = url.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (bareMatch) {
    const latNum = parseFloat(bareMatch[1]);
    const lngNum = parseFloat(bareMatch[2]);
    if (latNum >= -90 && latNum <= 90 && lngNum >= -180 && lngNum <= 180) {
      return { lat: bareMatch[1], lng: bareMatch[2] };
    }
  }

  return null;
}

/** Detecta si es un link corto que necesita resolución del servidor */
function isShortMapsLink(url: string): boolean {
  return /(?:^|\/\/)(?:maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs)/i.test(url);
}

function formatMoney(price?: number, currency = "COP"): string {
  if (price === undefined || price === null) return "";
  try {
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

export default function MyProducts() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [formMode, setFormMode] = useState<FormMode>("idle");
  const [editId, setEditId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form fields (general)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [locationLat, setLocationLat] = useState("");
  const [locationLng, setLocationLng] = useState("");
  const [mapsLink, setMapsLink] = useState("");
  const [mapsLinkStatus, setMapsLinkStatus] = useState<{ type: "success" | "error" | "loading"; text: string } | null>(null);

  // Recreation-only fields
  const [price, setPrice] = useState<string>("");
  const [currency, setCurrency] = useState<string>("COP");
  const [priceType, setPriceType] = useState<string>("per_person");
  const [duration, setDuration] = useState("");
  const [minCapacity, setMinCapacity] = useState<string>("");
  const [maxCapacity, setMaxCapacity] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("easy");
  const [minAge, setMinAge] = useState<string>("");
  const [includedText, setIncludedText] = useState<string>(""); // comma-separated input
  const [whatToBring, setWhatToBring] = useState("");
  const [schedule, setSchedule] = useState("");

  // Restaurant-only fields
  const [parentHotelId, setParentHotelId] = useState<string>("");
  const [hotelOptions, setHotelOptions] = useState<HotelOption[]>([]);

  const category = user ? roleToCat(user.role) : "hotel";
  const isRecreation = category === "recreation";
  const isRestaurant = category === "restaurant";

  const fetchServices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/services/provider/${user.username}`);
      const data = await res.json();
      setServices(data.services || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [user]);

  // Fetch hotels list (only when current user is a restaurant)
  const fetchHotels = useCallback(async () => {
    if (!isRestaurant) return;
    try {
      const res = await fetch(`${apiBase}/api/services?category=hotel`);
      const data = await res.json();
      setHotelOptions(
        (data.services || []).map((s: any) => ({ id: s.id, name: s.name }))
      );
    } catch (e) {
      console.error(e);
    }
  }, [isRestaurant]);

  useEffect(() => {
    if (!user || user.role === "traveler") {
      setLocation("/settings");
    }
  }, [user, setLocation]);

  useEffect(() => { fetchServices(); }, [fetchServices]);
  useEffect(() => { fetchHotels(); }, [fetchHotels]);

  if (!user || user.role === "traveler") {
    return null;
  }

  // Procesa el link de Google Maps y rellena lat/lng automáticamente
  const handleMapsLinkChange = async (value: string) => {
    setMapsLink(value);

    const trimmed = value.trim();
    if (!trimmed) {
      setMapsLinkStatus(null);
      return;
    }

    // 1) Intento directo (URL larga o "lat,lng")
    let parsed = parseMapsLink(trimmed);

    // 2) Si parece link corto y no se pudo parsear, lo resolvemos en el servidor
    if (!parsed && isShortMapsLink(trimmed)) {
      setMapsLinkStatus({ type: "loading", text: "Resolviendo link corto…" });
      try {
        const res = await fetch(`${apiBase}/api/maps/resolve?url=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.url) {
            parsed = parseMapsLink(data.url);
          }
        }
      } catch (e) {
        // se manejará abajo como error genérico
      }
    }

    if (parsed) {
      setLocationLat(parsed.lat);
      setLocationLng(parsed.lng);
      setMapsLinkStatus({
        type: "success",
        text: `Coordenadas extraídas: ${parsed.lat}, ${parsed.lng}`,
      });
    } else {
      setMapsLinkStatus({
        type: "error",
        text: "No pude leer las coordenadas del link. Pega la URL completa de Google Maps o escríbelas manualmente abajo.",
      });
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setImageUrl("");
    setImageFile(null);
    setLocationLat("");
    setLocationLng("");
    setMapsLink("");
    setMapsLinkStatus(null);
    setPrice("");
    setCurrency("COP");
    setPriceType("per_person");
    setDuration("");
    setMinCapacity("");
    setMaxCapacity("");
    setDifficulty("easy");
    setMinAge("");
    setIncludedText("");
    setWhatToBring("");
    setSchedule("");
    setParentHotelId("");
    setFormMode("idle");
    setEditId(null);
    setMessage(null);
  };

  const openEdit = (svc: Service) => {
    setFormMode("edit");
    setEditId(svc.id);
    setName(svc.name);
    setDescription(svc.description || "");
    setImageUrl(svc.imageUrl || "");
    setLocationLat(svc.locationLat || "");
    setLocationLng(svc.locationLng || "");
    setMapsLink("");
    setMapsLinkStatus(null);
    setPrice(svc.price !== undefined && svc.price !== null ? String(svc.price) : "");
    setCurrency(svc.currency || "COP");
    setPriceType(svc.priceType || "per_person");
    setDuration(svc.duration || "");
    setMinCapacity(svc.minCapacity !== undefined && svc.minCapacity !== null ? String(svc.minCapacity) : "");
    setMaxCapacity(svc.maxCapacity !== undefined && svc.maxCapacity !== null ? String(svc.maxCapacity) : "");
    setDifficulty(svc.difficulty || "easy");
    setMinAge(svc.minAge !== undefined && svc.minAge !== null ? String(svc.minAge) : "");
    setIncludedText(Array.isArray(svc.included) ? svc.included.join(", ") : "");
    setWhatToBring(svc.whatToBring || "");
    setSchedule(svc.schedule || "");
    setParentHotelId(svc.parentHotelId || "");
    setMessage(null);
  };

  const uploadImage = async (): Promise<string> => {
    if (!imageFile) return imageUrl;
    const formData = new FormData();
    formData.append("file", imageFile);
    formData.append("category", category);
    formData.append("userId", user.username);
    const res = await fetch(apiBase + "/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    return data.url || imageUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setMessage({ type: "error", text: "El nombre es obligatorio" });
      return;
    }

    // Validar campos solo de recreación
    if (isRecreation) {
      if (price && isNaN(Number(price))) {
        setMessage({ type: "error", text: "El precio debe ser un número válido" });
        return;
      }
      if (minCapacity && maxCapacity && Number(minCapacity) > Number(maxCapacity)) {
        setMessage({ type: "error", text: "La capacidad mínima no puede ser mayor que la máxima" });
        return;
      }
    }

    setSubmitting(true);
    setMessage(null);

    try {
      let finalImageUrl = imageUrl;
      if (imageFile) {
        finalImageUrl = await uploadImage();
      }

      const body: any = {
        providerUsername: user.username,
        category,
        name: name.trim(),
        description: description.trim(),
        imageUrl: finalImageUrl,
        locationLat: locationLat || undefined,
        locationLng: locationLng || undefined,
      };

      // Solo enviar campos de recreación cuando aplica
      if (isRecreation) {
        body.price = price ? Number(price) : undefined;
        body.currency = currency || "COP";
        body.priceType = priceType || undefined;
        body.duration = duration.trim() || undefined;
        body.minCapacity = minCapacity ? Number(minCapacity) : undefined;
        body.maxCapacity = maxCapacity ? Number(maxCapacity) : undefined;
        body.difficulty = difficulty || undefined;
        body.minAge = minAge ? Number(minAge) : undefined;
        body.included = includedText.trim()
          ? includedText.split(",").map((s) => s.trim()).filter(Boolean)
          : undefined;
        body.whatToBring = whatToBring.trim() || undefined;
        body.schedule = schedule.trim() || undefined;
      }

      // Solo enviar parentHotelId cuando es restaurante
      if (isRestaurant) {
        body.parentHotelId = parentHotelId || undefined;
      }

      if (formMode === "add") {
        const res = await fetch(apiBase + "/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).message);
        setMessage({ type: "success", text: "Producto creado exitosamente" });
      } else {
        const res = await fetch(`${apiBase}/api/services/${editId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error((await res.json()).message);
        setMessage({ type: "success", text: "Producto actualizado exitosamente" });
      }

      await fetchServices();
      setTimeout(resetForm, 1500);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error al guardar" });
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${apiBase}/api/services/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerUsername: user.username }),
      });
      setDeleteConfirm(null);
      await fetchServices();
      setMessage({ type: "success", text: "Producto eliminado" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error al eliminar" });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container max-w-4xl py-12 px-4">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </button>

        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
              <Package className="h-8 w-8 text-primary" />
              Mis Productos
            </h1>
            <p className="text-muted-foreground">Administra tus servicios de <strong className="text-primary">{CATEGORY_MAP[category]}</strong></p>
          </div>
          {formMode === "idle" && (
            <Button onClick={() => { setFormMode("add"); setMessage(null); }} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2">
              <Plus className="h-4 w-4" /> Agregar
            </Button>
          )}
        </div>

        {/* Message */}
        <AnimatePresence>
          {message && formMode === "idle" && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm border ${message.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
              {message.type === "success" ? <Check className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
              <span>{message.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════ FORM (Add / Edit) ═══════ */}
        <AnimatePresence>
          {formMode !== "idle" && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="mb-10">
              <div className="bg-card/50 border border-border/50 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">{formMode === "add" ? "Agregar Producto" : "Editar Producto"}</h2>
                  <button onClick={resetForm} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {/* Form message */}
                <AnimatePresence>
                  {message && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                      className={`mb-4 p-3 rounded-xl flex items-center gap-2 text-sm border ${message.type === "success" ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
                      {message.type === "success" ? <Check className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                      <span>{message.text}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* ────── INFORMACIÓN GENERAL ────── */}
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nombre *</Label>
                    <Input placeholder="Ej: Hotel Paraíso / Tour de canopy" value={name} onChange={(e) => setName(e.target.value)} required className="bg-secondary/20 h-12 rounded-xl border-border/50" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Descripción</Label>
                    <Textarea placeholder="Describe tu servicio..." value={description} onChange={(e) => setDescription(e.target.value)} className="bg-secondary/20 rounded-xl border-border/50 min-h-[100px]" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Imagen</Label>
                    <div className="flex gap-3 items-center">
                      <label className="flex-1 flex items-center gap-3 p-3 border border-dashed border-border/50 rounded-xl cursor-pointer hover:border-primary/50 transition-colors bg-secondary/10">
                        <ImagePlus className="h-5 w-5 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{imageFile ? imageFile.name : "Seleccionar imagen..."}</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                      </label>
                    </div>
                    {(imageUrl || imageFile) && (
                      <div className="mt-2 h-32 rounded-xl overflow-hidden border border-border/30">
                        <img src={imageFile ? URL.createObjectURL(imageFile) : imageUrl} alt="preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                  {/* ────── UBICACIÓN ────── */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <Label className="text-xs font-semibold uppercase tracking-wider text-primary">Ubicación</Label>
                    </div>

                    {/* Link de Google Maps */}
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                        <LinkIcon className="h-3 w-3" /> Link de Google Maps
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Pega aquí el link de Google Maps de tu local"
                          value={mapsLink}
                          onChange={(e) => handleMapsLinkChange(e.target.value)}
                          className="bg-secondary/20 h-12 rounded-xl border-border/50 flex-1"
                        />
                        {mapsLink && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setMapsLink("");
                              setMapsLinkStatus(null);
                            }}
                            className="h-12 w-12 rounded-xl"
                            aria-label="Borrar link"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {mapsLinkStatus && (
                        <div
                          className={`text-xs flex items-start gap-1.5 px-1 ${
                            mapsLinkStatus.type === "success"
                              ? "text-emerald-400"
                              : mapsLinkStatus.type === "error"
                              ? "text-red-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {mapsLinkStatus.type === "success" && <Check className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                          {mapsLinkStatus.type === "error" && <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                          {mapsLinkStatus.type === "loading" && <Loader2 className="h-3.5 w-3.5 shrink-0 mt-0.5 animate-spin" />}
                          <span>{mapsLinkStatus.text}</span>
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground/70 px-1 leading-relaxed">
                        Tip: en Google Maps abre tu local, toca <span className="font-semibold">Compartir</span> y copia el link. También funcionan los links cortos (maps.app.goo.gl).
                      </p>
                    </div>

                    {/* Latitud / Longitud (auto-rellenadas o manuales) */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Latitud</Label>
                        <Input placeholder="Ej: 7.0847" value={locationLat} onChange={(e) => setLocationLat(e.target.value)} className="bg-secondary/20 h-12 rounded-xl border-border/50" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Longitud</Label>
                        <Input placeholder="Ej: -73.1198" value={locationLng} onChange={(e) => setLocationLng(e.target.value)} className="bg-secondary/20 h-12 rounded-xl border-border/50" />
                      </div>
                    </div>
                  </div>

                  {/* ────── CAMPOS EXCLUSIVOS DE RECREACIÓN ────── */}
                  {isRecreation && (
                    <div className="mt-6 pt-6 border-t border-border/30 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                          Detalles de la actividad
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground -mt-3 mb-4">
                        Estos campos solo aparecen para servicios de recreación. Todos son opcionales.
                      </p>

                      {/* Precio (3 columnas: precio, moneda, tipo) */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Precio
                        </Label>
                        <div className="grid grid-cols-12 gap-2">
                          <Input
                            type="number"
                            min="0"
                            placeholder="50000"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="bg-secondary/20 h-12 rounded-xl border-border/50 col-span-5"
                          />
                          <select
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value)}
                            className="bg-secondary/20 h-12 rounded-xl border border-border/50 px-3 col-span-3 text-sm"
                          >
                            <option value="COP">COP</option>
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                          </select>
                          <select
                            value={priceType}
                            onChange={(e) => setPriceType(e.target.value)}
                            className="bg-secondary/20 h-12 rounded-xl border border-border/50 px-3 col-span-4 text-sm"
                          >
                            <option value="per_person">por persona</option>
                            <option value="per_group">por grupo</option>
                            <option value="per_hour">por hora</option>
                            <option value="per_day">por día</option>
                            <option value="from">desde</option>
                          </select>
                        </div>
                        {price && (
                          <p className="text-xs text-muted-foreground">
                            Vista previa: <strong className="text-primary">{formatMoney(Number(price), currency)}</strong> {PRICE_TYPE_LABELS[priceType]}
                          </p>
                        )}
                      </div>

                      {/* Duración + Edad mínima */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Duración
                          </Label>
                          <Input
                            placeholder="Ej: 2 horas, medio día"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            className="bg-secondary/20 h-12 rounded-xl border-border/50"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                            <Baby className="h-3 w-3" /> Edad mínima
                          </Label>
                          <Input
                            type="number"
                            min="0"
                            placeholder="Ej: 12"
                            value={minAge}
                            onChange={(e) => setMinAge(e.target.value)}
                            className="bg-secondary/20 h-12 rounded-xl border-border/50"
                          />
                        </div>
                      </div>

                      {/* Capacidad min/max */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Users className="h-3 w-3" /> Capacidad (personas)
                        </Label>
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            type="number"
                            min="1"
                            placeholder="Mínimo (ej: 2)"
                            value={minCapacity}
                            onChange={(e) => setMinCapacity(e.target.value)}
                            className="bg-secondary/20 h-12 rounded-xl border-border/50"
                          />
                          <Input
                            type="number"
                            min="1"
                            placeholder="Máximo (ej: 10)"
                            value={maxCapacity}
                            onChange={(e) => setMaxCapacity(e.target.value)}
                            className="bg-secondary/20 h-12 rounded-xl border-border/50"
                          />
                        </div>
                      </div>

                      {/* Dificultad */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Mountain className="h-3 w-3" /> Nivel de dificultad
                        </Label>
                        <div className="grid grid-cols-4 gap-2">
                          {(["easy", "moderate", "hard", "extreme"] as const).map((d) => (
                            <button
                              type="button"
                              key={d}
                              onClick={() => setDifficulty(d)}
                              className={`h-12 rounded-xl border text-sm font-medium transition-all ${
                                difficulty === d
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "bg-secondary/20 border-border/50 text-muted-foreground hover:border-primary/30"
                              }`}
                            >
                              {DIFFICULTY_LABELS[d]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Qué incluye */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Qué incluye (separa con comas)
                        </Label>
                        <Input
                          placeholder="Ej: Equipo, Guía bilingüe, Refrigerio, Transporte"
                          value={includedText}
                          onChange={(e) => setIncludedText(e.target.value)}
                          className="bg-secondary/20 h-12 rounded-xl border-border/50"
                        />
                        {includedText.trim() && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {includedText.split(",").map((s) => s.trim()).filter(Boolean).map((tag, i) => (
                              <span key={i} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-md">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Qué llevar */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Qué llevar (recomendaciones)
                        </Label>
                        <Textarea
                          placeholder="Ej: Ropa cómoda, protector solar, agua, calzado deportivo..."
                          value={whatToBring}
                          onChange={(e) => setWhatToBring(e.target.value)}
                          className="bg-secondary/20 rounded-xl border-border/50 min-h-[60px]"
                        />
                      </div>

                      {/* Horarios */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Horarios disponibles
                        </Label>
                        <Input
                          placeholder="Ej: Lunes a domingo 8am-5pm / Solo fines de semana"
                          value={schedule}
                          onChange={(e) => setSchedule(e.target.value)}
                          className="bg-secondary/20 h-12 rounded-xl border-border/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* ────── CAMPOS EXCLUSIVOS DE RESTAURANTE ────── */}
                  {isRestaurant && (
                    <div className="mt-6 pt-6 border-t border-border/30 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Hotel className="h-4 w-4 text-primary" />
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                          Conexión con un hotel
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground -mt-3 mb-2">
                        Si tu restaurante está dentro de un hotel, selecciónalo aquí. Los huéspedes podrán encontrarlo desde el hotel. Es opcional.
                      </p>

                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Hotel donde se ubica
                        </Label>
                        <select
                          value={parentHotelId}
                          onChange={(e) => setParentHotelId(e.target.value)}
                          className="bg-secondary/20 h-12 rounded-xl border border-border/50 px-3 w-full text-sm"
                        >
                          <option value="">— Independiente (no estoy dentro de un hotel) —</option>
                          {hotelOptions.length === 0 && (
                            <option value="" disabled>No hay hoteles registrados aún</option>
                          )}
                          {hotelOptions.map((h) => (
                            <option key={h.id} value={h.id}>{h.name}</option>
                          ))}
                        </select>
                        {parentHotelId && (
                          <p className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                            <Check className="h-3 w-3" />
                            Tu restaurante aparecerá vinculado a este hotel.
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" onClick={resetForm} className="flex-1 h-12 rounded-xl border-border/50">Cancelar</Button>
                    <Button type="submit" disabled={submitting} className="flex-1 h-12 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl font-bold">
                      {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Guardando...</> : formMode === "add" ? "Agregar Producto" : "Guardar Cambios"}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════ PRODUCT LIST ═══════ */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : services.length === 0 ? (
          <div className="text-center py-20 bg-card/30 rounded-2xl border border-border/30">
            <Package className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2 text-muted-foreground">Sin productos aún</h3>
            <p className="text-sm text-muted-foreground/60 mb-6">Agrega tu primer servicio para que los viajeros te encuentren.</p>
            {formMode === "idle" && (
              <Button onClick={() => setFormMode("add")} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2">
                <Plus className="h-4 w-4" /> Agregar primer producto
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {services.map((svc) => (
              <motion.div key={svc.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-card border border-border/40 rounded-2xl overflow-hidden flex flex-col group hover:border-primary/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.5)] transition-all duration-300"
              >
                {svc.imageUrl ? (
                  <div className="w-full h-48 shrink-0 relative overflow-hidden bg-secondary/20">
                    <img src={svc.imageUrl} alt={svc.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                      <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg">
                        {CATEGORY_MAP[svc.category] || svc.category}
                      </span>
                      {svc.category === "recreation" && svc.price !== undefined && svc.price !== null && (
                        <span className="px-2.5 py-1 bg-primary/90 backdrop-blur-md text-black text-xs font-bold rounded-lg shadow-lg">
                          {formatMoney(svc.price, svc.currency || "COP")}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-48 shrink-0 bg-secondary/30 flex items-center justify-center relative">
                    <Package className="h-10 w-10 text-muted-foreground/30" />
                    <span className="absolute bottom-4 left-4 px-2.5 py-1 bg-black/60 backdrop-blur-md border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg">
                      {CATEGORY_MAP[svc.category] || svc.category}
                    </span>
                  </div>
                )}
                
                <div className="flex-1 p-5 flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">{svc.name}</h3>
                    <div className="flex gap-1 ml-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(svc)} className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      {deleteConfirm === svc.id ? (
                        <div className="flex items-center gap-1 absolute right-4 top-4 z-10 bg-card p-2 rounded-xl border border-red-500/30 shadow-xl">
                          <button onClick={() => handleDelete(svc.id)} className="px-2 py-1 rounded-md bg-red-500 text-white text-xs font-bold hover:bg-red-600 transition-colors">Confirmar</button>
                          <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded-md bg-secondary text-muted-foreground text-xs hover:bg-secondary/80 transition-colors">Cancelar</button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(svc.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors" title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {svc.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4 font-light">{svc.description}</p>
                  )}
                  
                  <div className="mt-auto space-y-3">
                    {/* Recreation extra info chips */}
                    {svc.category === "recreation" && (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {svc.duration && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/30"><Clock className="h-3 w-3 text-primary" /> {svc.duration}</span>
                        )}
                        {(svc.minCapacity || svc.maxCapacity) && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/30">
                            <Users className="h-3 w-3 text-primary" /> {svc.minCapacity || 1}{svc.maxCapacity ? `–${svc.maxCapacity}` : "+"}
                          </span>
                        )}
                        {svc.difficulty && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/30">
                            <Mountain className="h-3 w-3 text-primary" /> {DIFFICULTY_LABELS[svc.difficulty] || svc.difficulty}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Restaurant: badge "Dentro de Hotel X" */}
                    {svc.category === "restaurant" && svc.parentHotelId && (
                      <div>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium rounded-lg">
                          <Hotel className="h-3.5 w-3.5" />
                          Dentro de: {hotelOptions.find((h) => h.id === svc.parentHotelId)?.name || "Hotel"}
                        </span>
                      </div>
                    )}

                    {(svc.locationLat || svc.locationLng) && (
                      <div className="pt-3 border-t border-border/30 mt-3">
                        <p className="text-[11px] text-muted-foreground/60 inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {svc.locationLat}, {svc.locationLng}</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
