import { Link, useLocation } from "wouter";
import { useAuth, UserRole } from "@/lib/auth";
import { LogOut, User, Settings, Package, Building2, Utensils, TentTree, Car, Clock, Languages, Globe, Compass, Sun, Moon, LayoutDashboard, Shield, Check, Bell } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
// Logos sin fondo, recortados al arte visible (para el Navbar)
import logoPrincipal from "../assets/brand-mark-principal.png";
import logoOcean   from "../assets/brand-mark-ocean.png";
import logoForest  from "../assets/brand-mark-forest.png";
import logoSunset  from "../assets/brand-mark-sunset.png";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import GlassCanvas from "@/components/ui/GlassCanvas";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

export default function Navbar() {
  const { t, i18n } = useTranslation();
  const { user, logout, switchActiveRole } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { toast } = useToast();

  const userRoles: UserRole[] = user?.roles?.length ? user.roles : user ? [user.role] : [];

  const handleRoleSwitch = async (nextRole: UserRole) => {
    if (!user || nextRole === user.role) return;
    const result = await switchActiveRole(nextRole);
    if (result.ok) {
      toast({ title: "Rol cambiado", description: `Ahora estás usando VIANova como ${getRoleLabel(nextRole)}.` });
      setLocation("/dashboard");
    } else {
      toast({ title: "No se pudo cambiar el rol", description: result.message, variant: "destructive" });
    }
  };

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
      case 'admin': return <Shield className="h-4 w-4 text-red-400" />;
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
      case 'admin': return t('navbar.role_admin', 'Administrador');
      default: return t('navbar.role_traveler');
    }
  };

  const isProvider = user?.role && user.role !== 'traveler' && user.role !== 'admin';

  return (
    <motion.nav 
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 20 }}
      className="glass-nav lg-surface lg-surface--nav sticky top-0 z-50 w-full"
    >
      <GlassCanvas variant="nav" />
      <div className="container mx-auto flex h-20 items-center justify-between gap-3 px-4 sm:px-6 lg:h-24">
        <div className="flex min-w-0 items-center gap-2">
          <button
            onClick={() => setLocation("/")}
            className="group flex min-w-0 items-center gap-2.5 font-heading text-xl font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-2xl"
            aria-label="VIANova, ir al inicio"
          >
            <motion.div
              whileHover={{ scale: 1.06, rotate: 3 }}
              transition={{ duration: 0.25 }}
              className="flex shrink-0 items-center justify-center"
            >
              <img
                src={logoSrc}
                alt=""
                width={56}
                height={56}
                className="h-11 w-11 object-contain drop-shadow-md sm:h-12 sm:w-12 lg:h-14 lg:w-14"
              />
            </motion.div>
            <span className="min-w-0 truncate text-foreground notranslate"><span className="text-primary-ink">VIA</span>Nova</span>
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:gap-3">
            <div className="hidden items-center gap-1 lg:flex">
              <button
                onClick={() => setLocation("/explore")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                  location === "/explore"
                    ? "border-primary/40 bg-primary/10 text-primary-ink"
                    : "border-transparent text-muted-foreground hover:bg-primary/5 hover:text-primary-ink"
                }`}
              >
                <Compass className="h-3.5 w-3.5" /> {t("navbar.explore")}
              </button>
              <button
                onClick={() => setLocation("/social")}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                  location === "/social"
                    ? "border-primary/40 bg-primary/10 text-primary-ink"
                    : "border-transparent text-muted-foreground hover:bg-primary/5 hover:text-primary-ink"
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> {t("navbar.social")}
              </button>
              {user && (
                <button
                  onClick={() => setLocation("/dashboard")}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                    location === "/dashboard"
                      ? "border-primary/40 bg-primary/10 text-primary-ink"
                      : "border-transparent text-muted-foreground hover:bg-primary/5 hover:text-primary-ink"
                  }`}
                >
                  <LayoutDashboard className="h-3.5 w-3.5" /> {t("navbar.dashboard", "Mi Panel")}
                </button>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full sm:h-10 sm:w-10" aria-label={t('navbar.change_language')}>
                  <Languages className="h-5 w-5" />
                  <span className="sr-only">{t('navbar.change_language')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{t('navbar.language')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  { id: 'es', label: 'Español' },
                  { id: 'en', label: 'English' },
                  { id: 'fr', label: 'Français' },
                  { id: 'pt', label: 'Português' },
                  { id: 'zh', label: '中文' },
                ].map((language) => (
                  <DropdownMenuItem
                    key={language.id}
                    onClick={() => changeLanguage(language.id)}
                    className="cursor-pointer gap-2"
                  >
                    <span className="flex-1">{language.label}</span>
                    {i18n.language === language.id && <Check className="h-4 w-4 text-primary-ink" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full sm:h-10 sm:w-10" aria-label={t('navbar.change_theme')}>
                  <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">{t('navbar.change_theme')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{t('navbar.appearance')}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {[
                  { id: 'light', label: t('navbar.light'), icon: <Sun className="h-4 w-4" /> },
                  { id: 'dark', label: t('navbar.dark'), icon: <Moon className="h-4 w-4" /> },
                  { id: 'sunset', label: 'Sunset', icon: <span className="h-4 w-4 rounded-full bg-orange-400" /> },
                  { id: 'ocean', label: 'Ocean', icon: <span className="h-4 w-4 rounded-full bg-sky-400" /> },
                  { id: 'forest', label: 'Forest', icon: <span className="h-4 w-4 rounded-full bg-emerald-400" /> },
                ].map((option) => (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => setTheme(option.id)}
                    className="cursor-pointer gap-2"
                  >
                    {option.icon}
                    <span className="flex-1">{option.label}</span>
                    {theme === option.id && <Check className="h-4 w-4 text-primary-ink" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

          {user ? (
            <div className="flex items-center gap-1.5 sm:gap-3">
              {isProvider && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative h-9 w-9 rounded-full sm:h-10 sm:w-10"
                  onClick={() => setLocation("/notifications")}
                  aria-label={t('navbar.notifications', 'Notificaciones')}
                >
                  {unreadCount > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  <Bell className="h-5 w-5" />
                </Button>
              )}
              <div className="hidden flex-col items-end md:flex">
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
                  <Button id="navbar-user-menu-btn" data-testid="navbar-user-menu-btn" variant="ghost" size="icon" className="h-9 w-9 overflow-hidden rounded-full border border-border/50 bg-secondary/50 hover:bg-secondary hover:text-primary-ink sm:h-10 sm:w-10">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="h-5 w-5" />
                    )}
                    <span className="sr-only">{t('navbar.account', 'Cuenta')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col">
                      <span>{user.name || user.username}</span>
                      <span className="text-xs font-normal text-muted-foreground capitalize">{getRoleLabel(user.role)}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border" />
                  
                  <DropdownMenuItem onClick={() => setLocation("/dashboard")} className="cursor-pointer gap-2">
                    <LayoutDashboard className="h-4 w-4 text-primary-ink" />
                    {t('navbar.dashboard', 'Mi Panel')}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/profile")} className="cursor-pointer gap-2">
                    <User className="h-4 w-4 text-primary-ink" />
                    Mi Perfil
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/settings")} className="cursor-pointer gap-2">
                    <Settings className="h-4 w-4" />
                    {t('navbar.settings', 'Configuración de Cuenta')}
                  </DropdownMenuItem>

                  {user.role === 'admin' && (
                    <DropdownMenuItem onClick={() => setLocation("/admin")} className="cursor-pointer gap-2">
                      <Shield className="h-4 w-4 text-red-400" />
                      {t('navbar.admin', 'Administración')}
                    </DropdownMenuItem>
                  )}

                  {userRoles.length > 1 && (
                    <>
                      <DropdownMenuSeparator className="bg-border" />
                      <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {t('navbar.switch_role', 'Cambiar rol activo')}
                      </DropdownMenuLabel>
                      {userRoles.map((roleOption) => (
                        <DropdownMenuItem
                          key={roleOption}
                          onClick={() => handleRoleSwitch(roleOption)}
                          className={`cursor-pointer gap-2 ${roleOption === user.role ? "bg-primary/10 text-primary-ink" : ""}`}
                        >
                          {getRoleIcon(roleOption)}
                          <span className="flex-1">{getRoleLabel(roleOption)}</span>
                          {roleOption === user.role && <Check className="h-3.5 w-3.5" />}
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}

                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={() => setLocation("/explore")} className="cursor-pointer gap-2">
                    <Compass className="h-4 w-4 text-primary-ink" />
                    {t('navbar.explore')}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/social")} className="cursor-pointer gap-2">
                    <Globe className="h-4 w-4 text-primary-ink" />
                    ViaSocial
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/ride-history")} className="cursor-pointer gap-2">
                    <Clock className="h-4 w-4 text-primary-ink" />
                    {t('navbar.history', 'Historial de Viajes')}
                  </DropdownMenuItem>
                  
                  {isProvider && (
                    <DropdownMenuItem onClick={() => setLocation("/products")} className="cursor-pointer gap-2">
                      <Package className="h-4 w-4 text-primary-ink" />
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
                  <DropdownMenuItem id="navbar-logout-btn" data-testid="navbar-logout-btn" onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2">
                    <LogOut className="h-4 w-4" />
                    {t('navbar.logout', 'Cerrar Sesión')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link href="/login">
              <Button className="h-9 rounded-full bg-primary px-3 text-xs text-primary-foreground hover:bg-primary/90 sm:h-10 sm:px-4 sm:text-sm">
                {t('navbar.login', 'Iniciar Sesión')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
