import { Link, useLocation } from "wouter";
import { useAuth, UserRole } from "@/lib/auth";
import { LogOut, User, Settings, Package, Building2, Utensils, TentTree, Car, Clock, Languages, Globe, Compass, Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";
import logoImg from "../assets/logo.jpeg";
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
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();

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
      case 'hotel': return 'Hotel';
      case 'restaurant': return 'Restaurante';
      case 'recreation': return 'Recreación';
      case 'taxi': return 'Taxista';
      case 'translator': return 'Traductor';
      default: return 'Viajero';
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
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.3 }}
              className="rounded-lg overflow-hidden"
            >
              <img src={logoImg} alt="VIANova" className="w-8 h-8 object-cover" />
            </motion.div>
            <span className="text-white"><span className="text-primary">VIA</span>Nova</span>
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
                <Compass className="h-3.5 w-3.5" /> Explorar
              </button>
              <button
                onClick={() => setLocation("/social")}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all ${
                  location === "/social"
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "border-transparent text-muted-foreground hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Globe className="h-3.5 w-3.5" /> Social
              </button>
            </div>
            
            {/* Mobile Only: ViaSocial Quick Access */}
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

            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Cambiar tema</span>
            </Button>

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
                    Configuración de Cuenta
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/social")} className="cursor-pointer gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    ViaSocial
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={() => setLocation("/ride-history")} className="cursor-pointer gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Historial de Viajes
                  </DropdownMenuItem>
                  
                  {isProvider && (
                    <DropdownMenuItem onClick={() => setLocation("/products")} className="cursor-pointer gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Mis Productos
                    </DropdownMenuItem>
                  )}

                  {user.role === 'taxi' && (
                    <DropdownMenuItem onClick={() => setLocation("/taxi-dashboard")} className="cursor-pointer gap-2">
                      <Car className="h-4 w-4 text-yellow-400" />
                      Panel de Taxista
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-2">
                    <LogOut className="h-4 w-4" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <Link href="/login">
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90">Iniciar Sesión</Button>
            </Link>
          )}
        </div>
      </div>
    </motion.nav>
  );
}
