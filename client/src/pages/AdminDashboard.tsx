import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import Navbar from "@/components/Navbar";
import { Users, ShieldAlert, Activity, AlertTriangle, ArrowLeft } from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [_, setLocation] = useLocation();

  if (!user || user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <div className="container max-w-6xl py-12 px-4">
        <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8">
          <ArrowLeft className="h-4 w-4" /> Volver al inicio
        </button>

        <h1 className="text-3xl font-bold mb-2">Panel de Administración</h1>
        <p className="text-muted-foreground mb-10">Monitorea la actividad del sistema, usuarios y alertas de seguridad.</p>

        {isLoading ? (
          <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <Users className="text-blue-500 h-8 w-8" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Usuarios</p>
                  <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <Activity className="text-purple-500 h-8 w-8" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Proveedores</p>
                  <p className="text-2xl font-bold">{stats?.totalProviders || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <ShieldAlert className="text-green-500 h-8 w-8" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Verificados</p>
                  <p className="text-2xl font-bold">{stats?.verifiedUsers || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-card border border-red-500/30 rounded-2xl p-6 shadow-sm bg-red-500/5">
              <div className="flex items-center gap-4 mb-4">
                <AlertTriangle className="text-red-500 h-8 w-8" />
                <div>
                  <p className="text-sm font-medium text-red-400 uppercase tracking-wider">Cuentas Bloqueadas</p>
                  <p className="text-2xl font-bold text-red-400">{stats?.lockedAccounts || 0}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* System Logs / Alerts */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> Anomalías Detectadas (Log)</h3>
          <div className="space-y-4">
            {stats?.logs?.length ? (
              stats.logs.map((log: any, i: number) => (
                <div key={i} className="flex justify-between items-start p-4 bg-secondary/20 rounded-lg border border-border/40">
                  <div>
                    <p className="font-medium text-sm text-foreground">{log.event}</p>
                    <p className="text-xs text-muted-foreground mt-1">Usuario: {log.username}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center p-8">No hay anomalías recientes registradas.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
