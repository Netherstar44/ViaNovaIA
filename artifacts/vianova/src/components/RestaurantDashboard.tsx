import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils, BarChart3, MessageSquare, Hotel,
  Eye, Star, TrendingUp, Users,
  EyeOff, Trash2, Check, X, Loader2,
  Send, Clock, CheckCircle, XCircle,
  ShoppingBag, Calendar, Plus, ChevronRight,
  Image as ImageIcon, Video, Box, MapPin, Link as LinkIcon,
  Globe, Bell, Settings, Coffee, ToggleLeft, ToggleRight, Edit2, Upload, ExternalLink, ArrowRight, LogOut
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import VRViewer from "@/components/VRViewer";
import Navbar from "@/components/Navbar";

interface Analytics {
  totalViews: number;
  weekViews: number;
  avgRating: number;
  totalComments: number;
  linkedHotels: number;
  mapClicks: number;
  vrEngagement: number;
  viewsByDay: { day: string; count: number }[];
  ordersByDay: { day: string; count: number }[];
}

interface CommentItem {
  id: string;
  locationId: string;
  authorUsername: string;
  content: string;
  rating: number | null;
  hidden: boolean;
  replyContent?: string | null;
  replyCreatedAt?: string | null;
  parentCommentId?: string | null;
  updatedAt?: string | null;
  createdAt: string;
  replies?: CommentItem[];
}

interface RoomLink {
  id: string;
  restaurantServiceId: string;
  hotelServiceId: string;
  restaurantUsername: string;
  hotelUsername: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface HotelOption {
  id: string;
  name: string;
  providerUsername: string;
  imageUrl?: string;
}

interface RestaurantItem {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  locationLat: string;
  locationLng: string;
  googleMapsUrl?: string;
  isActive: boolean;
  foodCategories?: string[];
  priceRange?: string;
  whatsappNumber?: string;
  schedule?: string;
  paymentMethods?: string;
  acceptsOrders: boolean;
  roomService: boolean;
  roomServiceSchedule?: string;
  hotelMenuSupport: boolean;
  parentHotelId?: string;
  hasVR: boolean;
  hasAR: boolean;
  vrType: "none" | "model" | "panorama" | "external";
  vrModelUrl?: string;
  vrInteriorUrl?: string;
  externalVrUrl?: string;
  menuData?: {
    categories?: {
      id: string;
      name: string;
      items: { id: string; name: string; price: number; description?: string; available: boolean }[];
    }[];
    pdfUrl?: string;
    imageUrl?: string;
  };
  mediaGallery?: {
    images?: string[];
    videos?: string[];
    pan360?: string[];
    coverUrl?: string;
    mapPreviewUrl?: string;
  };
}

type Tab = "registry" | "menu" | "media" | "maps" | "analytics" | "orders" | "comments" | "immersive" | "roomservice";

interface RestaurantDashboardProps {
  initialTab?: Tab;
}

export default function RestaurantDashboard({ initialTab }: RestaurantDashboardProps = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [_, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>(initialTab || "analytics");

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);
  const [restaurants, setRestaurants] = useState<RestaurantItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedRest, setSelectedRest] = useState<RestaurantItem | null>(null);
  
  // Data lists per selected restaurant
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [links, setLinks] = useState<RoomLink[]>([]);
  const [hotels, setHotels] = useState<HotelOption[]>([]);
  const [ordersList, setOrdersList] = useState<any[]>([]);
  
  // State control
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Registry Form Fields (for create/edit)
  const [isEditing, setIsEditing] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [regName, setRegName] = useState("");
  const [regDesc, setRegDesc] = useState("");
  const [regImgUrl, setRegImgUrl] = useState("");
  const [regLat, setRegLat] = useState("");
  const [regLng, setRegLng] = useState("");
  const [regMapsUrl, setRegMapsUrl] = useState("");
  const [regIsActive, setRegIsActive] = useState(true);
  const [regPriceRange, setRegPriceRange] = useState("medio");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [regSchedule, setRegSchedule] = useState("");
  const [regPayment, setRegPayment] = useState("ambos");
  const [regFoodCats, setRegFoodCats] = useState<string[]>([]);
  const [newFoodCat, setNewFoodCat] = useState("");
  const [regAcceptsOrders, setRegAcceptsOrders] = useState(true);
  
  // Maps Autocomplete Simulator
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<{name: string, lat: string, lng: string}[]>([]);
  const [resolvingLink, setResolvingLink] = useState(false);

