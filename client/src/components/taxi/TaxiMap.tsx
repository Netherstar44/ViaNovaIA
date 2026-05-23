import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ── Fix icons Vite ────────────────────────────────────────────────────────────
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Marker.prototype.options.icon = L.icon({
  iconUrl, iconRetinaUrl, shadowUrl,
  iconSize: [25, 41], iconAnchor: [12, 41],
  popupAnchor: [1, -34], shadowSize: [41, 41],
});

// ── Iconos personalizados ─────────────────────────────────────────────────────
const taxiIcon = L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;background:#eab308;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 0 0 3px #eab30880;">🚖</div>`,
  iconSize: [36, 36], iconAnchor: [18, 18], popupAnchor: [0, -20],
});

const passengerIcon = L.divIcon({
  className: "",
  html: `<div style="width:34px;height:34px;background:#3b82f6;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 3px #3b82f680;animation:pulse-p 1.5s ease-in-out infinite;">🧍</div>
  <style>@keyframes pulse-p{0%,100%{box-shadow:0 0 0 3px #3b82f680}50%{box-shadow:0 0 0 7px #3b82f640}}</style>`,
  iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
});

const destinationIcon = L.divIcon({
  className: "",
  html: `<div style="width:34px;height:34px;background:#ef4444;border-radius:50%;border:3px solid #fff;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 0 0 3px #ef444480;">📍</div>`,
  iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
});

// ── FlyTo helper ──────────────────────────────────────────────────────────────
function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 1 }); }, [center, zoom]);
  return null;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────
interface NearbyPassenger {
  id: string;
  name: string;
  coords: [number, number];
  origin: string;
  destination: string;
}

interface ActiveRide {
  id: number;
  passengerName?: string;
  originCoords: [number, number];
  destinationCoords: [number, number];
  originAddress: string;
  destinationAddress: string;
  status: string;
}

interface TaxiMapProps {
  isAvailable: boolean;
  activeRide?: ActiveRide | null;
  nearbyPassengers?: NearbyPassenger[];
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function TaxiMap({ isAvailable, activeRide, nearbyPassengers = [] }: TaxiMapProps) {
  const [taxiPos, setTaxiPos] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);
  const [center, setCenter] = useState<[number, number]>([2.936, -75.289]);
  const [zoom, setZoom] = useState(14);

  // Obtener ubicación del taxista
  useEffect(() => {
    const fallback: [number, number] = [2.936, -75.289];
    if (!navigator.geolocation) { setTaxiPos(fallback); setCenter(fallback); return; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setTaxiPos(c);
        setCenter(c);
      },
      () => { setTaxiPos(fallback); setCenter(fallback); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Trazar ruta cuando hay viaje activo
  useEffect(() => {
    if (!activeRide) { setRoute([]); return; }

    const { originCoords, destinationCoords } = activeRide;
    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destinationCoords[1]},${destinationCoords[0]}?overview=full&geometries=geojson`;

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.routes?.[0]) {
          const coords: [number, number][] = data.routes[0].geometry.coordinates.map(
            ([lng, lat]: [number, number]) => [lat, lng]
          );
          setRoute(coords);
          // Centrar entre origen y destino
          const midLat = (originCoords[0] + destinationCoords[0]) / 2;
          const midLng = (originCoords[1] + destinationCoords[1]) / 2;
          setCenter([midLat, midLng]);
          setZoom(13);
        }
      })
      .catch(() => {
        // Fallback: línea recta
        setRoute([originCoords, destinationCoords]);
      });
  }, [activeRide]);

  if (!taxiPos) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Obteniendo ubicación...
      </div>
    );
  }

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <FlyTo center={center} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Taxista */}
        <Marker position={taxiPos} icon={taxiIcon}>
          <Popup><div className="text-black font-medium text-sm">📍 Tu posición</div></Popup>
        </Marker>

        {/* Modo disponible: viajeros cercanos con solicitudes */}
        {!activeRide && isAvailable && nearbyPassengers.map((p) => (
          <Marker key={p.id} position={p.coords} icon={passengerIcon}>
            <Popup>
              <div className="text-black min-w-[160px]">
                <p className="font-bold text-sm">🧍 {p.name}</p>
                <p className="text-xs text-gray-500 mt-1">📌 {p.origin}</p>
                <p className="text-xs text-gray-500">🏁 {p.destination}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Modo viaje activo: ruta */}
        {activeRide && (
          <>
            <Marker position={activeRide.originCoords} icon={passengerIcon}>
              <Popup><div className="text-black text-sm font-medium">🧍 Origen: {activeRide.originAddress}</div></Popup>
            </Marker>
            <Marker position={activeRide.destinationCoords} icon={destinationIcon}>
              <Popup><div className="text-black text-sm font-medium">🏁 Destino: {activeRide.destinationAddress}</div></Popup>
            </Marker>
            {route.length > 0 && (
              <Polyline
                positions={route}
                pathOptions={{ color: "#eab308", weight: 5, opacity: 0.85 }}
              />
            )}
          </>
        )}
      </MapContainer>

      {/* Badge de estado */}
      <div className="absolute top-3 left-3 z-[400] bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/50 text-xs font-medium shadow flex items-center gap-1.5">
        {activeRide
          ? <><span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" /> En viaje</>
          : isAvailable
          ? <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Disponible — {nearbyPassengers.length} solicitud(es) cerca</>
          : <><span className="w-2 h-2 rounded-full bg-gray-500" /> No disponible</>
        }
      </div>
    </div>
  );
}