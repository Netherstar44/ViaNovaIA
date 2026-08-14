import { useState, useEffect } from 'react';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { LocationItem } from '@/data/mockData';
import { MapPin } from 'lucide-react';
import type { SimulatedTaxi } from './TaxiOrderPanel';

// Public token para Mapbox (Reemplazar en .env por el de producción)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || '';

interface MapViewProps {
  locations: LocationItem[];
  selectedCategory: string | 'all';
  onMarkerClick?: (item: LocationItem) => void;
  selectedId?: string | null;
  routeCoords?: [number, number][];
  nearbyTaxis?: SimulatedTaxi[];
  routeInfo?: { distanceKm: number; durationMin: number } | null;
}

export default function MapView({ locations, selectedCategory, onMarkerClick, selectedId, routeCoords, nearbyTaxis, routeInfo }: MapViewProps) {
  const filteredLocations = selectedCategory === 'all'
    ? locations
    : locations.filter(l => l.category === selectedCategory);

  const [viewState, setViewState] = useState({
    longitude: -75.289,
    latitude: 2.936,
    zoom: 13,
    pitch: 45, // Inclinación 3D nativa de Mapbox!
    bearing: 0
  });

  const [popupInfo, setPopupInfo] = useState<LocationItem | null>(null);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setInitializing(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc([pos.coords.latitude, pos.coords.longitude]);
        setViewState(v => ({ ...v, latitude: pos.coords.latitude, longitude: pos.coords.longitude }));
        setInitializing(false);
      },
      () => setInitializing(false),
      { enableHighAccuracy: false, timeout: 5000 }
    );
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const loc = locations.find(l => l.id === selectedId);
    if (loc) {
      setViewState({
        ...viewState,
        latitude: loc.coordinates[0],
        longitude: loc.coordinates[1],
        zoom: 15,
        transitionDuration: 1000
      } as any);
      setPopupInfo(loc);
    }
  }, [selectedId, locations]);

  // Convierte coords de Leaflet [lat, lng] a Mapbox [lng, lat]
  const geojsonRoute = routeCoords ? {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: routeCoords.map(c => [c[1], c[0]])
    }
  } : null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-card border-none">
      {initializing ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          Obteniendo ubicación...
        </div>
      ) : (
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          style={{ width: '100%', height: '100%' }}
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" />

          {/* User Location */}
          {userLoc && (
            <Marker longitude={userLoc[1]} latitude={userLoc[0]} anchor="center">
              <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] relative">
                <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75"></div>
              </div>
            </Marker>
          )}

          {/* Taxis Nearby */}
          {nearbyTaxis?.map(taxi => (
            <Marker key={taxi.id} longitude={taxi.lng} latitude={taxi.lat}>
              <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-lg cursor-pointer hover:scale-110 transition-transform">
                🚕
              </div>
            </Marker>
          ))}

          {/* Location Pins */}
          {filteredLocations.map((loc) => {
            const isSelected = selectedId === loc.id;
            return (
              <Marker
                key={loc.id}
                longitude={loc.coordinates[1]}
                latitude={loc.coordinates[0]}
                anchor="bottom"
                onClick={e => {
                  e.originalEvent.stopPropagation();
                  setPopupInfo(loc);
                  if (onMarkerClick) onMarkerClick(loc);
                }}
              >
                <div className={`cursor-pointer transition-all duration-300 ${isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-10'}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-xl" style={{ backgroundColor: isSelected ? '#ffbf00' : '#222222' }}>
                    <MapPin className={`w-5 h-5 ${isSelected ? 'text-black' : 'text-white'}`} />
                  </div>
                </div>
              </Marker>
            );
          })}

          {/* Popup */}
          {popupInfo && (
            <Popup
              anchor="bottom"
              longitude={popupInfo.coordinates[1]}
              latitude={popupInfo.coordinates[0]}
              onClose={() => setPopupInfo(null)}
              closeButton={false}
              offset={[0, -45]}
              className="rounded-xl overflow-hidden shadow-2xl z-[100]"
            >
              <div className="p-3 text-neutral-900 bg-white rounded-lg min-w-[150px]">
                <h3 className="font-extrabold text-[14px]">{popupInfo.name}</h3>
                <p className="text-[12px] text-neutral-500 capitalize">{popupInfo.category}</p>
              </div>
            </Popup>
          )}

          {/* Route Polyline */}
          {geojsonRoute && (
            <Source id="route" type="geojson" data={geojsonRoute}>
              <Layer
                id="route-layer"
                type="line"
                layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                paint={{ 'line-color': '#ffbf00', 'line-width': 5, 'line-opacity': 0.8 }}
              />
            </Source>
          )}
        </Map>
      )}

      {/* Overlays from original component */}
      {routeInfo && (
        <div className="absolute z-10 bottom-3 left-3 bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-primary/30 shadow-lg flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-0.5 bg-primary rounded-full" />
            <span className="font-semibold text-foreground">{routeInfo.distanceKm.toFixed(1)} km</span>
          </div>
          <div className="w-px h-4 bg-border/50" />
          <div className="text-xs text-muted-foreground">
            ~{routeInfo.durationMin} min en auto
          </div>
        </div>
      )}

    </div>
  );
}
