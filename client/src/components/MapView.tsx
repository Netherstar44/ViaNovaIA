import { useEffect, useMemo, useState } from 'react';
import Map, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre-worker';
import { OSM_MAP_STYLE } from '@/lib/map-style';
import { LocationItem } from '@/data/mockData';
import { MapPin } from 'lucide-react';
import type { SimulatedTaxi } from './TaxiOrderPanel';
import {
  isUsableCoordinatePair,
  isValidCoordinatePair,
  isValidLatLng,
} from '@/lib/geo';

type ViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
};

const INITIAL_VIEW_STATE: ViewState = {
  longitude: -75.289,
  latitude: 2.936,
  zoom: 13,
  pitch: 45,
  bearing: 0,
};

interface MapViewProps {
  locations: LocationItem[];
  selectedCategory: string | 'all';
  onMarkerClick?: (item: LocationItem) => void;
  selectedId?: string | null;
  routeCoords?: [number, number][];
  nearbyTaxis?: SimulatedTaxi[];
  routeInfo?: { distanceKm: number; durationMin: number } | null;
}

export default function MapView({
  locations,
  selectedCategory,
  onMarkerClick,
  selectedId,
  routeCoords,
  nearbyTaxis,
  routeInfo,
}: MapViewProps) {
  const validLocations = useMemo(
    () => locations.filter((location) => isUsableCoordinatePair(location.coordinates)),
    [locations],
  );

  const filteredLocations = useMemo(
    () =>
      selectedCategory === 'all'
        ? validLocations
        : validLocations.filter((location) => location.category === selectedCategory),
    [selectedCategory, validLocations],
  );

  const validTaxis = useMemo(
    () => (nearbyTaxis || []).filter((taxi) => isValidLatLng(taxi.lat, taxi.lng)),
    [nearbyTaxis],
  );

  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [popupInfo, setPopupInfo] = useState<LocationItem | null>(null);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      return;
    }

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;
        if (isValidLatLng(latitude, longitude)) {
          setUserLoc([latitude, longitude]);
          setViewState((current) => ({ ...current, latitude, longitude }));
        }
        setLocating(false);
      },
      () => {
        if (!cancelled) setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 5000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const location = validLocations.find((item) => item.id === selectedId);
    if (!location) return;

    const [latitude, longitude] = location.coordinates;
    setViewState((current) => ({
      ...current,
      latitude,
      longitude,
      zoom: 15,
      transitionDuration: 1000,
    }));
    setPopupInfo(location);
  }, [selectedId, validLocations]);

  const geojsonRoute = useMemo(() => {
    const coordinates = (routeCoords || [])
      .filter(isValidCoordinatePair)
      .map(([latitude, longitude]) => [longitude, latitude] as [number, number]);

    if (coordinates.length < 2) return null;

    return {
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates,
      },
    };
  }, [routeCoords]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-card border-none">
      <Map
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        mapStyle={OSM_MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        onError={(event) => console.error('Map error:', event)}
      >
        <NavigationControl position="top-right" />

        {/* User Location */}
        {userLoc && (
          <Marker longitude={userLoc[1]} latitude={userLoc[0]} anchor="center">
            <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.8)] relative">
              <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-75" />
            </div>
          </Marker>
        )}

        {/* Taxis Nearby */}
        {validTaxis.map((taxi) => (
          <Marker key={taxi.id} longitude={taxi.lng} latitude={taxi.lat}>
            <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-lg cursor-pointer hover:scale-110 transition-transform">
              🚕
            </div>
          </Marker>
        ))}

        {/* Location Pins */}
        {filteredLocations.map((location) => {
          const isSelected = selectedId === location.id;
          return (
            <Marker
              key={location.id}
              longitude={location.coordinates[1]}
              latitude={location.coordinates[0]}
              anchor="bottom"
              onClick={(event) => {
                event.originalEvent.stopPropagation();
                setPopupInfo(location);
                if (onMarkerClick) onMarkerClick(location);
              }}
            >
              <div
                className={`cursor-pointer transition-all duration-300 ${
                  isSelected ? 'scale-125 z-50' : 'hover:scale-110 z-10'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-xl"
                  style={{ backgroundColor: isSelected ? '#ffbf00' : '#222222' }}
                >
                  <MapPin className={`w-5 h-5 ${isSelected ? 'text-black' : 'text-white'}`} />
                </div>
              </div>
            </Marker>
          );
        })}

        {/* Popup */}
        {popupInfo && isValidCoordinatePair(popupInfo.coordinates) && (
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

      {locating && (
        <div className="absolute top-3 left-3 z-10 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow backdrop-blur-md">
          Ubicándote…
        </div>
      )}

      {/* Overlays from original component */}
      {routeInfo && (
        <div className="absolute z-10 bottom-3 left-3 bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-primary/30 shadow-lg flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="w-3 h-0.5 bg-primary rounded-full" />
            <span className="font-semibold text-foreground">{routeInfo.distanceKm.toFixed(1)} km</span>
          </div>
          <div className="w-px h-4 bg-border/50" />
          <div className="text-xs text-muted-foreground">~{routeInfo.durationMin} min en auto</div>
        </div>
      )}
    </div>
  );
}
