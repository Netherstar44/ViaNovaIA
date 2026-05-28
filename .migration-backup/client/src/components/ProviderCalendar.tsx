import { apiBase } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Clock, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";

interface ProviderCalendarProps {
  services: any[];
}

export default function ProviderCalendar({ services }: ProviderCalendarProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Form State
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [capacity, setCapacity] = useState("1");
  const [slotType, setSlotType] = useState("hour");
  const [price, setPrice] = useState("");

  const selectedService = services.find(s => s.id === selectedServiceId);

  useEffect(() => {
    if (selectedServiceId) {
      fetchSlots();
    } else {
      setSlots([]);
    }
  }, [selectedServiceId]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase}/api/bookings/slots/${selectedServiceId}`);
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (!selectedServiceId || !date) {
      return toast({ title: "Atención", description: "Selecciona un servicio y una fecha", variant: "destructive" });
    }

    try {
      const startDateTime = new Date(date);
      const [startH, startM] = startTime.split(':');
      startDateTime.setHours(parseInt(startH), parseInt(startM));

      const endDateTime = new Date(date);
      const [endH, endM] = endTime.split(':');
      endDateTime.setHours(parseInt(endH), parseInt(endM));

      const body = {
        serviceId: selectedServiceId,
        slotType,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        capacity: parseInt(capacity),
        price: price ? parseInt(price) : selectedService?.price || 0,
      };

      const res = await fetch(apiBase + "/api/bookings/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error("Error al crear slot");
      
      toast({ title: "Éxito", description: "Disponibilidad agregada correctamente" });
      fetchSlots();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const slotsForSelectedDate = slots.filter(s => {
    if (!date) return false;
    const sDate = new Date(s.startTime);
    return sDate.getDate() === date.getDate() && sDate.getMonth() === date.getMonth();
  });

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-8">
      {/* Columna Izquierda: Calendario y Selección */}
      <div className="space-y-6">
        <Card className="border-white/10 bg-card/50 backdrop-blur-2xl">
          <CardHeader>
            <CardTitle className="text-xl">Selecciona tu Servicio</CardTitle>
            <CardDescription>¿A qué servicio le vas a asignar disponibilidad?</CardDescription>
          </CardHeader>
          <CardContent>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">Primero publica un servicio en la otra pestaña.</p>
            ) : (
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger className="bg-background border-white/10">
                  <SelectValue placeholder="Elige un servicio..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {selectedServiceId && (
          <Card className="border-white/10 bg-card/50 backdrop-blur-2xl flex flex-col items-center">
             <CardHeader className="w-full">
              <CardTitle className="text-xl">Fecha de Disponibilidad</CardTitle>
             </CardHeader>
             <CardContent>
               <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                locale={es}
                className="rounded-xl border border-white/10 bg-background/50 shadow-inner"
              />
             </CardContent>
          </Card>
        )}
      </div>

      {/* Columna Derecha: Formulario y Lista de Slots */}
      {selectedServiceId && date && (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <Card className="border-white/10 bg-card/50 backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                Agregar Horario
              </CardTitle>
              <CardDescription>
                Define la franja horaria para el {format(date, "d 'de' MMMM", { locale: es })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora de Inicio</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-background" />
                </div>
                <div className="space-y-2">
                  <Label>Hora de Fin</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-background" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Unidad</Label>
                  <Select value={slotType} onValueChange={setSlotType}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Hora / Turno</SelectItem>
                      <SelectItem value="table">Mesa</SelectItem>
                      <SelectItem value="room">Habitación</SelectItem>
                      <SelectItem value="seat">Asiento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Cantidad Disponible</Label>
                  <Input type="number" min="1" value={capacity} onChange={e => setCapacity(e.target.value)} className="bg-background" />
                </div>
              </div>

              <Button onClick={handleAddSlot} className="w-full gap-2 mt-4" variant="default">
                <Plus className="h-4 w-4" /> Agregar Disponibilidad
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-card/50 backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Horarios Registrados</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground animate-pulse">Cargando horarios...</p>
              ) : slotsForSelectedDate.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay horarios registrados para este día.</p>
              ) : (
                <div className="space-y-3">
                  {slotsForSelectedDate.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-white/5">
                      <div className="flex items-center gap-3">
                        <Clock className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-medium text-sm">
                            {format(new Date(slot.startTime), "HH:mm")} - {format(new Date(slot.endTime), "HH:mm")}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {slot.capacity - (slot.booked || 0)} {slot.slotType}s disp.
                          </p>
                        </div>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
