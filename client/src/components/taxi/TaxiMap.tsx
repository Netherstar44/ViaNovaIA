import { useState, useEffect } from 'react';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

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

export default function TaxiMap({ isAvailable, activeRide, nearbyPassengers = [] }: TaxiMapProps) {
  const [viewState, setViewState] = useState({
    longitude: -75.289,
    latitude: 2.936,
    zoom: 14,
    pitch: 50,
    bearing: 0
  });

  const [taxiPos, setTaxiPos] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    const fallback: [number, number] = [2.936, -75.289];
    if (!navigator.geolocation) {
      setTaxiPos(fallback);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setTaxiPos(c);
        setViewState(v => ({ ...v, latitude: c[0], longitude: c[1] }));
      },
      () => setTaxiPos(fallback),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  useEffect(() => {
    if (!activeRide) { setRoute([]); return; }
    const { originCoords, destinationCoords } = activeRide;
    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destinationCoords[1]},${destinationCoords[0]}?overview=full&geometries=geojson`;

    fetch(url)
      .then(r => r.json())
      .then(data => {
        if (data.routes?.[0]) {
          // OSRM returns [lng, lat], we keep it as [lng, lat] for Mapbox
          const coords = data.routes[0].geometry.coordinates;
          setRoute(coords);
          
          const midLat = (originCoords[0] + destinationCoords[0]) / 2;
          const midLng = (originCoords[1] + destinationCoords[1]) / 2;
          setViewState(v => ({ ...v, latitude: midLat, longitude: midLng, zoom: 13, transitionDuration: 1000 } as any));
        }
      })
      .catch(() => setRoute([[originCoords[1], originCoords[0]], [destinationCoords[1], destinationCoords[0]]]));
  }, [activeRide]);

  if (!taxiPos) {
    return <div className="flex items-center justify-center h-full text-sm text-muted-foreground">Obteniendo ubicación...</div>;
  }

  const geojsonRoute = route.length > 0 ? {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates: route }
  } : null;

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden bg-card">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        style={{ width: '100%', height: '100%' }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" />

        {/* Taxista Posición */}
        <Marker longitude={taxiPos[1]} latitude={taxiPos[0]}>
          <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-lg">
            🚕
          </div>
        </Marker>

        {/* Pasajeros cercanos */}
        {!activeRide && isAvailable && nearbyPassengers.map(p => (
          <Marker key={p.id} longitude={p.coords[1]} latitude={p.coords[0]}>
             <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.6)] cursor-pointer hover:scale-110 transition-transform">
               🧍
             </div>
          </Marker>
        ))}

        {/* Ruta Activa */}
        {activeRide && (
          <>
            <Marker longitude={activeRide.originCoords[1]} latitude={activeRide.originCoords[0]}>
              <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs">🧍</div>
            </Marker>
            <Marker longitude={activeRide.destinationCoords[1]} latitude={activeRide.destinationCoords[0]}>
              <div className="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs">📍</div>
            </Marker>

            {geojsonRoute && (
              <Source id="taxi-route" type="geojson" data={geojsonRoute}>
                <Layer
                  id="taxi-route-layer"
                  type="line"
                  layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                  paint={{ 'line-color': '#eab308', 'line-width': 5, 'line-opacity': 0.85 }}
                />
              </Source>
            )}
          </>
        )}
      </Map>

      {/* Badge de estado */}
      <div className="absolute top-3 left-3 z-10 bg-background/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/50 text-xs font-medium shadow flex items-center gap-1.5">
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