  // Digital Menu State
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemPrice, setNewItemPrice] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [menuPdfUrl, setMenuPdfUrl] = useState("");
  const [menuImageUrl, setMenuImageUrl] = useState("");

  // Media Gallery State
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryVideos, setGalleryVideos] = useState<string[]>([]);
  const [gallery360, setGallery360] = useState<string[]>([]);
  const [mediaCoverUrl, setMediaCoverUrl] = useState("");
  const [mediaMapPreviewUrl, setMediaMapPreviewUrl] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [new360Url, setNew360Url] = useState("");

  // Comments Reply State
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  
  // Immersive Experiencie State
  const [vrEnabled, setVrEnabled] = useState(false);
  const [vrTypeSelection, setVrTypeSelection] = useState<"none" | "model" | "panorama" | "external">("none");
  const [vrModelUrlInput, setVrModelUrlInput] = useState("");
  const [vrExternalUrlInput, setVrExternalUrlInput] = useState("");
  const [vrPanoramaUrlInput, setVrPanoramaUrlInput] = useState("");
  const [detectedVrType, setDetectedVrType] = useState<string>("Ninguno");

  // Hotel Integration State
  const [isInsideHotel, setIsInsideHotel] = useState(false);
  const [linkedHotelId, setLinkedHotelId] = useState("");
  const [roomServiceEnabled, setRoomServiceEnabled] = useState(false);
  const [roomServiceSchedule, setRoomServiceSchedule] = useState("07:00 - 22:00");
  const [hotelMenuSupport, setHotelMenuSupport] = useState(false);

  // Smart Maps Click Simulator
  const [mapsSimulated, setMapsSimulated] = useState(false);

  const username = user?.username || "";

  // Helper file upload to Cloudinary
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>, fileType: string, callback: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    toast({ title: "Subiendo archivo...", description: "Cargando archivo en Cloudinary..." });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", "restaurant");
    formData.append("userId", username);
    
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Fallo de red");
      const data = await res.json();
      callback(data.url);
      toast({ title: "¡Archivo subido!", description: "El archivo se cargó correctamente." });
    } catch {
      toast({ title: "Error", description: "No se pudo subir el archivo.", variant: "destructive" });
    }
  };

  // Run DB Migrations dynamically
  const runMigration = async () => {
    try {
      await fetch("/api/restaurant/migrate");
    } catch {}
  };

  // Fetch all restaurants owned by the provider
  const fetchRestaurants = useCallback(async () => {
    try {
      const res = await fetch(`/api/services/provider/${encodeURIComponent(username)}`);
      if (res.ok) {
        const data = await res.json();
        const list = (data.services || []).filter((s: any) => s.category === "restaurant");
        setRestaurants(list);
        if (list.length > 0) {
          // If none selected, default to first
          if (!selectedId) {
            setSelectedId(list[0].id);
          }
        }
      }
    } catch (e) {}
  }, [username, selectedId]);

  // Load specific restaurant details
  useEffect(() => {
    if (selectedId && restaurants.length > 0) {
      const r = restaurants.find(item => item.id === selectedId);
      if (r) {
        setSelectedRest(r);
        
        // Populate Registry Form
        setRegName(r.name);
        setRegDesc(r.description || "");
        setRegImgUrl(r.imageUrl || "");
        setRegLat(r.locationLat || "");
        setRegLng(r.locationLng || "");
        setRegMapsUrl(r.googleMapsUrl || "");
        setRegIsActive(r.isActive ?? true);
        setRegPriceRange(r.priceRange || "medio");
        setRegWhatsapp(r.whatsappNumber || "");
        setRegSchedule(r.schedule || "");
        setRegPayment(r.paymentMethods || "ambos");
        setRegFoodCats(r.foodCategories || []);
        setRegAcceptsOrders(r.acceptsOrders ?? true);

        // Populate Digital Menu
        setMenuCategories(r.menuData?.categories || []);
        setMenuPdfUrl(r.menuData?.pdfUrl || "");
        setMenuImageUrl(r.menuData?.imageUrl || "");

        // Populate Media Gallery
        setGalleryImages(r.mediaGallery?.images || []);
        setGalleryVideos(r.mediaGallery?.videos || []);
        setGallery360(r.mediaGallery?.pan360 || []);
        setMediaCoverUrl(r.mediaGallery?.coverUrl || r.imageUrl || "");
        setMediaMapPreviewUrl(r.mediaGallery?.mapPreviewUrl || "");

        // Populate VR Immersive
        setVrEnabled(r.hasVR || r.hasAR || false);
        setVrTypeSelection(r.vrType || "none");
        setVrModelUrlInput(r.vrModelUrl || "");
        setVrExternalUrlInput(r.externalVrUrl || "");

        // Populate Hotel Integration
        setIsInsideHotel(!!r.parentHotelId);
        setLinkedHotelId(r.parentHotelId || "");
        setRoomServiceEnabled(r.roomService || false);
        setRoomServiceSchedule(r.roomServiceSchedule || "07:00 - 22:00");
        setHotelMenuSupport(r.hotelMenuSupport || false);
      }
    } else {
      setSelectedRest(null);
    }
  }, [selectedId, restaurants]);

  // Load secondary data: Analytics, Orders, Comments, Room links
  const loadRestaurantData = useCallback(async (serviceId: string) => {
    if (!serviceId) return;
    setDataLoading(true);
    try {
      const [resAnalytics, resComments, resOrders, resLinks, resHotels] = await Promise.all([
        fetch(`/api/restaurant/analytics/${encodeURIComponent(username)}?serviceId=${serviceId}`),
        // includeHidden=true para que el Dashboard del restaurante vea TODOS los comentarios (incluso moderados)
        fetch(`/api/comments?locationId=${serviceId}&includeHidden=true`),
        fetch(`/api/restaurant/orders/${encodeURIComponent(username)}?serviceId=${serviceId}`),
        fetch(`/api/room-service/restaurant/${encodeURIComponent(username)}?serviceId=${serviceId}`),
        fetch("/api/restaurant/available-hotels")
      ]);

      if (resAnalytics.ok) setAnalytics(await resAnalytics.json());
      if (resComments.ok) {
        const cData = await resComments.json();
        setComments(cData.comments || []);
      }
      if (resOrders.ok) {
        const oData = await resOrders.json();
        setOrdersList(oData.orders || []);
      }
      if (resLinks.ok) {
        const lData = await resLinks.json();
        setLinks(lData.links || []);
      }
      if (resHotels.ok) {
        const hData = await resHotels.json();
        setHotels(hData.hotels || []);
      }

      // Registrar vista del servicio en analytics (no bloqueante)
      fetch(`/api/services/${serviceId}/track-click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewerUsername: username }),
      }).catch(() => {});

    } catch (e) {}
    setDataLoading(false);
  }, [username]);

  // Initial Loader
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await runMigration();
      await fetchRestaurants();
      setLoading(false);
    };
    init();
  }, [fetchRestaurants]);

  // Load data when selected restaurant changes
  useEffect(() => {
    if (selectedId) {
      loadRestaurantData(selectedId);
    }
  }, [selectedId, loadRestaurantData]);

  // Google Maps link coordinate parsing resolver
  const handleMapsUrlResolve = async (url: string) => {
    setRegMapsUrl(url);
    if (!url.trim()) return;
    setResolvingLink(true);
    try {
      const res = await fetch(`/api/maps/resolve?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        const resolved = data.url;
        
        // Extract coordinate matches
        const atMatch = resolved.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (atMatch) {
          setRegLat(atMatch[1]);
          setRegLng(atMatch[2]);
          toast({ title: "GPS Autogenerado", description: `Coordenadas extraídas: ${atMatch[1]}, ${atMatch[2]}` });
        } else {
          const dMatch = resolved.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
          if (dMatch) {
            setRegLat(dMatch[1]);
            setRegLng(dMatch[2]);
            toast({ title: "GPS Autogenerado", description: `Coordenadas extraídas: ${dMatch[1]}, ${dMatch[2]}` });
          }
        }
      }
    } catch {}
    setResolvingLink(false);
  };

  // Maps Autocomplete simulation
  const handleMockAddressSearch = (q: string) => {
    setSearchQuery(q);
    if (!q) {
      setSearchSuggestions([]);
      return;
    }
    // Mock suggestions matching query
    const list = [
      { name: `${q} - Plaza Mayor, Centro`, lat: "40.415363", lng: "-3.707398" },
      { name: `${q} - Calle Gran Vía 45`, lat: "40.420311", lng: "-3.704285" },
      { name: `${q} - Paseo de la Castellana`, lat: "40.441029", lng: "-3.691512" },
      { name: `${q} - Zona Gourmet Premium`, lat: "40.432881", lng: "-3.684129" }
    ];
    setSearchSuggestions(list);
  };

  const selectSuggestion = (s: {name: string, lat: string, lng: string}) => {
    setRegMapsUrl(`https://www.google.com/maps/place/${encodeURIComponent(s.name)}/@${s.lat},${s.lng},17z`);
    setRegLat(s.lat);
    setRegLng(s.lng);
    setSearchQuery(s.name);
    setSearchSuggestions([]);
    toast({ title: "Ubicación autocompletada", description: `Coordenadas: ${s.lat}, ${s.lng}` });
  };

  // Create or Update Restaurant Registry
  const handleSaveRestaurantRegistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        providerUsername: username,
        category: "restaurant",
        name: regName.trim(),
        description: regDesc.trim(),
        imageUrl: regImgUrl || "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
        locationLat: regLat || undefined,
        locationLng: regLng || undefined,
        googleMapsUrl: regMapsUrl.trim() || undefined,
        isActive: regIsActive,
        priceRange: regPriceRange,
        whatsappNumber: regWhatsapp.trim() || undefined,
        schedule: regSchedule.trim() || undefined,
        paymentMethods: regPayment,
        foodCategories: regFoodCats,
        acceptsOrders: regAcceptsOrders,
        roomService: roomServiceEnabled,
        roomServiceSchedule: roomServiceSchedule,
        hotelMenuSupport: hotelMenuSupport,
        parentHotelId: isInsideHotel ? (linkedHotelId || undefined) : undefined,
        hasVR: vrEnabled,
        hasAR: vrEnabled && vrTypeSelection === "model",
        vrType: vrTypeSelection,
        vrModelUrl: vrModelUrlInput.trim() || undefined,
        vrInteriorUrl: vrPanoramaUrlInput.trim() || undefined,
        externalVrUrl: vrExternalUrlInput.trim() || undefined,
        menuData: {
          categories: menuCategories,
          pdfUrl: menuPdfUrl,
          imageUrl: menuImageUrl
        },
        mediaGallery: {
          images: galleryImages,
          videos: galleryVideos,
          pan360: gallery360,
          coverUrl: mediaCoverUrl || regImgUrl,
          mapPreviewUrl: mediaMapPreviewUrl
        }
      };

      const url = isCreatingNew ? "/api/services" : `/api/services/${selectedId}`;
      const method = isCreatingNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Fallo de guardado");
      const data = await res.json();
      
      toast({ title: "¡Éxito!", description: `Restaurante ${isCreatingNew ? "registrado" : "actualizado"} exitosamente.` });
      
      setIsCreatingNew(false);
      setIsEditing(false);
      
      const newId = isCreatingNew ? data.service.id : selectedId;
      setSelectedId(newId);
      await fetchRestaurants();
    } catch {
      toast({ title: "Error", description: "No se pudo guardar la información.", variant: "destructive" });
    }
    setSubmitting(false);
  };

  // Delete/Archive Restaurant
  const handleDeleteRestaurant = async () => {
    if (!selectedId) return;
    if (!confirm(`¿Estás completamente seguro de eliminar "${selectedRest?.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      const res = await fetch(`/api/services/${selectedId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerUsername: username })
      });
      if (res.ok) {
        toast({ title: "Restaurante eliminado", description: "El registro ha sido removido de la base de datos." });
        setSelectedId("");
        setSelectedRest(null);
        await fetchRestaurants();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el restaurante.", variant: "destructive" });
    }
  };

  // DIGITAL MENU OPERATIONS
  const handleSaveMenu = async () => {
    if (!selectedId) return;
    try {
      const updatedMenu = {
        categories: menuCategories,
        pdfUrl: menuPdfUrl,
        imageUrl: menuImageUrl
      };
      const res = await fetch(`/api/services/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerUsername: username,
          menuData: updatedMenu
        })
      });
      if (res.ok) {
        toast({ title: "Menú guardado", description: "El menú digital ha sido actualizado correctamente." });
        await fetchRestaurants();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo guardar el menú.", variant: "destructive" });
    }
  };

  const addMenuCategory = () => {
    if (!categoryNameInput.trim()) return;
    const newCat = {
      id: crypto.randomUUID(),
      name: categoryNameInput.trim(),
      items: []
    };
    setMenuCategories(prev => [...prev, newCat]);
    setCategoryNameInput("");
    toast({ title: "Categoría agregada", description: "Guarda los cambios para persistir en base de datos." });
  };

  const removeMenuCategory = (catId: string) => {
    setMenuCategories(prev => prev.filter(c => c.id !== catId));
  };

  const addMenuItem = (catIndex: number) => {
    if (!newItemName.trim() || !newItemPrice) return;
    const newItem = {
      id: crypto.randomUUID(),
      name: newItemName.trim(),
      price: Number(newItemPrice),
      description: newItemDesc.trim() || undefined,
      available: true
    };
    const updated = [...menuCategories];
    updated[catIndex].items.push(newItem);
    setMenuCategories(updated);
    
    setNewItemName("");
    setNewItemPrice("");
    setNewItemDesc("");
    setEditingCategoryIndex(null);
  };

  const toggleMenuItemAvailability = (catIndex: number, itemIndex: number) => {
    const updated = [...menuCategories];
    updated[catIndex].items[itemIndex].available = !updated[catIndex].items[itemIndex].available;
    setMenuCategories(updated);
  };

  const deleteMenuItem = (catIndex: number, itemIndex: number) => {
    const updated = [...menuCategories];
    updated[catIndex].items.splice(itemIndex, 1);
    setMenuCategories(updated);
  };

  // MEDIA GALLERY OPERATIONS
  const handleSaveMediaGallery = async () => {
    if (!selectedId) return;
    try {
      const updatedGallery = {
        images: galleryImages,
        videos: galleryVideos,
        pan360: gallery360,
        coverUrl: mediaCoverUrl,
        mapPreviewUrl: mediaMapPreviewUrl
      };
      const res = await fetch(`/api/services/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerUsername: username,
          mediaGallery: updatedGallery
        })
      });
      if (res.ok) {
        toast({ title: "Galería guardada", description: "Los archivos multimedia han sido actualizados." });
        await fetchRestaurants();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar la galería.", variant: "destructive" });
    }
  };

  // IMMERSIVE VR EXPERIENCE OPERATIONS
  useEffect(() => {
    // Autodetect Experience Type based on Model/Interior URL inputs
    if (vrEnabled) {
      if (vrModelUrlInput.endsWith(".glb") || vrModelUrlInput.endsWith(".gltf")) {
        setDetectedVrType("Modelo 3D (WebGL Rendering)");
        setVrTypeSelection("model");
      } else if (vrExternalUrlInput.startsWith("http")) {
        setDetectedVrType("Tour VR Externo (Redirect)");
        setVrTypeSelection("external");
      } else {
        setDetectedVrType("Por definir");
      }
    } else {
      setDetectedVrType("Ninguna");
      setVrTypeSelection("none");
    }
  }, [vrEnabled, vrModelUrlInput, vrExternalUrlInput]);

  const handleSaveVRConfig = async () => {
    if (!selectedId) return;
    try {
      const res = await fetch(`/api/services/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerUsername: username,
          hasVR: vrEnabled,
          vrType: vrTypeSelection,
          vrModelUrl: vrModelUrlInput.trim() || null,
          externalVrUrl: vrExternalUrlInput.trim() || null
        })
      });
      if (res.ok) {
        toast({ title: "Experiencia VR Actualizada", description: "Los parámetros del metaverso se configuraron con éxito." });
        await fetchRestaurants();
      }
    } catch {
      toast({ title: "Error", description: "No se pudo actualizar la configuración 3D.", variant: "destructive" });
    }
  };

  // SMART MAPS TELEMETRY TRACKER
  const handleMapPinClickRedirect = async () => {
    if (!selectedId || !selectedRest) return;
    setMapsSimulated(true);
    try {
      // Track Map Click Telemetry
      await fetch(`/api/services/${selectedId}/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "map" })
      });
      
      // Redirect to Google Maps navigation
      const url = selectedRest.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${selectedRest.locationLat},${selectedRest.locationLng}`;
      window.open(url, "_blank");
      
      loadRestaurantData(selectedId); // refresh telemetry count
      toast({ title: "Redirección a Maps registrada", description: "Se registró el click de navegación en analítica." });
    } catch {}
  };

  const simulateVrEngagement = async () => {
    if (!selectedId) return;
    try {
      await fetch(`/api/services/${selectedId}/track-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "vr" })
      });
      loadRestaurantData(selectedId);
      toast({ title: "Visualización 3D registrada", description: "Se incrementó el engagement VR en analítica." });
    } catch {}
  };

  // COMMENTS MANAGEMENT: BUSINESS REPLY
  const handleSendCommentReply = async (commentId: string) => {
    const text = replyTextMap[commentId];
    if (!text || !text.trim()) return;
    try {
      const res = await fetch(`/api/comments/${commentId}/reply`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyContent: text.trim() })
      });
      if (res.ok) {
        toast({ title: "Respuesta enviada", description: "Tu respuesta se guardó y es visible para los viajeros." });
        setReplyTextMap(prev => ({ ...prev, [commentId]: "" }));
        loadRestaurantData(selectedId);
      }
    } catch {
      toast({ title: "Error", description: "No se pudo enviar la respuesta." });
    }
  };

  const toggleHideComment = async (id: string) => {
    try {
      await fetch(`/api/comments/${id}/toggle-hide`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerUsername: username }),
      });
      loadRestaurantData(selectedId);
      toast({ title: "Estado de comentario cambiado", description: "Se actualizó la visibilidad del comentario." });
    } catch {}
  };

  const deleteCommentAdmin = async (id: string) => {
    if (!confirm("¿Eliminar comentario permanentemente?")) return;
    try {
      await fetch(`/api/comments/${id}/admin`, { method: "DELETE" });
      loadRestaurantData(selectedId);
      toast({ title: "Comentario eliminado", variant: "destructive" });
    } catch {}
  };

  // ROOM SERVICE LINK REQUEST
  const sendRoomServiceRequest = async (hotelId: string, hotelUsername: string) => {
    if (!selectedId) return;
    try {
      await fetch("/api/room-service/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantServiceId: selectedId,
          hotelServiceId: hotelId,
          restaurantUsername: username,
          hotelUsername,
        }),
      });
      loadRestaurantData(selectedId);
      toast({ title: "Solicitud enviada", description: "Se notificó al administrador del hotel." });
    } catch {}
  };

  // KITCHEN ORDER BOARD OPERATIONS
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      loadRestaurantData(selectedId);
      toast({ title: `Pedido actualizado`, description: `Estado actual: ${newStatus.toUpperCase()}` });
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-60 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground font-semibold tracking-wider">Iniciando Centro de Control Gastronómico...</p>
      </div>
    );
  }

  // Define tabs structure
  const tabsList = [
    { id: "analytics", label: "Métricas y Analítica", icon: <BarChart3 className="w-4 h-4" /> },
    { id: "registry", label: "Registro y Datos Físicos", icon: <Settings className="w-4 h-4" /> },
    { id: "menu", label: "Carta / Menú Digital", icon: <Coffee className="w-4 h-4" /> },
    { id: "media", label: "Galería Multimedia", icon: <ImageIcon className="w-4 h-4" /> },
    { id: "maps", label: "Smart Maps", icon: <MapPin className="w-4 h-4" /> },
    { id: "orders", label: "Panel Pedidos & Cocina", icon: <ShoppingBag className="w-4 h-4" /> },
    { id: "comments", label: "Reseñas de Clientes", icon: <MessageSquare className="w-4 h-4" /> },
    { id: "roomservice", label: "Integración Hotelera", icon: <Hotel className="w-4 h-4" /> },
    { id: "immersive", label: "Experiencia 3D/VR", icon: <Box className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Navbar />
      
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* SIDEBAR FOR RESTAURANT PANEL */}
        <aside className="w-full lg:w-64 bg-background/80 backdrop-blur-3xl border-b lg:border-b-0 lg:border-r border-border/50 flex flex-col lg:h-[calc(100vh-64px)] lg:sticky lg:top-[64px] z-40 shrink-0">
        <div className="pt-4 pb-6 px-6 flex flex-col items-center border-b border-border/50">
          <div className="w-16 h-16 rounded-[20px] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(255,215,0,0.1)] mb-2">
            <Utensils className="w-8 h-8 text-primary" />
          </div>
          <h2 className="font-extrabold text-xl tracking-tight text-foreground text-center">ViaNova Fusión</h2>
          <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1 text-center">Multi-Restaurant Panel</p>
        </div>

        {/* RESTAURANT SELECTOR DROPDOWN */}
        <div className="p-4 border-b border-border/50 bg-background/50">
          <Label className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 block">
            Seleccionar Restaurante
          </Label>
          {restaurants.length === 0 ? (
            <div className="text-xs text-muted-foreground py-2">Sin restaurantes registrados</div>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setIsEditing(false);
                setIsCreatingNew(false);
              }}
              className="w-full h-10 px-3 rounded-xl bg-background border border-border text-foreground outline-none focus:border-primary/50 transition-all font-bold text-sm cursor-pointer"
            >
              {restaurants.map(r => (
                <option key={r.id} value={r.id} className="bg-background text-foreground font-medium">
                  {r.name} {!r.isActive ? " (Inactivo)" : ""}
                </option>
              ))}
            </select>
          )}
          
          <Button
            size="sm"
            onClick={() => {
              setIsCreatingNew(true);
              setIsEditing(true);
              // reset fields for creation
              setRegName("");
              setRegDesc("");
              setRegImgUrl("");
              setRegLat("");
              setRegLng("");
              setRegMapsUrl("");
              setRegFoodCats([]);
              setRegWhatsapp("");
              setTab("registry");
            }}
            className="w-full mt-4 h-10 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold hover:bg-primary/20 transition-all flex items-center justify-center gap-2 text-xs"
          >
            <Plus className="w-4 h-4" /> Registrar Nueva Sede
          </Button>
        </div>

        {/* INTERNAL TABS NAVIGATION */}
        <nav className="flex-1 p-3 flex gap-1 overflow-x-auto lg:overflow-x-visible lg:flex-col lg:space-y-1 lg:overflow-y-auto max-h-[15vh] lg:max-h-none scrollbar-hide">
          {tabsList.map((item) => (
            <button
              key={item.id}
              disabled={restaurants.length === 0 && item.id !== "registry"}
              onClick={() => {
                setTab(item.id as Tab);
                setIsEditing(false);
                setIsCreatingNew(false);
              }}
              className={`shrink-0 w-auto lg:w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group disabled:opacity-30 disabled:cursor-not-allowed ${
                tab === item.id 
                  ? "bg-primary text-black font-extrabold shadow-[0_0_15px_rgba(255,215,0,0.15)]" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className={`p-1.5 rounded-lg ${tab === item.id ? "bg-black/10" : "bg-muted group-hover:bg-muted-foreground/20"}`}>
                {item.icon}
              </span>
              <span className="text-xs font-bold tracking-wide text-left whitespace-nowrap">{item.label}</span>
              {tab === item.id && <ChevronRight className="ml-auto w-4 h-4 opacity-50 hidden lg:block" />}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border/50 bg-muted/10 mt-auto">
          <button 
            onClick={() => setLocation("/")} 
            className="w-full flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors font-semibold text-sm"
          >
            <LogOut className="w-5 h-5 shrink-0" /> <span className="hidden lg:inline">Cerrar Dashboard</span>
          </button>
        </div>
      </aside>

      {/* MAIN VIEW CONTENT */}
      <main className="flex-1 min-h-screen bg-background p-6 lg:p-10 pb-24 overflow-y-auto">
        
        {/* HEADER AREA */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-border/50">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] uppercase">
                Restaurante
              </Badge>
              {selectedRest && (
                <Badge className={selectedRest.isActive ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"}>
                  {selectedRest.isActive ? "Activo" : "Inactivo"}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-black tracking-tight text-foreground mb-2">
              {isCreatingNew ? "Registrar Nueva Sede" : selectedRest?.name || "Crea tu primer Restaurante"}
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isCreatingNew 
                ? "Configura las especificaciones del nuevo punto gastronómico." 
                : selectedRest?.description || "Inicia registrando tu punto de venta en ViaNova IA."}
            </p>
          </div>
          
          {selectedRest && (
            <div className="flex items-center gap-4 bg-background border border-border/50 rounded-2xl p-4 self-start md:self-auto shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">
                {analytics?.avgRating?.toFixed(1) || "5.0"}
              </div>
              <div>
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.round(analytics?.avgRating || 5) ? "fill-primary text-primary" : "text-foreground/20"}`} />
                  ))}
                </div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase mt-0.5 block">
                  Calificación Promedio
                </span>
              </div>
            </div>
          )}
        </header>

        {dataLoading && (
          <div className="w-full flex items-center justify-center py-6 bg-primary/5 border border-primary/10 rounded-2xl mb-8 animate-pulse">
            <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
            <span className="text-xs font-bold text-primary uppercase tracking-widest">Sincronizando información de la sede...</span>
          </div>
        )}

        {restaurants.length === 0 && !isCreatingNew ? (
          <div className="text-center py-36 bg-muted/10 border border-dashed border-border/50 rounded-[32px]">
            <Utensils className="h-20 w-20 text-muted mx-auto mb-6 opacity-50" />
            <h3 className="text-xl font-bold text-foreground mb-2">Bienvenido a ViaNova Restaurantes</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm mb-8 leading-relaxed">
              Comienza a registrar las sedes de tu negocio. Podrás configurar menús digitales interactivos, visitas 3D, soporte de room service y recibir pedidos directo a cocina.
            </p>
            <Button
              onClick={() => {
                setIsCreatingNew(true);
                setIsEditing(true);
                setTab("registry");
              }}
              className="bg-primary text-black font-extrabold px-8 h-14 rounded-2xl shadow-lg shadow-primary/10 hover:bg-primary/95"
            >
              Registrar mi primer Restaurante
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            
            {/* ══════════════ TAB 1: ANALYTICS ══════════════ */}
            {tab === "analytics" && analytics && (
              <motion.div key="analytics" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8">
                
                {/* 5 Metricas solicitadas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  {[
                    { label: "Visitas Totales", value: analytics.totalViews, icon: <Eye className="w-5 h-5" />, color: "text-blue-400", bg: "bg-blue-400/10" },
                    { label: "Pedidos Recibidos", value: ordersList.length, icon: <ShoppingBag className="w-5 h-5" />, color: "text-green-400", bg: "bg-green-400/10" },
                    { label: "Calificación Promedio", value: `${analytics.avgRating.toFixed(1)} / 5`, icon: <Star className="w-5 h-5" />, color: "text-yellow-400", bg: "bg-yellow-400/10" },
                    { label: "Clicks en Mapa", value: analytics.mapClicks, icon: <MapPin className="w-5 h-5" />, color: "text-red-400", bg: "bg-red-400/10" },
                    { label: "Visualización 3D / VR", value: analytics.vrEngagement, icon: <Box className="w-5 h-5" />, color: "text-purple-400", bg: "bg-purple-400/10" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-3xl p-6 flex flex-col justify-between group hover:border-primary/20 transition-all duration-300">
                      <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color} mb-4 group-hover:scale-105 transition-transform`}>
                        {stat.icon}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                        <p className="text-2xl font-black text-foreground">{stat.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* CHARTS CONTAINER */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                      <TrendingUp className="w-5 h-5 text-primary" /> Historial de Visitas (Últimos 30 días)
                    </h3>
                    {analytics.viewsByDay.length === 0 ? (
                      <div className="h-[250px] flex items-center justify-center text-xs text-foreground/30">Sin vistas registradas aún</div>
                    ) : (
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={analytics.viewsByDay}>
                            <defs>
                              <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#FFD700" stopOpacity={0.25}/>
                                <stop offset="95%" stopColor="#FFD700" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#151515', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
                            <Area type="monotone" dataKey="count" stroke="#FFD700" strokeWidth={2.5} fillOpacity={1} fill="url(#viewsGrad)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-3">
                      <ShoppingBag className="w-5 h-5 text-green-400" /> Rendimiento de Pedidos
                    </h3>
                    {analytics.ordersByDay.length === 0 ? (
                      <div className="h-[250px] flex items-center justify-center text-xs text-foreground/30">Sin pedidos registrados aún</div>
                    ) : (
                      <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.ordersByDay}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                            <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                            <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} />
                            <Tooltip contentStyle={{ backgroundColor: '#151515', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px' }} />
                            <Bar dataKey="count" fill="#4ADE80" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                </div>

                {/* TELEMETRY SIMULATION CONTROLS */}
                <div className="bg-primary/5 border border-primary/10 rounded-[24px] p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                  <div>
                    <h4 className="font-bold text-foreground text-sm mb-1">Simulación de Telemetría (Pruebas)</h4>
                    <p className="text-xs text-foreground/55">Incrementa artificialmente el engagement de la sede para validar los paneles.</p>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" size="sm" onClick={handleMapPinClickRedirect} className="h-10 border-border text-xs font-bold text-foreground hover:bg-foreground/10">
                      Simular Click en Mapa
                    </Button>
                    <Button variant="outline" size="sm" onClick={simulateVrEngagement} className="h-10 border-border text-xs font-bold text-foreground hover:bg-foreground/10">
                      Simular Clic Visita VR
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ══════════════ TAB 2: REGISTRY (CREATE/EDIT) ══════════════ */}
            {tab === "registry" && (
              <motion.div key="registry" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                
                {/* Form Wrapper */}
                <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8 max-w-4xl shadow-2xl">
                  
                  <div className="flex items-center justify-between mb-8 pb-4 border-b border-border/50">
                    <h3 className="text-xl font-bold text-foreground">
                      {isCreatingNew ? "Nuevo Registro" : "Detalles y Configuración de Sede"}
                    </h3>
                    {!isCreatingNew && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleDeleteRestaurant}
                        className="h-10 px-4 rounded-xl text-xs font-bold flex gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Eliminar Restaurante
                      </Button>
                    )}
                  </div>

                  <form onSubmit={handleSaveRestaurantRegistry} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Nombre de Sede</Label>
                        <Input value={regName} onChange={(e) => setRegName(e.target.value)} placeholder="Ej: La Trattoria Bella - Centro" className="bg-foreground/5 h-12 rounded-xl border-border" required />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Rango de Precios</Label>
                        <select value={regPriceRange} onChange={(e) => setRegPriceRange(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-foreground/5 border border-border text-foreground outline-none">
                          <option value="bajo" className="bg-neutral-900">$ Bajo</option>
                          <option value="medio" className="bg-neutral-900">$$ Medio</option>
                          <option value="alto" className="bg-neutral-900">$$$ Alto</option>
                        </select>
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Descripción Corta</Label>
                        <Textarea value={regDesc} onChange={(e) => setRegDesc(e.target.value)} placeholder="Ej: Auténtica comida italiana a la leña, ambiente romántico y familiar..." className="bg-foreground/5 rounded-xl border-border resize-none min-h-[90px]" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-sans">Imagen Principal (URL o archivo)</Label>
                        <div className="flex gap-2">
                          <Input value={regImgUrl} onChange={(e) => setRegImgUrl(e.target.value)} placeholder="https://..." className="bg-foreground/5 h-12 rounded-xl border-border flex-1" />
                          <label className="h-12 w-12 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-xl flex items-center justify-center cursor-pointer transition-colors relative">
                            <Upload className="w-4 h-4 text-muted-foreground" />
                            <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, "image", setRegImgUrl)} className="hidden" />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">WhatsApp Pedidos</Label>
                        <Input value={regWhatsapp} onChange={(e) => setRegWhatsapp(e.target.value)} placeholder="Ej: +34600123456" className="bg-foreground/5 h-12 rounded-xl border-border" />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Métodos de Pago</Label>
                        <select value={regPayment} onChange={(e) => setRegPayment(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-foreground/5 border border-border text-foreground outline-none">
                          <option value="efectivo" className="bg-neutral-900">Efectivo</option>
                          <option value="transferencia" className="bg-neutral-900">Transferencia</option>
                          <option value="ambos" className="bg-neutral-900">Ambos Métodos</option>
                        </select>
                      </div>

                      {/* ACTIVE / INACTIVE STATUS */}
                      <div className="bg-foreground/5 border border-border/50 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-bold text-foreground block mb-0.5">Sede Visible / Activa</Label>
                          <span className="text-[10px] text-foreground/55">Controla si aparece en el mapa general de viajeros.</span>
                        </div>
                        <Switch checked={regIsActive} onCheckedChange={setRegIsActive} />
                      </div>

                      {/* ACCEPTS ORDERS */}
                      <div className="bg-foreground/5 border border-border/50 p-4 rounded-2xl flex items-center justify-between">
                        <div>
                          <Label className="text-sm font-bold text-foreground block mb-0.5">Habilitar Pedidos WhatsApp</Label>
                          <span className="text-[10px] text-foreground/55">Habilita compras y botón de entrega a domicilio.</span>
                        </div>
                        <Switch checked={regAcceptsOrders} onCheckedChange={setRegAcceptsOrders} />
                      </div>

                      {/* FOOD CATEGORIES LIST */}
                      <div className="space-y-2 md:col-span-2">
                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Especialidades Culinarias</Label>
                        <div className="flex gap-2 mb-3">
                          <Input value={newFoodCat} onChange={(e) => setNewFoodCat(e.target.value)} placeholder="Ej: Pizza, Gourmet, Pastas" className="bg-foreground/5 h-10 rounded-xl border-border flex-1" />
                          <Button 
                            type="button" 
                            onClick={() => {
                              if (newFoodCat.trim() && !regFoodCats.includes(newFoodCat.trim())) {
                                setRegFoodCats(prev => [...prev, newFoodCat.trim()]);
                                setNewFoodCat("");
                              }
                            }}
                            className="bg-foreground/10 text-foreground hover:bg-white/20 h-10 px-4 rounded-xl text-xs font-bold"
                          >
                            Agregar
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {regFoodCats.map(cat => (
                            <Badge key={cat} className="bg-primary/20 text-primary border-primary/30 flex items-center gap-1.5 px-3 py-1 text-xs">
                              {cat}
                              <button type="button" onClick={() => setRegFoodCats(prev => prev.filter(c => c !== cat))} className="text-primary hover:text-red-400">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {/* SMART MAPS: LOCATION PARSING / AUTOCOMPLETE */}
                      <div className="space-y-4 md:col-span-2 pt-6 border-t border-border/50">
                        <div className="flex items-center gap-2 text-primary font-bold text-sm">
                          <MapPin className="w-5 h-5" />
                          <span>Ubicación y Coordenadas del Restaurante</span>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5" /> Autocomplete por Dirección
                          </Label>
                          <div className="relative">
                            <Input value={searchQuery} onChange={(e) => handleMockAddressSearch(e.target.value)} placeholder="Escribe la calle o zona..." className="bg-foreground/5 h-12 rounded-xl border-border" />
                            {searchSuggestions.length > 0 && (
                              <div className="absolute top-13 left-0 right-0 bg-neutral-900 border border-border rounded-xl shadow-2xl z-55 overflow-hidden">
                                {searchSuggestions.map((s, idx) => (
                                  <div key={idx} onClick={() => selectSuggestion(s)} className="p-3 hover:bg-foreground/5 cursor-pointer text-xs text-foreground border-b border-border/50 flex items-center gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-primary" /> {s.name}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                            <LinkIcon className="w-3.5 h-3.5" /> Link de Google Maps (GPS Autogenerado)
                          </Label>
                          <Input value={regMapsUrl} onChange={(e) => handleMapsUrlResolve(e.target.value)} placeholder="https://maps.google.com/..." className="bg-foreground/5 h-12 rounded-xl border-border" />
                          {resolvingLink && <p className="text-[10px] text-primary animate-pulse font-bold">Autodetectando coordenadas mediante resolver...</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Latitud (GPS)</Label>
                            <Input value={regLat} onChange={(e) => setRegLat(e.target.value)} placeholder="Ej: 40.4167" className="bg-foreground/5 h-12 rounded-xl border-border font-mono text-xs" required />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Longitud (GPS)</Label>
                            <Input value={regLng} onChange={(e) => setRegLng(e.target.value)} placeholder="Ej: -3.7037" className="bg-foreground/5 h-12 rounded-xl border-border font-mono text-xs" required />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase">Horarios de Atención</Label>
                            <Input value={regSchedule} onChange={(e) => setRegSchedule(e.target.value)} placeholder="Ej: Lunes a Viernes de 8:00 AM a 10:00 PM" className="bg-foreground/5 h-12 rounded-xl border-border text-xs" />
                          </div>
                        </div>
                      </div>

                      {/* HOTEL INTEGRATION SUB-MODULE */}
                      <div className="space-y-4 md:col-span-2 pt-6 border-t border-border/50">
                        <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                          <Hotel className="w-5 h-5" />
                          <span>Configuración e Integración con Hoteles</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          {/* Toggle: Restaurant inside Hotel */}
                          <div className="bg-foreground/5 border border-border/50 p-4 rounded-2xl flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-bold text-foreground block mb-0.5">¿Está dentro de un hotel?</Label>
                              <span className="text-[10px] text-foreground/55">Habilita vinculación física con el hotel.</span>
                            </div>
                            <Switch checked={isInsideHotel} onCheckedChange={setIsInsideHotel} />
                          </div>

                          {/* Link Existing Hotel dropdown */}
                          {isInsideHotel && (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-muted-foreground">Vincular a Entidad de Hotel</Label>
                              <select value={linkedHotelId} onChange={(e) => setLinkedHotelId(e.target.value)} className="w-full h-12 px-4 rounded-xl bg-foreground/5 border border-border text-foreground outline-none">
                                <option value="" className="bg-neutral-900">Seleccionar Hotel...</option>
                                {hotels.map(h => (
                                  <option key={h.id} value={h.id} className="bg-neutral-900">{h.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Room service settings */}
                          <div className="bg-foreground/5 border border-border/50 p-4 rounded-2xl flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-bold text-foreground block mb-0.5">Habilitar Room Service</Label>
                              <span className="text-[10px] text-foreground/55">Permite a los huéspedes ordenar a la habitación.</span>
                            </div>
                            <Switch checked={roomServiceEnabled} onCheckedChange={setRoomServiceEnabled} />
                          </div>

                          {roomServiceEnabled && (
                            <div className="space-y-2">
                              <Label className="text-xs font-bold text-muted-foreground">Horario del Servicio de Cuartos</Label>
                              <Input value={roomServiceSchedule} onChange={(e) => setRoomServiceSchedule(e.target.value)} placeholder="Ej: 07:00 - 23:00" className="bg-foreground/5 h-12 rounded-xl border-border" />
                            </div>
                          )}

                          {/* Hotel menu support */}
                          <div className="bg-foreground/5 border border-border/50 p-4 rounded-2xl flex items-center justify-between sm:col-span-2">
                            <div>
                              <Label className="text-sm font-bold text-foreground block mb-0.5 font-sans">Sincronizar Menú con Hotel (Hotel Menu Support)</Label>
                              <span className="text-[10px] text-foreground/55">El hotel importará directamente este menú en su app de conserjería.</span>
                            </div>
                            <Switch checked={hotelMenuSupport} onCheckedChange={setHotelMenuSupport} />
                          </div>
                        </div>
                      </div>

                    </div>

                    <div className="flex gap-4 pt-6 border-t border-border/50">
                      {isEditing && (
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={() => {
                            setIsEditing(false);
                            setIsCreatingNew(false);
                          }} 
                          className="flex-1 h-12 rounded-xl text-muted-foreground"
                        >
                          Cancelar
                        </Button>
                      )}
                      <Button 
                        type="submit" 
                        disabled={submitting} 
                        className="flex-[2] h-12 bg-primary text-black font-black hover:bg-primary/95 rounded-xl text-sm tracking-wide"
                      >
                        {submitting ? <Loader2 className="animate-spin text-black" /> : "GUARDAR CONFIGURACIÓN"}
                      </Button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* ══════════════ TAB 3: MENU MANAGEMENT ══════════════ */}
            {tab === "menu" && selectedRest && (
              <motion.div key="menu" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8 max-w-4xl">
                
                <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8 space-y-6 shadow-2xl">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">Carta y Menú Digital</h3>
                    <p className="text-xs text-foreground/55">Configura la carta digital de platos, bebidas y precios. Puedes habilitar disponibilidad inmediata en cocina.</p>
                  </div>

                  {/* FILE UPLOAD SUPPORT (PDF, IMAGE, URL) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-foreground/5 rounded-2xl border border-border/50">
                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-primary uppercase tracking-widest block">Menú en PDF</Label>
                      <div className="flex gap-2">
                        <Input value={menuPdfUrl} onChange={(e) => setMenuPdfUrl(e.target.value)} placeholder="URL del PDF..." className="bg-foreground/5 h-12 rounded-xl border-border" />
                        <label className="h-12 w-12 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-xl flex items-center justify-center cursor-pointer relative shrink-0">
                          <Upload className="w-4 h-4 text-foreground" />
                          <input type="file" accept="application/pdf" onChange={(e) => handleUploadFile(e, "pdf", setMenuPdfUrl)} className="hidden" />
                        </label>
                      </div>
                      {menuPdfUrl && (
                        <a href={menuPdfUrl} target="_blank" rel="noreferrer" className="text-xs text-primary font-bold flex items-center gap-1 hover:underline">
                          Ver PDF <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-primary uppercase tracking-widest block">Carta en Imagen / Foto</Label>
                      <div className="flex gap-2">
                        <Input value={menuImageUrl} onChange={(e) => setMenuImageUrl(e.target.value)} placeholder="URL de la imagen..." className="bg-foreground/5 h-12 rounded-xl border-border" />
                        <label className="h-12 w-12 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-xl flex items-center justify-center cursor-pointer relative shrink-0">
                          <Upload className="w-4 h-4 text-foreground" />
                          <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, "image", setMenuImageUrl)} className="hidden" />
                        </label>
                      </div>
                      {menuImageUrl && (
                        <div className="h-16 w-32 border border-border rounded-lg overflow-hidden mt-1">
                          <img src={menuImageUrl} alt="Carta" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* EDITABLE DIGITAL MENU BUILDER */}
                  <div className="pt-4 border-t border-border/50 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <h4 className="font-bold text-foreground text-base">Constructor de Menú Digital</h4>
                      
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Input 
                          value={categoryNameInput} 
                          onChange={(e) => setCategoryNameInput(e.target.value)} 
                          placeholder="Nueva Categoría..." 
                          className="bg-foreground/5 h-10 rounded-xl border-border text-xs w-full sm:w-48" 
                        />
                        <Button onClick={addMenuCategory} size="sm" className="bg-primary text-black font-extrabold h-10 px-4 rounded-xl text-xs shrink-0">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Categoría
                        </Button>
                      </div>
                    </div>

                    {/* CATEGORIES ACCORDION */}
                    <div className="space-y-4">
                      {menuCategories.length === 0 ? (
                        <p className="text-xs text-foreground/40 text-center py-10 bg-foreground/5 rounded-2xl border border-dashed border-border/50">
                          Crea categorías como "Entradas" o "Postres" para iniciar tu menú digital.
                        </p>
                      ) : (
                        menuCategories.map((cat, catIdx) => (
                          <div key={cat.id || catIdx} className="bg-foreground/5 border border-border/50 rounded-2xl p-6 space-y-4">
                            
                            <div className="flex items-center justify-between border-b border-border/50 pb-3">
                              <span className="font-black text-foreground text-base">{cat.name}</span>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => removeMenuCategory(cat.id)}
                                className="h-8 w-8 p-0 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>

                            {/* Items inside category */}
                            <div className="space-y-3">
                              {cat.items.length === 0 ? (
                                <p className="text-xs text-foreground/30 italic">Sin platos agregados en esta sección</p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {cat.items.map((item: any, itemIdx: number) => (
                                    <div key={item.id || itemIdx} className="bg-muted/30 border border-border/50 rounded-xl p-4 flex items-center justify-between gap-4">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-foreground text-sm truncate">{item.name}</span>
                                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                                            ${item.price.toLocaleString("es-CO")}
                                          </Badge>
                                        </div>
                                        {item.description && (
                                          <p className="text-xs text-muted-foreground truncate mt-1">{item.description}</p>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-3">
                                        {/* Availability toggle */}
                                        <button 
                                          onClick={() => toggleMenuItemAvailability(catIdx, itemIdx)}
                                          className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                                            item.available ? "bg-green-500/20 text-green-400 border border-green-500/25" : "bg-neutral-800 text-neutral-400"
                                          }`}
                                        >
                                          {item.available ? "Disponible" : "Agotado"}
                                        </button>

                                        <button 
                                          onClick={() => deleteMenuItem(catIdx, itemIdx)}
                                          className="text-red-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-500/10"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Add Item form toggle */}
                            {editingCategoryIndex === catIdx ? (
                              <div className="bg-muted/40 border border-border/50 p-4 rounded-xl space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-muted-foreground">Nombre del Plato</Label>
                                    <Input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="Ej: Lasagna de Carne" className="bg-foreground/5 h-10 rounded-lg text-xs" />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-[10px] font-bold text-muted-foreground">Precio ($ COP)</Label>
                                    <Input value={newItemPrice} type="number" onChange={(e) => setNewItemPrice(e.target.value)} placeholder="Ej: 28000" className="bg-foreground/5 h-10 rounded-lg text-xs" />
                                  </div>
                                  <div className="space-y-1 col-span-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground">Ingredientes / Notas</Label>
                                    <Input value={newItemDesc} onChange={(e) => setNewItemDesc(e.target.value)} placeholder="Ej: Receta de la casa con salsa boloñesa..." className="bg-foreground/5 h-10 rounded-lg text-xs" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => addMenuItem(catIdx)} className="bg-primary text-black font-extrabold text-xs h-9 px-4 rounded-lg">
                                    Agregar Plato
                                  </Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingCategoryIndex(null)} className="text-muted-foreground h-9 px-4 text-xs">
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingCategoryIndex(catIdx)}
                                className="h-9 px-4 rounded-xl text-xs font-bold border-border text-muted-foreground hover:bg-foreground/5 flex gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" /> Agregar Plato a {cat.name}
                              </Button>
                            )}

                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-border/50">
                    <Button onClick={handleSaveMenu} className="bg-primary text-black font-extrabold h-12 px-6 rounded-xl text-sm shadow-md">
                      Guardar Carta Digital
                    </Button>
                  </div>
                </div>

              </motion.div>
            )}

            {/* ══════════════ TAB 4: MEDIA GALLERY ══════════════ */}
            {tab === "media" && selectedRest && (
              <motion.div key="media" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8 max-w-4xl">
                
                <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8 space-y-6 shadow-2xl">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">Galería de Medios</h3>
                    <p className="text-xs text-foreground/55">Sube imágenes HD, cover banners, videos de tus platos en acción, o imágenes 360° para visualizaciones inmersivas.</p>
                  </div>

                  {/* COVERS & MAP PREVIEWS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-6 border-b border-border/50">
                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-primary uppercase tracking-widest block">Imagen Cover / Portada</Label>
                      <div className="flex gap-2">
                        <Input value={mediaCoverUrl} onChange={(e) => setMediaCoverUrl(e.target.value)} placeholder="URL de la foto principal..." className="bg-foreground/5 h-12 rounded-xl border-border flex-1" />
                        <label className="h-12 w-12 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-xl flex items-center justify-center cursor-pointer shrink-0">
                          <Upload className="w-4 h-4 text-foreground" />
                          <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, "image", setMediaCoverUrl)} className="hidden" />
                        </label>
                      </div>
                      {mediaCoverUrl && (
                        <div className="h-28 rounded-xl overflow-hidden border border-border mt-1 relative">
                          <img src={mediaCoverUrl} alt="Cover" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs font-bold text-primary uppercase tracking-widest block">Icono / Imagen Mapa (Smart Map Preview)</Label>
                      <div className="flex gap-2">
                        <Input value={mediaMapPreviewUrl} onChange={(e) => setMediaMapPreviewUrl(e.target.value)} placeholder="URL del logo del pin..." className="bg-foreground/5 h-12 rounded-xl border-border flex-1" />
                        <label className="h-12 w-12 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-xl flex items-center justify-center cursor-pointer shrink-0">
                          <Upload className="w-4 h-4 text-foreground" />
                          <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, "image", setMediaMapPreviewUrl)} className="hidden" />
                        </label>
                      </div>
                      {mediaMapPreviewUrl && (
                        <div className="h-28 rounded-xl overflow-hidden border border-border mt-1 flex items-center justify-center bg-muted/40">
                          <img src={mediaMapPreviewUrl} alt="Map Pin Preview" className="h-20 w-20 object-contain rounded-full border border-white/20 bg-black" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GALLERY SUB-SECTIONS (IMAGES, VIDEOS, 360) */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                    
                    {/* Images Column */}
                    <div className="space-y-4">
                      <Label className="text-xs font-bold text-foreground uppercase flex items-center gap-1.5"><ImageIcon className="w-4 h-4 text-blue-400" /> Galería de Fotos</Label>
                      <div className="flex gap-2">
                        <Input value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} placeholder="URL..." className="bg-foreground/5 h-9 text-xs rounded-lg" />
                        <label className="h-9 w-9 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-lg flex items-center justify-center cursor-pointer shrink-0 relative">
                          <Plus className="w-3.5 h-3.5 text-foreground" />
                          <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, "image", (url) => setGalleryImages(prev => [...prev, url]))} className="hidden" />
                        </label>
                      </div>
                      <div className="space-y-2">
                        {galleryImages.map((img, idx) => (
                          <div key={idx} className="h-14 border border-border/50 rounded-lg overflow-hidden flex items-center justify-between p-2 bg-muted/30">
                            <img src={img} alt="" className="h-10 w-10 object-cover rounded-md" />
                            <button onClick={() => setGalleryImages(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Videos Column */}
                    <div className="space-y-4">
                      <Label className="text-xs font-bold text-foreground uppercase flex items-center gap-1.5"><Video className="w-4 h-4 text-green-400" /> Videos Promocionales</Label>
                      <div className="flex gap-2">
                        <Input value={newVideoUrl} onChange={(e) => setNewVideoUrl(e.target.value)} placeholder="URL..." className="bg-foreground/5 h-9 text-xs rounded-lg" />
                        <label className="h-9 w-9 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-lg flex items-center justify-center cursor-pointer shrink-0 relative">
                          <Plus className="w-3.5 h-3.5 text-foreground" />
                          <input type="file" accept="video/*" onChange={(e) => handleUploadFile(e, "video", (url) => setGalleryVideos(prev => [...prev, url]))} className="hidden" />
                        </label>
                      </div>
                      <div className="space-y-2">
                        {galleryVideos.map((vid, idx) => (
                          <div key={idx} className="h-14 border border-border/50 rounded-lg overflow-hidden flex items-center justify-between p-2 bg-muted/30">
                            <span className="text-[10px] text-muted-foreground truncate max-w-[130px] font-mono">{vid.split("/").pop()}</span>
                            <button onClick={() => setGalleryVideos(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 360 Spherical Panoramas Column */}
                    <div className="space-y-4">
                      <Label className="text-xs font-bold text-foreground uppercase flex items-center gap-1.5"><Box className="w-4 h-4 text-purple-400" /> Panoramas VR 360°</Label>
                      <div className="flex gap-2">
                        <Input value={new360Url} onChange={(e) => setNew360Url(e.target.value)} placeholder="URL..." className="bg-foreground/5 h-9 text-xs rounded-lg" />
                        <label className="h-9 w-9 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-lg flex items-center justify-center cursor-pointer shrink-0 relative">
                          <Plus className="w-3.5 h-3.5 text-foreground" />
                          <input type="file" accept="image/*" onChange={(e) => handleUploadFile(e, "image", (url) => setGallery360(prev => [...prev, url]))} className="hidden" />
                        </label>
                      </div>
                      <div className="space-y-2">
                        {gallery360.map((pan, idx) => (
                          <div key={idx} className="h-14 border border-border/50 rounded-lg overflow-hidden flex items-center justify-between p-2 bg-muted/30">
                            <img src={pan} alt="" className="h-10 w-10 object-cover rounded-md" />
                            <button onClick={() => setGallery360(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-500 p-1">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>

                  <div className="flex justify-end pt-6 border-t border-border/50">
                    <Button onClick={handleSaveMediaGallery} className="bg-primary text-black font-extrabold h-12 px-6 rounded-xl text-sm shadow-md">
                      Guardar Archivos Multimedia
                    </Button>
                  </div>
                </div>

              </motion.div>
            )}

            {/* ══════════════ TAB 5: SMART MAPS ══════════════ */}
            {tab === "maps" && selectedRest && (
              <motion.div key="maps" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8 max-w-4xl">
                
                <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8 space-y-6 shadow-2xl">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">Smart Maps & Direccionamiento</h3>
                    <p className="text-xs text-foreground/55">Visualiza cómo se posiciona tu pin en el sistema cartográfico. Habilita redirecciones automáticas y telemetría de navegación.</p>
                  </div>

                  {/* MAP REDIRECTION LINKS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-foreground/5 rounded-2xl border border-border/50">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-foreground">Coordenadas de la sede</Label>
                      <div className="p-3.5 bg-muted/40 rounded-xl font-mono text-xs text-primary border border-border/50">
                        Latitud: {selectedRest.locationLat || "Sin registrar"} <br/>
                        Longitud: {selectedRest.locationLng || "Sin registrar"}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-foreground">Link de Navegación Directa</Label>
                      <div className="flex items-center gap-2">
                        <Input value={selectedRest.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${selectedRest.locationLat},${selectedRest.locationLng}`} disabled className="bg-muted/40 h-11 text-xs text-muted-foreground" />
                        <Button onClick={handleMapPinClickRedirect} className="bg-primary text-black font-extrabold h-11 px-4 rounded-xl flex gap-1.5 text-xs">
                          Navegar <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* MAP PIN PLACEMENT SIMULATOR */}
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-foreground block">Simulador de Posicionamiento Smart Map</Label>
                    <div className="w-full h-80 rounded-2xl border border-border relative overflow-hidden bg-neutral-950 flex items-center justify-center bg-[radial-gradient(#1a1a1a_1px,transparent_1px)] [background-size:16px_16px]">
                      
                      {/* Grid representation */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30 pointer-events-none" />
                      
                      {/* Simulated Pin on Dark Map */}
                      <motion.div 
                        animate={{ y: [0, -10, 0] }} 
                        transition={{ repeat: Infinity, duration: 2.5 }}
                        className="relative z-10 flex flex-col items-center cursor-pointer"
                        onClick={handleMapPinClickRedirect}
                      >
                        {/* Map Tooltip Card */}
                        <div className="mb-2 bg-black/90 border border-primary/40 rounded-xl px-4 py-2 text-center shadow-2xl backdrop-blur-md">
                          <p className="text-xs font-black text-foreground">{selectedRest.name}</p>
                          <p className="text-[9px] text-primary font-bold uppercase mt-0.5 tracking-tighter">Click para navegar</p>
                        </div>

                        {/* Simulated Pin Pinhead */}
                        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.6)] border-2 border-white relative z-10 overflow-hidden">
                          {selectedRest.imageUrl ? (
                            <img src={selectedRest.imageUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Utensils className="w-5 h-5 text-black" />
                          )}
                        </div>

                        {/* Simulated Pin Pointer */}
                        <div className="w-3 h-3 bg-primary rotate-45 -mt-1.5 border-r border-b border-white z-0 shadow-lg" />
                      </motion.div>

                      {/* Map info bar */}
                      <div className="absolute bottom-4 left-4 right-4 bg-muted/85 border border-border px-4 py-3 rounded-xl backdrop-blur flex justify-between items-center z-20">
                        <span className="text-[10px] font-bold text-muted-foreground">SIMULACIÓN DE MAPA EN VIVO</span>
                        <span className="text-[10px] font-bold text-primary font-mono">{selectedRest.locationLat}, {selectedRest.locationLng}</span>
                      </div>
                    </div>
                  </div>

                  {mapsSimulated && (
                    <p className="text-xs text-green-400 font-bold flex items-center gap-1">
                      <Check className="w-4 h-4" /> Telemetría de Smart Maps integrada correctamente en el servidor.
                    </p>
                  )}
                </div>

              </motion.div>
            )}

            {/* ══════════════ TAB 6: ORDERS PANEL ══════════════ */}
            {tab === "orders" && selectedRest && (
              <motion.div key="orders" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                
                {/* Board Column Header Statuses */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  
                  {/* Status 1: Pending */}
                  <div className="bg-card/20 border border-border/50 rounded-3xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/50 pb-3">
                      <span className="font-black text-foreground text-xs uppercase tracking-widest flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-yellow-400" /> Pendientes</span>
                      <Badge className="bg-yellow-400/10 text-yellow-400">{ordersList.filter(o => o.status === "pending").length}</Badge>
                    </div>
                    
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      {ordersList.filter(o => o.status === "pending").map((order) => (
                        <div key={order.id} className="bg-muted/50 border border-border/50 rounded-2xl p-4 space-y-3 hover:border-yellow-400/20 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-black text-foreground truncate max-w-[130px]">{order.travelerUsername}</p>
                              <p className="text-[9px] text-foreground/40">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            {/* Check room service order */}
                            {order.details && order.details.toLowerCase().includes("habitación") && (
                              <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-bold">Room Service</Badge>
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-3 bg-foreground/5 p-2 rounded-lg font-medium">
                            {order.details || "Sin detalles adicionales"}
                          </p>

                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={() => updateOrderStatus(order.id, "preparing")}
                              className="w-full bg-primary text-black font-extrabold h-8 rounded-lg text-[10px]"
                            >
                              Cocinar
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                const msg = encodeURIComponent(`Hola ${order.travelerUsername}, hemos recibido tu pedido del restaurante ${selectedRest.name} y ya lo estamos gestionando.`);
                                window.open(`https://wa.me/${selectedRest.whatsappNumber || ''}?text=${msg}`, '_blank');
                              }}
                              className="h-8 border-border hover:bg-foreground/5 text-[10px]"
                            >
                              WA
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status 2: Preparing */}
                  <div className="bg-card/20 border border-border/50 rounded-3xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/50 pb-3">
                      <span className="font-black text-foreground text-xs uppercase tracking-widest flex items-center gap-1.5"><Utensils className="w-3.5 h-3.5 text-blue-400" /> Cocina (Preparing)</span>
                      <Badge className="bg-blue-400/10 text-blue-400">{ordersList.filter(o => o.status === "preparing").length}</Badge>
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      {ordersList.filter(o => o.status === "preparing").map((order) => (
                        <div key={order.id} className="bg-muted/50 border border-border/50 rounded-2xl p-4 space-y-3 hover:border-blue-400/20 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-black text-foreground truncate max-w-[130px]">{order.travelerUsername}</p>
                              <p className="text-[9px] text-foreground/40">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            {order.details && order.details.toLowerCase().includes("habitación") && (
                              <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-bold">Room Service</Badge>
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-3 bg-foreground/5 p-2 rounded-lg font-medium">
                            {order.details || "Sin detalles adicionales"}
                          </p>

                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={() => updateOrderStatus(order.id, "ready")}
                              className="w-full bg-blue-500 text-foreground font-extrabold h-8 rounded-lg text-[10px]"
                            >
                              Listo
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status 3: Ready */}
                  <div className="bg-card/20 border border-border/50 rounded-3xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/50 pb-3">
                      <span className="font-black text-foreground text-xs uppercase tracking-widest flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-green-400" /> Listo para Entregar</span>
                      <Badge className="bg-green-400/10 text-green-400">{ordersList.filter(o => o.status === "ready").length}</Badge>
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      {ordersList.filter(o => o.status === "ready").map((order) => (
                        <div key={order.id} className="bg-muted/50 border border-border/50 rounded-2xl p-4 space-y-3 hover:border-green-400/20 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-xs font-black text-foreground truncate max-w-[130px]">{order.travelerUsername}</p>
                              <p className="text-[9px] text-foreground/40">{new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            {order.details && order.details.toLowerCase().includes("habitación") && (
                              <Badge className="bg-purple-500/10 text-purple-400 border border-purple-500/20 text-[8px] font-bold">Room Service</Badge>
                            )}
                          </div>
                          
                          <p className="text-xs text-muted-foreground line-clamp-3 bg-foreground/5 p-2 rounded-lg font-medium">
                            {order.details || "Sin detalles adicionales"}
                          </p>

                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={() => updateOrderStatus(order.id, "completed")}
                              className="w-full bg-green-500 text-foreground font-extrabold h-8 rounded-lg text-[10px]"
                            >
                              Entregar / Completar
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Status 4: Completed / History */}
                  <div className="bg-card/20 border border-border/50 rounded-3xl p-5 space-y-4">
                    <div className="flex justify-between items-center border-b border-border/50 pb-3">
                      <span className="font-black text-foreground text-xs uppercase tracking-widest flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-neutral-400" /> Historial Entregados</span>
                      <Badge className="bg-foreground/5 text-muted-foreground">{ordersList.filter(o => o.status === "completed").length}</Badge>
                    </div>

                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                      {ordersList.filter(o => o.status === "completed").map((order) => (
                        <div key={order.id} className="bg-muted/30 border border-border/50 rounded-2xl p-4 space-y-3 opacity-60">
                          <div>
                            <p className="text-xs font-bold text-foreground/80">{order.travelerUsername}</p>
                            <p className="text-[8px] text-foreground/30">{new Date(order.createdAt).toLocaleDateString()} • Completed</p>
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 italic bg-foreground/5 p-2 rounded-lg font-medium">
                            {order.details}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>

              </motion.div>
            )}

            {/* ══════════════ TAB 7: COMMENTS MANAGEMENT ══════════════ */}
            {tab === "comments" && selectedRest && (
              <motion.div key="comments" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-6">
                
                {comments.length === 0 ? (
                  <div className="text-center py-28 bg-card/10 border border-border/50 rounded-[32px]">
                    <MessageSquare className="h-16 w-16 text-foreground/5 mx-auto mb-4" />
                    <p className="text-muted-foreground font-bold">Aún no hay opiniones registradas para esta sede.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {comments.map((comment) => (
                      <div key={comment.id} className={`bg-card/30 backdrop-blur-xl border rounded-[32px] p-6 transition-all duration-300 ${comment.hidden ? "border-red-500/20 opacity-60" : "border-border/50 hover:border-primary/20"}`}>
                        
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center font-black text-sm">
                              {comment.authorUsername.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-extrabold text-foreground text-sm">{comment.authorUsername}</p>
                              <p className="text-[9px] text-foreground/40">{new Date(comment.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {comment.hidden && (
                              <span className="text-[9px] font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">OCULTO</span>
                            )}
                            <div className="flex items-center gap-1 text-primary">
                              <Star className="w-3.5 h-3.5 fill-primary" />
                              <span className="font-black text-xs">{comment.rating || 5}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground italic leading-relaxed mb-6 font-medium">"{comment.content}"</p>

                        {/* RENDER BUSINESS REPLY */}
                        {comment.replyContent ? (
                          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 mb-4 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-primary/5 rounded-full blur-[20px]" />
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1 flex items-center gap-1">
                              <Utensils className="w-3 h-3" /> Respuesta del Negocio
                            </p>
                            <p className="text-xs text-foreground/80 leading-relaxed font-medium">{comment.replyContent}</p>
                            {comment.replyCreatedAt && (
                              <span className="text-[8px] text-foreground/40 mt-1 block">Respondido el {new Date(comment.replyCreatedAt).toLocaleDateString()}</span>
                            )}
                          </div>
                        ) : (
                          /* Business Reply Field */
                          <div className="space-y-2 mb-4">
                            <Label className="text-[10px] font-bold text-primary uppercase tracking-widest block">Responder a reseña</Label>
                            <div className="flex gap-2">
                              <Input 
                                value={replyTextMap[comment.id] || ""} 
                                onChange={(e) => setReplyTextMap(prev => ({ ...prev, [comment.id]: e.target.value }))}
                                placeholder="Escribe tu respuesta comercial..." 
                                className="bg-foreground/5 h-10 text-xs rounded-xl" 
                              />
                              <Button 
                                onClick={() => handleSendCommentReply(comment.id)} 
                                className="bg-primary text-black font-extrabold h-10 px-4 rounded-xl text-xs"
                              >
                                Responder
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Respuestas anidadas de usuarios (solo count en dashboard) */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="text-[10px] text-foreground/40 mb-3">
                            💬 {comment.replies.length} {comment.replies.length === 1 ? 'respuesta de usuario' : 'respuestas de usuarios'}
                          </div>
                        )}

                        <div className="flex justify-end gap-2 pt-4 border-t border-border/50">
                          <button onClick={() => toggleHideComment(comment.id)} className="p-2.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors" title={comment.hidden ? 'Mostrar comentario' : 'Ocultar comentario'}>
                            {comment.hidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button onClick={() => deleteCommentAdmin(comment.id)} className="p-2.5 rounded-lg bg-foreground/5 hover:bg-red-500/10 text-red-400 transition-colors" title="Eliminar permanentemente">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                      </div>
                    ))}
                  </div>
                )}

              </motion.div>
            )}

            {/* ══════════════ TAB 8: IMMERSIVE EXPERIENCE ══════════════ */}
            {tab === "immersive" && selectedRest && (
              <motion.div key="immersive" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8 max-w-4xl">
                
                <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8 space-y-6 shadow-2xl">
                  
                  <div className="flex items-center justify-between border-b border-border/50 pb-4">
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-1">Módulo Experiencia Inmersiva (3D / VR)</h3>
                      <p className="text-xs text-foreground/55">Proporciona experiencias metaverso. Los viajeros podrán visualizar en 3D tus platos o realizar tours virtuales del salón.</p>
                    </div>
                    <Switch checked={vrEnabled} onCheckedChange={setVrEnabled} />
                  </div>

                  {vrEnabled && (
                    <div className="space-y-6 pt-2">
                      <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex justify-between items-center text-xs">
                        <span className="font-bold text-muted-foreground">Tipo de Experiencia Auto-Detectada:</span>
                        <Badge className="bg-primary/20 text-primary font-black uppercase text-[10px]">{detectedVrType}</Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* GLB upload */}
                        <div className="space-y-3 p-4 bg-foreground/5 rounded-2xl border border-border/50">
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5"><Box className="w-4 h-4 text-blue-400" /> Modelo 3D Digital (.GLB / .GLTF)</Label>
                          <div className="flex gap-2">
                            <Input value={vrModelUrlInput} onChange={(e) => setVrModelUrlInput(e.target.value)} placeholder="https://.../plato.glb" className="bg-foreground/5 h-11 text-xs" />
                            <label className="h-11 w-11 bg-foreground/5 border border-border hover:bg-foreground/10 rounded-xl flex items-center justify-center cursor-pointer shrink-0">
                              <Upload className="w-4 h-4 text-foreground" />
                              <input type="file" accept=".glb,.gltf" onChange={(e) => handleUploadFile(e, "3d", setVrModelUrlInput)} className="hidden" />
                            </label>
                          </div>
                          <span className="text-[10px] text-foreground/40 block">Adecuado para platos interactivos 3D WebGL.</span>
                        </div>

                        {/* External VR URL */}
                        <div className="space-y-3 p-4 bg-foreground/5 rounded-2xl border border-border/50 md:col-span-1">
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5"><LinkIcon className="w-4 h-4 text-yellow-400" /> Enlace de Recorrido VR Externo (Matterport, etc.)</Label>
                          <Input value={vrExternalUrlInput} onChange={(e) => setVrExternalUrlInput(e.target.value)} placeholder="https://my.matterport.com/show/?m=..." className="bg-foreground/5 h-11 text-xs" />
                          <span className="text-[10px] text-foreground/40 block">Carga un visualizador externo en iframe.</span>
                        </div>
                      </div>

                      {/* REAL WEBGL VIEWER - React Three Fiber */}
                      <div className="space-y-3">
                        <Label className="text-xs font-bold text-foreground block">Previsualización en Vivo (WebGL / React Three Fiber)</Label>
                        
                        {vrTypeSelection === "model" ? (
                          <div className="w-full h-80 rounded-2xl border border-primary/20 overflow-hidden relative">
                            <VRViewer
                              mode="product"
                              url={vrModelUrlInput}
                              onClose={() => {}}
                            />
                            <div className="absolute top-3 left-3 z-20">
                              <Badge className="bg-primary text-black font-black text-[10px] uppercase">
                                Modelo 3D Activo
                              </Badge>
                            </div>
                          </div>
                        ) : vrTypeSelection === "external" && vrExternalUrlInput ? (
                          <div className="w-full h-80 rounded-2xl border border-yellow-400/20 overflow-hidden relative">
                            <iframe
                              src={vrExternalUrlInput}
                              className="w-full h-full"
                              allowFullScreen
                              title="Tour VR Externo"
                            />
                            <div className="absolute top-3 left-3 z-20">
                              <Badge className="bg-yellow-400 text-black font-black text-[10px] uppercase">Tour VR Externo</Badge>
                            </div>
                          </div>
                        ) : (
                          <div className="w-full h-64 rounded-2xl border border-border relative overflow-hidden bg-neutral-950 flex flex-col items-center justify-center">
                            <div className="absolute inset-0 bg-[radial-gradient(#262626_1px,transparent_1px)] [background-size:24px_24px]" />
                            <div className="relative z-10 flex flex-col items-center text-center p-6 space-y-4">
                              <Box className="w-12 h-12 text-primary animate-spin" style={{ animationDuration: "12s" }} />
                              <div>
                                <p className="text-sm font-black text-foreground">Motor WebGL Listo</p>
                                <p className="text-[10px] text-foreground/55 font-mono max-w-sm mt-1">
                                  Ingresa una URL de modelo .GLB o foto 360° para activar el visor interactivo.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <Button
                          size="sm"
                          onClick={simulateVrEngagement}
                          className="bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 text-xs font-bold px-4 h-9 rounded-xl"
                        >
                          Registrar Visualización VR en Analítica
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-6 border-t border-border/50">
                    <Button onClick={handleSaveVRConfig} className="bg-primary text-black font-extrabold h-12 px-6 rounded-xl text-sm shadow-md">
                      Guardar Configuración 3D
                    </Button>
                  </div>
                </div>

              </motion.div>
            )}

            {/* ══════════════ TAB 9: HOTEL INTEGRATION ══════════════ */}
            {tab === "roomservice" && selectedRest && (
              <motion.div key="roomservice" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -15 }} className="space-y-8">
                
                {links.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                      <Hotel className="w-5 h-5 text-purple-400" /> Hoteles Vinculados Activos
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {links.map((link) => (
                        <div key={link.id} className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[24px] p-6 flex items-center justify-between">
                          <div>
                            <p className="font-extrabold text-foreground text-sm">Hotel: @{link.hotelUsername}</p>
                            <p className="text-[10px] text-muted-foreground">Vinculado el {new Date(link.createdAt).toLocaleDateString()}</p>
                          </div>
                          <Badge className={`border-none font-bold text-[9px] uppercase px-3 py-1 ${
                            link.status === "approved" ? "bg-green-500/10 text-green-400" :
                            link.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-yellow-500/10 text-yellow-400"
                          }`}>
                            {link.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-card/30 backdrop-blur-xl border border-border/50 rounded-[32px] p-8 space-y-6">
                  <div>
                    <h3 className="text-xl font-bold text-foreground mb-1">Expandir Red de Hoteles</h3>
                    <p className="text-xs text-foreground/55 font-medium">Solicita enlaces de room service con hoteles en la zona. Aparecerás en su menú digital integrado.</p>
                  </div>

                  {hotels.length === 0 ? (
                    <p className="text-xs text-foreground/45 py-10 text-center">Buscando hoteles aptos en el sistema...</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {hotels.map((hotel) => {
                        const linked = links.some(l => l.hotelServiceId === hotel.id);
                        return (
                          <div key={hotel.id} className="bg-black/35 border border-border/50 rounded-[24px] p-6 space-y-4 group hover:border-primary/20 transition-all duration-300">
                            <div className="h-28 rounded-xl overflow-hidden bg-neutral-900 border border-border flex items-center justify-center relative">
                              {hotel.imageUrl ? (
                                <img src={hotel.imageUrl} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Hotel className="w-10 h-10 text-foreground/20" />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                              <div className="absolute bottom-3 left-3">
                                <p className="text-xs font-black text-foreground">{hotel.name}</p>
                                <p className="text-[9px] text-foreground/55">@{hotel.providerUsername}</p>
                              </div>
                            </div>

                            <Button
                              disabled={linked}
                              onClick={() => sendRoomServiceRequest(hotel.id, hotel.providerUsername)}
                              className={`w-full h-10 rounded-xl text-xs font-bold uppercase ${
                                linked ? "bg-foreground/5 text-foreground/40 cursor-not-allowed" : "bg-primary text-black hover:bg-primary/90"
                              }`}
                            >
                              {linked ? "Vinculación Solicitada" : "Enviar Solicitud"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        )}

      </main>
      </div>
    </div>
  );
}
