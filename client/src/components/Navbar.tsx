import { Link, useLocation } from "wouter";
import { useAuth, UserRole } from "@/lib/auth";
import { LogOut, User, Settings, Package, Building2, Utensils, TentTree, Car, Clock, Languages, Globe, Compass, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
// Logos sin fondo (para el Navbar)
import logoPrincipal from "../assets/Logo_principal-removebg-preview.png";
import logoOcean   from "../assets/Logo_ocean-removebg-preview.png";
import logoForest  from "../assets/Logo_forest-removebg-preview.png";
import logoSunset  from "../assets/Logo_sunset-Photoroom.png";

// Logos con fondo (para el favicon de la pestaña)
import iconDefault from "../assets/Logo_principal.jpeg";
import iconOcean   from "../assets/Logo_ocean.jpeg";
import iconForest  from "../assets/Logo_forest.jpeg";
import iconSunset  from "../assets/Logo_sunset.jpeg";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, setTheme, resolvedTheme } = useTheme();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // Seleccionar logo según el tema activo
  const themeKey = theme === 'system' ? resolvedTheme : theme;
  
  // Logo sin fondo (Navbar)
  const logoSrc = (() => {
    switch (themeKey) {
      case 'ocean':   return logoOcean;
      case 'forest':  return logoForest;
      case 'sunset':  return logoSunset;
      default:        return logoPrincipal; // light, dark, system, etc.
    }
  })();

  // Logo con fondo (Favicon)
  const iconSrc = (() => {
    switch (themeKey) {
      case 'ocean':   return iconOcean;
      case 'forest':  return iconForest;
      case 'sunset':  return iconSunset;
      default:        return iconDefault; // light, dark, system
    }
  })();

  // Actualizar favicon dinámicamente cuando cambie el tema (usando imagen con fondo y ampliándola)
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>("link[rel='icon']") ||
      Object.assign(document.createElement('link'), { rel: 'icon', type: 'image/jpeg' });
    
    // Usamos un canvas para "hacer zoom" en la imagen y quitarle los bordes blancos
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Factor de zoom (mayor número = más grande se ve el logo)
        const zoom = 1.9; 
        const w = img.width;
        const h = img.height;
        // Calcular el área a recortar del centro
        const cropW = w / zoom;
        const cropH = h / zoom;
        const cropX = (w - cropW) / 2;
        const cropY = (h - cropH) / 2;
        
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, 64, 64);
        link.href = canvas.toDataURL('image/jpeg');
        document.head.appendChild(link);
      }
    };
    img.src = iconSrc;
  }, [iconSrc]);

  const { data: notifications = [] } = useQuery({
    queryKey: [user?.username ? `/api/notifications?username=${encodeURIComponent(user.username)}` : null],
    enabled: !!user && user.role !== "traveler",
  });

  const unreadCount = Array.isArray(notifications) ? notifications.filter((n: any) => n.isRead !== "true").length : 0;

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'hotel': return <Building2 className="h-4 w-4 text-purple-400" />;
      case 'restaurant': return <Utensils className="h-4 w-4 text-orange-400" />;
      case 'recreation': return <TentTree className="h-4 w-4 text-green-400" />;
      case 'taxi': return <Car className="h-4 w-4 text-yellow-400" />;
      case 'translator': return <Languages className="h-4 w-4 text-teal-400" />;
      default: return <User className="h-4 w-4 text-blue-400" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'hotel': return t('navbar.role_hotel');
      case 'restaurant': return t('navbar.role_restaurant');
      case 'recreation': return t('navbar.role_recreation');
      case 'taxi': return t('navbar.role_taxi');
      case 'translator': return t('navbar.role_translator');
      default: return t('navbar.role_traveler');
    }
  };

  const isProvider = user?.role && user.role !== 'traveler';

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl shadow-md"
    >
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => setLocation("/")} className="flex items-center gap-2 font-heading text-xl font-bold text-foreground group focus:outline-none">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ duration: 0.25 }}
              className="flex items-center justify-center -ml-2"
            >
              <img
                src={logoSrc}
                alt="VIANova"
                className="w-14 h-14 object-contain drop-shadow-md scale-125"
              />
            </motion.div>
            <span className="text-foreground notranslate"><span className="text-primary">VIA</span>Nova</span>
          </button>
        </div>

        <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2">
              <button
                onClick={() => setLocation("/explore")}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all ${
                  location === "/explore"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Compass className="h-3.5 w-3.5" /> {t("navbar.explore")}
              </button>
              <button
                onClick={() => setLocation("/social")}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all ${
                  location === "/social"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> {t("navbar.social")}
              </button>
            </div>
            
            {user && (
              <button
                onClick={() => setLocation("/social")}
                className={`md:hidden flex items-center justify-center p-2 rounded-full border transition-all ${
                  location === "/social"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-primary/5 bg-secondary/30"
                }`}
                title="ViaSocial"
              >
                <Globe className="h-5 w-5" />
              </button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Languages className="h-5 w-5" />
                  <span className="sr-only">{t('navbar.change_language')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuLabel>{t('navbar.language')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => changeLanguage('es')} className="cursor-pointer gap-2">
                  Español {i18n.language === 'es' && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('en')} className="cursor-pointer gap-2">
                  English {i18n.language === 'en' && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('fr')} className="cursor-pointer gap-2">
                  Français {i18n.language === 'fr' && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('pt')} className="cursor-pointer gap-2">
                  Português {i18n.language === 'pt' && "✓"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('zh')} className="cursor-pointer gap-2">
                  中文 {i18n.language === 'zh' && "✓"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">{t('navbar.change_theme')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuLabel>{t('navbar.appearance')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer gap-2">
                  <Sun className="h-4 w-4" /> {t('navbar.light')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer gap-2">
                  <Moon className="h-4 w-4" /> {t('navbar.dark')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('sunset')} className="cursor-pointer gap-2">
                  <span className="w-4 h-4 rounded-full bg-orange-400" /> Sunset
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('ocean')} className="cursor-pointer gap-2">
                  <span className="w-4 h-4 rounded-full bg-blue-400" /> Ocean
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('forest')} className="cursor-pointer gap-2">
                  <span className="w-4 h-4 rounded-full bg-green-400" /> Forest
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

          {user ? (
            <div className="flex items-center gap-4">
              {isProvider && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-full relative"
                  onClick={() => setLocation("/notifications")}
                >
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                </Button>
              )}
              <div className="hidden md:flex flex-col items-end">
                <span className="text-sm font-medium text-foreground">
                  {user.name || user.username}
                </span>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {getRoleIcon(user.role)}
                  <span>{getRoleLabel(user.role)}</span>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full border border-border/50 bg-secondary/50 hover:bg-secondary hover:text-primary">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-card border-border w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user.name || user.username}</span>
                      <span className="text-xs font-normal text-muted-foreground capitalize">{getRoleLabel(user.role)}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  
                  <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer gap-2">
                    <Settings className="h-4 w-4" />
                    {t('navbar.settings', 'Configuración de Cuenta')}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/social")} className="cursor-pointer gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    ViaSocial
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/ride-history")} className="cursor-pointer gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    {t('navbar.history', 'Historial de Viajes')}
                  </DropdownMenuItem>
                  
                  {isProvider && (
                    <DropdownMenuItem onClick={() => setLocation("/products")} className="cursor-pointer gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      {t('navbar.products', 'Mis Productos')}
                    </DropdownMenuItem>
                  )}

                  {user.role === 'taxi' && (
                    <DropdownMenuItem onClick={() => setLocation("/taxi-dashboard")} className="cursor-pointer gap-2">
                      <Car className="h-4 w-4 text-yellow-400" />
                      {t('navbar.taxi_panel', 'Panel de Taxista')}
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2">
                    <LogOut className="h-4 w-4" />
                    {t('navbar.logout', 'Cerrar Sesión')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link href="/login">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">{t('navbar.login', 'Iniciar Sesión')}</Button>
            </Link>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
