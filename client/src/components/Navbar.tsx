import { Link, useLocation } from "wouter";
import { useAuth, UserRole } from "@/lib/auth";
import { LogOut, User, Settings, Package, Building2, Utensils, TentTree, Car, Clock } from "lucide-react";
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

export default function Navbar() {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'hotel': return <Building2 className="h-4 w-4 text-purple-400" />;
      case 'restaurant': return <Utensils className="h-4 w-4 text-orange-400" />;
      case 'recreation': return <TentTree className="h-4 w-4 text-green-400" />;
      case 'taxi': return <Car className="h-4 w-4 text-yellow-400" />;
      default: return <User className="h-4 w-4 text-blue-400" />;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'hotel': return 'Hotel';
      case 'restaurant': return 'Restaurante';
      case 'recreation': return 'Recreación';
      case 'taxi': return 'Taxista';
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
          <Link href="/">
            <a className="flex items-center gap-2 font-heading text-xl font-bold text-foreground group">
              <motion.div 
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
                className="rounded-lg overflow-hidden"
              >
                <img src="/logo.jpeg" alt="VIANova" className="w-8 h-8 object-cover" />
              </motion.div>
              <span className="text-white"><span className="text-primary">VIA</span>Nova</span>
            </a>
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
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

                  <DropdownMenuItem onClick={() => setLocation("/ride-history")} className="cursor-pointer gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Historial de Viajes
                  </DropdownMenuItem>
                  
                  {isProvider && (
                    <DropdownMenuItem onClick={() => setLocation("/my-products")} className="cursor-pointer gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      Administrar Productos
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
