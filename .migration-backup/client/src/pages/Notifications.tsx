import { apiBase } from "@/lib/queryClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, MailOpen, MapPin, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Navbar from "@/components/Navbar";

type Notification = {
  id: string;
  providerUsername: string;
  travelerUsername: string;
  type: string;
  details: string;
  isRead: string;
  createdAt: string;
};

export default function Notifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: [user?.username ? `/api/notifications?username=${encodeURIComponent(user.username)}` : null],
    enabled: !!user && user.role !== "traveler",
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${apiBase}/api/notifications/${id}/read`, { method: "PATCH" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [user?.username ? `/api/notifications?username=${encodeURIComponent(user.username)}` : null] });
    },
  });

  if (!user || user.role === "traveler") {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto p-6 text-center mt-20">
          <h2 className="text-xl font-bold">No tienes acceso a esta página.</h2>
          <p className="text-muted-foreground mt-2">Solo para proveedores (Hoteles, Restaurantes, etc).</p>
        </div>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => n.isRead !== "true").length;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      <main className="flex-1 container mx-auto px-4 py-8 mt-16 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Notificaciones de Reservas</h1>
            <p className="text-muted-foreground mt-1">
              Tienes {unreadCount} solicitud{unreadCount !== 1 ? 'es' : ''} pendiente{unreadCount !== 1 ? 's' : ''}.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <span className="w-8 h-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <Card className="border-dashed bg-secondary/20">
            <CardContent className="flex flex-col items-center justify-center h-64 text-center">
              <Search className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-medium">No hay notificaciones</p>
              <p className="text-sm text-muted-foreground mt-1">Cuando un viajero confirme una reserva, aparecerá aquí.</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[600px] pr-4">
            <div className="space-y-4">
              {notifications.map((notif) => {
                const isRead = notif.isRead === "true";
                return (
                  <Card key={notif.id} className={`transition-all ${isRead ? 'opacity-70 bg-card' : 'bg-primary/5 border-primary/30 shadow-md shadow-primary/5'}`}>
                    <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {notif.type}
                          {!isRead && <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs uppercase tracking-wider font-bold">Nueva</span>}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(notif.createdAt).toLocaleString('es-CO')}
                        </p>
                      </div>
                      {!isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markAsRead.mutate(notif.id)}
                          disabled={markAsRead.isPending}
                          className="h-8 text-xs hover:text-primary hover:bg-primary/10"
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Marcar Leída
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg bg-black/20 p-4 mt-2 text-sm leading-relaxed border border-white/5">
                        <p><strong className="text-primary/80">Viajero:</strong> {notif.travelerUsername}</p>
                        <p className="mt-2"><strong className="text-primary/80">Detalles:</strong> {notif.details}</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </main>
    </div>
  );
}
