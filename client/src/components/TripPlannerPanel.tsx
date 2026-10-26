import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock,
  Hotel,
  Loader2,
  MapPin,
  Route,
  Ticket,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiBase } from "@/lib/queryClient";
import { authHeaders } from "@/lib/secureStorage";

export type TripStopDto = {
  id: string;
  tripId: string;
  dayNumber: number;
  stopOrder: number;
  itemType: string;
  itemId: string;
  category: string;
  name: string;
  description: string;
  imageUrl: string | null;
  price: number;
  currency: string;
  providerUsername: string;
  latitude: number | null;
  longitude: number | null;
  startTime: string;
  duration: string | null;
  notes: string | null;
  message: string | null;
  chatMessageId: string | null;
};

export type TripDto = {
  id: string;
  username: string;
  destinationCity: string;
  originCity: string | null;
  days: number;
  travelers: number;
  budget: number | null;
  currency: string;
  status: string;
  summary: string;
  totalEstimate: number;
  createdAt: string | null;
  routeEstablishedAt: string | null;
  stops: TripStopDto[];
};

export type TripRouteMessage = {
  stopId: string;
  content: string;
  messageId: string | null;
};

type Props = {
  trip: TripDto;
  onRouteEstablished?: (trip: TripDto, messages: TripRouteMessage[]) => void;
};

function categoryIcon(category: string) {
  const key = category.toLowerCase();
  if (key.startsWith("hotel")) return <Hotel className="h-3.5 w-3.5" />;
  if (key.startsWith("restaurant") || key.startsWith("comida")) {
    return <UtensilsCrossed className="h-3.5 w-3.5" />;
  }
  return <Ticket className="h-3.5 w-3.5" />;
}

function money(value: number, currency = "COP") {
  return `$${Number(value || 0).toLocaleString("es-CO")} ${currency}`;
}

export default function TripPlannerPanel({ trip, onRouteEstablished }: Props) {
  const [establishing, setEstablishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const days = useMemo(() => {
    const grouped = new Map<number, TripStopDto[]>();
    for (const stop of trip.stops || []) {
      const list = grouped.get(stop.dayNumber) || [];
      list.push(stop);
      grouped.set(stop.dayNumber, list);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, stops]) => ({
        day,
        stops: stops.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [trip.stops]);

  const routed = trip.status === "routed";

  const establish = async () => {
    if (routed || establishing) return;
    setEstablishing(true);
    setError(null);
    try {
      const response = await fetch(`${apiBase}/api/trips/${trip.id}/route/establish`, {
        method: "POST",
        headers: await authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "No se pudo establecer la ruta");
      }
      onRouteEstablished?.(data.trip, Array.isArray(data.messages) ? data.messages : []);
    } catch (err: any) {
      setError(err?.message || "No se pudo establecer la ruta");
    } finally {
      setEstablishing(false);
    }
  };

  return (
    <div className="ml-11 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background/85 to-background/75 p-3 shadow-lg">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-2 text-left"
        onClick={() => setCollapsed((value) => !value)}
      >
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Route className="h-4 w-4" />
            Viaje a {trip.destinationCity}
            {routed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {trip.days} {trip.days === 1 ? "día" : "días"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3" /> {trip.travelers}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-foreground/80">
              {money(trip.totalEstimate, trip.currency)}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${collapsed ? "-rotate-90" : ""}`}
        />
      </button>

      {!collapsed && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">{trip.summary}</p>

          {days.map(({ day, stops }) => (
            <div key={day} className="rounded-xl border border-white/5 bg-background/80 p-2">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-primary/90">
                <MapPin className="h-3 w-3" /> Día {day}
              </div>
              <div className="space-y-1.5">
                {stops.map((stop) => (
                  <div key={stop.id} className="flex gap-2 rounded-lg bg-secondary/45 p-2">
                    {stop.imageUrl ? (
                      <img
                        src={stop.imageUrl}
                        alt={stop.name}
                        loading="lazy"
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        {categoryIcon(stop.category)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold text-foreground">{stop.name}</p>
                        <span className="shrink-0 text-[9px] font-bold text-primary">{stop.startTime}</span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-muted-foreground">
                        <span className="inline-flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {stop.startTime}
                        </span>
                        <span>{money(stop.price, stop.currency)}</span>
                        <span className="truncate">@{stop.providerUsername}</span>
                      </div>
                      {stop.message && (
                        <p className="mt-1 whitespace-pre-wrap rounded-md border border-emerald-500/20 bg-emerald-500/5 p-1.5 text-[9px] leading-relaxed text-emerald-200/90">
                          {stop.message}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {error && <p className="text-[10px] font-medium text-destructive">{error}</p>}

          <Button
            type="button"
            size="sm"
            onClick={establish}
            disabled={routed || establishing}
            className="h-8 w-full text-[11px] font-bold"
          >
            {establishing ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Estableciendo ruta...
              </>
            ) : routed ? (
              <>
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Ruta establecida
              </>
            ) : (
              <>
                <Route className="mr-2 h-3.5 w-3.5" /> Establecer ruta y notificar paradas
              </>
            )}
          </Button>
          {!routed && (
            <p className="text-center text-[9px] text-muted-foreground">
              Se enviará un mensaje de chat por cada parada del itinerario.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
