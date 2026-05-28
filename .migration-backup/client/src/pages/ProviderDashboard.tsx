import { apiBase } from "@/lib/queryClient";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Car, Utensils, TentTree, Save, MapPin, Image as ImageIcon, Camera, Languages, Calendar as CalendarIcon, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProviderCalendar from "@/components/ProviderCalendar";

export default function ProviderDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  const [name, setName] = useState<string>(user?.role === 'taxi' ? 'Juan Pérez - Taxi Rápido' : 'Mi Negocio');
  const [description, setDescription] = useState<string>(user?.role === 'taxi' ? 'Servicio de transporte seguro y confiable. Disponible 24/7.' : 'Ofrecemos la mejor experiencia para nuestros clientes...');
  const [contact, setContact] = useState<string>("+34 600 000 000");
  const [locationText, setLocationText] = useState<string>('Madrid, Centro');
  const [locationLat, setLocationLat] = useState<string>('40.416775');
  const [locationLng, setLocationLng] = useState<string>('-3.703790');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [rating, setRating] = useState<number>(5);
  const [services, setServices] = useState<any[]>([]);

  const categoryFromRole = (role?: string) => {
    switch (role) {
      case 'hotel': return 'hotel';
      case 'restaurant': return 'restaurant';
      case 'recreation': return 'recreation';
      case 'taxi': return 'transport';
      case 'translator': return 'otros';
      default: return 'recreation';
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!user?.username) return;
      try {
        const res = await fetch(`${apiBase}/api/services/provider/${encodeURIComponent(user.username)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'No se pudieron cargar tus servicios');
        setServices(data.services || []);
      } catch (e: any) {
        toast({ title: 'Error', description: e.message || 'No se pudieron cargar tus servicios', variant: 'destructive' });
      }
    };
    load();
  }, [user?.username, toast]);

  if (!isAuthenticated || user?.role === 'traveler') {
    setLocation("/");
    return null;
  }

  const getRoleIcon = () => {
    switch (user?.role) {
      case 'hotel': return <Building2 className="h-6 w-6 text-purple-400" />;
      case 'restaurant': return <Utensils className="h-6 w-6 text-orange-400" />;
      case 'recreation': return <TentTree className="h-6 w-6 text-green-400" />;
      case 'taxi': return <Car className="h-6 w-6 text-yellow-400" />;
      case 'translator': return <Languages className="h-6 w-6 text-teal-400" />;
      default: return null;
    }
  };

  const getRoleTitle = () => {
    switch (user?.role) {
      case 'hotel': return 'Gestión del Hotel';
      case 'restaurant': return 'Gestión del Restaurante';
      case 'recreation': return 'Gestión de Sitio Recreativo';
      case 'taxi': return 'Perfil de Conductor';
      case 'translator': return 'Panel de Traductor';
      default: return 'Panel de Control';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!user?.username) throw new Error('Usuario no autenticado');
      if (services.some(s => s.name.trim().toLowerCase() === name.trim().toLowerCase())) {
        toast({ title: 'Publicación Duplicada', description: 'Ya tienes un servicio publicado con este mismo nombre.', variant: 'destructive' });
        return;
      }
      const body = {
        providerUsername: user.username,
        category: categoryFromRole(user.role),
        name,
        description,
        imageUrl,
        locationLat,
        locationLng,
        rating,
      };
      const res = await fetch(apiBase + '/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || 'No se pudo guardar el servicio');
      toast({ title: 'Servicio publicado', description: 'Tu servicio ahora es visible en ViaNova IA.' });
      setServices(prev => [data.service, ...prev]);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'No se pudo guardar el servicio', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden font-sans text-foreground">
      <Navbar />
      
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-secondary/30 rounded-full blur-[150px] translate-x-1/3 translate-y-1/3 pointer-events-none" />

      <motion.main 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="container mx-auto px-4 py-12 max-w-5xl relative z-10"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-12 bg-card/60 backdrop-blur-3xl border border-white/10 p-8 rounded-[2rem] shadow-2xl">
          <div className="flex items-center gap-5">
            <div className="p-4 bg-gradient-to-br from-secondary/80 to-background rounded-2xl shadow-inner border border-white/5 relative overflow-hidden group">
              <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 scale-125">{getRoleIcon()}</div>
            </div>
            <div>
              <h1 className="text-4xl font-heading font-extrabold tracking-tight text-white mb-1 drop-shadow-md">
                {getRoleTitle()}
              </h1>
              <p className="text-lg text-white/60 font-medium">Administra tu presencia en ViaNova IA</p>
            </div>
          </div>
          <Button onClick={handleSave} className="h-14 px-8 rounded-xl bg-primary text-black font-bold shadow-[0_0_20px_rgba(255,215,0,0.3)] hover:shadow-[0_0_30px_rgba(255,215,0,0.5)] transition-all flex gap-3 text-lg items-center">
            <Save className="h-5 w-5" /> Guardar y Publicar
          </Button>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8 bg-black/40 border border-white/10 p-1 rounded-xl">
            <TabsTrigger value="profile" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-black text-white/70">
              <Settings className="w-4 h-4 mr-2" /> Mi Negocio
            </TabsTrigger>
            <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-primary data-[state=active]:text-black text-white/70">
              <CalendarIcon className="w-4 h-4 mr-2" /> Disponibilidad
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-0">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Profile Info Form */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="md:col-span-2"
              >
                <Card className="border-white/10 bg-card/50 backdrop-blur-2xl shadow-2xl rounded-[2rem] overflow-hidden">
                  <CardHeader className="bg-gradient-to-b from-secondary/30 to-transparent pb-8 pt-8 px-8 border-b border-white/5">
                    <CardTitle className="text-2xl font-bold flex items-center gap-3">
                      <Building2 className="text-primary w-6 h-6" /> Información del Servicio
                    </CardTitle>
                    <CardDescription className="text-base text-white/50">
                      Configura cómo verán los viajeros tu negocio en el mapa y en el buscador con IA.
                    </CardDescription>
                  </CardHeader>
                  <form onSubmit={handleSave}>
                    <CardContent className="space-y-6 p-8">
                      {/* Image Upload Banner */}
                      <div className="w-full relative rounded-2xl overflow-hidden bg-secondary/30 border-2 border-dashed border-white/10 group h-48 sm:h-64 flex flex-col items-center justify-center transition-all hover:border-primary/50 cursor-pointer"
                           onClick={() => {
                             const input = document.createElement('input');
                             input.type = 'file';
                             input.accept = 'image/*';
                             input.onchange = async () => {
                               if (!input.files || input.files.length === 0) return;
                               const file = input.files[0];
                               const reader = new FileReader();
                               reader.onload = (ev) => {
                                 setImageUrl(ev.target?.result as string);
                                 toast({ title: '¡Imagen adjuntada!', description: 'Se guardará en la base de datos al publicar.' });
                               };
                               reader.readAsDataURL(file);
                             };
                             input.click();
                           }}
                      >
                        {imageUrl ? (
                          <>
                            <img src={imageUrl} alt="preview" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                            <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors" />
                            <div className="relative z-10 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center text-white">
                               <Camera className="w-10 h-10 mb-2" />
                               <span className="font-semibold px-4 py-2 bg-black/50 rounded-full backdrop-blur">Cambiar Imagen</span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-3 text-muted-foreground group-hover:text-white transition-colors">
                            <div className="p-4 bg-background/50 rounded-full shadow-inner ring-1 ring-white/5">
                              <ImageIcon className="h-8 w-8" />
                            </div>
                            <span className="font-medium text-lg">Subir Foto Principal</span>
                            <span className="text-xs opacity-60 bg-black/20 px-3 py-1 rounded-full">Formatos recomendados: HD, 16:9, JPG/PNG</span>
                          </div>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 gap-6 mt-6">
                        <div className="grid gap-2 col-span-2">
                          <Label htmlFor="name" className="text-white/80 font-semibold tracking-wide text-sm uppercase">Nombre del Servicio</Label>
                          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="bg-background/50 h-14 rounded-xl border-white/10 text-lg focus:ring-primary/50 transition-all font-medium" />
                        </div>
                        
                        <div className="grid gap-2 col-span-2">
                          <Label htmlFor="description" className="text-white/80 font-semibold tracking-wide text-sm uppercase">Descripción Atractiva</Label>
                          <Textarea 
                            id="description" 
                            className="min-h-[140px] bg-background/50 rounded-xl border-white/10 text-base focus:ring-primary/50 transition-all resize-none p-4" 
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe qué hace único a tu servicio..."
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="contact" className="text-white/80 font-semibold tracking-wide text-sm uppercase">Teléfono / WhatsApp</Label>
                          <Input id="contact" type="tel" value={contact} onChange={(e) => setContact(e.target.value)} className="bg-background/50 h-14 rounded-xl border-white/10" />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="location" className="text-white/80 font-semibold tracking-wide text-sm uppercase">Dirección Física</Label>
                          <div className="relative">
                            <Input id="location" value={locationText} onChange={(e) => setLocationText(e.target.value)} className="pl-12 bg-background/50 h-14 rounded-xl border-white/10 text-base" />
                            <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                          </div>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="lat" className="text-white/80 font-semibold tracking-wide text-sm uppercase">Latitud (GPS)</Label>
                          <Input id="lat" value={locationLat} onChange={(e) => setLocationLat(e.target.value)} className="bg-background/50 h-12 rounded-xl border-white/10 font-mono text-sm" />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="lng" className="text-white/80 font-semibold tracking-wide text-sm uppercase">Longitud (GPS)</Label>
                          <Input id="lng" value={locationLng} onChange={(e) => setLocationLng(e.target.value)} className="bg-background/50 h-12 rounded-xl border-white/10 font-mono text-sm" />
                        </div>
                      </div>
                    </CardContent>
                  </form>
                </Card>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col gap-6"
              >
                {/* Stats / Extra Info */}
                <Card className="border-white/10 bg-card/40 backdrop-blur-2xl rounded-[2rem] shadow-xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-success/5 to-transparent border-b border-white/5 pb-4">
                    <CardTitle className="text-xl">Estado de la Cuenta</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4 mb-4 bg-background/50 p-4 rounded-xl border border-white/5">
                      <div className="relative flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]"></span>
                      </div>
                      <span className="text-base font-semibold tracking-wide">Perfil Verificado y Activo</span>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed font-light">
                      Apareces en búsquedas de IA y mapas de viajeros en la categoría 
                      <strong className="text-primary capitalize bg-primary/10 px-2 py-0.5 rounded ml-1"> {user?.role}</strong>.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-card/40 backdrop-blur-2xl rounded-[2rem] shadow-xl">
                   <CardHeader className="border-b border-white/5 pb-4">
                     <CardTitle className="text-xl">Métricas de Alto Impacto</CardTitle>
                   </CardHeader>
                   <CardContent className="space-y-5 pt-6">
                     <div className="flex justify-between items-center bg-background/30 p-4 rounded-xl">
                       <span className="text-sm font-medium text-white/70">Vistas de Perfil (Mes)</span>
                       <span className="font-extrabold text-2xl text-white">1,234</span>
                     </div>
                     <div className="flex justify-between items-center bg-background/30 p-4 rounded-xl">
                       <span className="text-sm font-medium text-white/70">Contactos generados</span>
                       <span className="font-extrabold text-2xl text-primary">45</span>
                     </div>
                   </CardContent>
                </Card>
              </motion.div>

              {/* Services List */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="md:col-span-2 mt-4"
              >
                <Card className="border-white/10 bg-card/40 backdrop-blur-3xl rounded-[2rem] shadow-2xl overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b border-white/5">
                    <CardTitle className="text-2xl font-bold flex gap-2 items-center">
                       <Save className="w-5 h-5 text-primary" /> Historial de Publicaciones
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-8">
                    {services.length === 0 ? (
                      <div className="text-base text-white/50 text-center py-12 bg-background/30 rounded-2xl border border-dashed border-white/10">
                        Aún no publicas tu vitrina al mundo. Completa el formulario y guárdalo.
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {services.map((s) => (
                          <div key={s.id} className="flex items-center justify-between rounded-2xl border border-white/10 p-4 bg-background/60 hover:bg-background/80 transition-all hover:border-primary/50 group">
                            <div className="flex items-center gap-4">
                              {s.imageUrl ? (
                                <img src={s.imageUrl} alt={s.name} className="h-16 w-16 rounded-xl object-cover border border-white/5 shadow-md group-hover:scale-110 transition-transform" />
                              ) : (
                                <div className="h-16 w-16 rounded-xl bg-secondary flex items-center justify-center border border-white/10">
                                   <ImageIcon className="w-6 h-6 text-white/30" />
                                </div>
                              )}
                              <div>
                                <div className="font-bold text-lg text-white group-hover:text-primary transition-colors">{s.name}</div>
                                <div className="text-sm font-medium text-primary mt-0.5">{s.category} • {s.rating || '-'} ★</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </TabsContent>

          <TabsContent value="calendar" className="mt-0">
            <ProviderCalendar services={services} />
          </TabsContent>
        </Tabs>
      </motion.main>
    </div>
  );
}
