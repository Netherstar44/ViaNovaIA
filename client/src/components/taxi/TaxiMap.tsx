import { useEffect, useMemo, useState } from 'react';
import Map, { Marker, NavigationControl, Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre-worker';
import { OSM_MAP_STYLE } from '@/lib/map-style';
import { isUsableCoordinatePair, isValidCoordinatePair, isValidLatLng } from '@/lib/geo';

type ViewState = {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
};

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
  const [viewState, setViewState] = useState<ViewState>({
    longitude: -75.289,
    latitude: 2.936,
    zoom: 14,
    pitch: 50,
    bearing: 0,
  });

  const [taxiPos, setTaxiPos] = useState<[number, number] | null>(null);
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    const fallback: [number, number] = [2.936, -75.289];
    if (!navigator.geolocation) {
      setTaxiPos(fallback);
      return;
    }

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (cancelled) return;
        const { latitude, longitude } = position.coords;
        if (isValidLatLng(latitude, longitude)) {
          setTaxiPos([latitude, longitude]);
          setViewState((current) => ({ ...current, latitude, longitude }));
        } else {
          setTaxiPos(fallback);
        }
      },
      () => {
        if (!cancelled) setTaxiPos(fallback);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  const validPassengers = useMemo(
    () => nearbyPassengers.filter((passenger) => isUsableCoordinatePair(passenger.coords)),
    [nearbyPassengers],
  );

  const validOrigin = activeRide && isValidCoordinatePair(activeRide.originCoords)
    ? activeRide.originCoords
    : null;
  const validDestination = activeRide && isValidCoordinatePair(activeRide.destinationCoords)
    ? activeRide.destinationCoords
    : null;

  useEffect(() => {
    if (!activeRide || !validOrigin || !validDestination) {
      setRoute([]);
      return;
    }

    const { originCoords, destinationCoords } = activeRide;
    const url = `https://router.project-osrm.org/route/v1/driving/${originCoords[1]},${originCoords[0]};${destinationCoords[1]},${destinationCoords[0]}?overview=full&geometries=geojson`;

    let cancelled = false;
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        const geometry = data.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(geometry) && geometry.length > 1) {
          const coordinates = geometry.filter(
            (coordinate: unknown): coordinate is [number, number] =>
              Array.isArray(coordinate) &&
              coordinate.length >= 2 &&
              isValidLatLng(coordinate[1], coordinate[0]),
          );
          setRoute(coordinates);

          const midLat = (originCoords[0] + destinationCoords[0]) / 2;
          const midLng = (originCoords[1] + destinationCoords[1]) / 2;
          if (isValidLatLng(midLat, midLng)) {
            setViewState((current) => ({
              ...current,
              latitude: midLat,
              longitude: midLng,
              zoom: 13,
              transitionDuration: 1000,
            }));
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        setRoute([
          [originCoords[1], originCoords[0]],
          [destinationCoords[1], destinationCoords[0]],
        ]);
      });

    return () => {
      cancelled = true;
    };
  }, [activeRide, validDestination, validOrigin]);

  if (!taxiPos) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Obteniendo ubicación...
      </div>
    );
  }

  const geojsonRoute = route.length > 1
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: { type: 'LineString' as const, coordinates: route },
      }
    : null;

  return (
    <div className="taxi-map-dark relative h-full w-full rounded-xl overflow-hidden bg-card">
      <Map
        {...viewState}
        onMove={(event) => setViewState(event.viewState)}
        mapStyle={OSM_MAP_STYLE}
        style={{ width: '100%', height: '100%' }}
        onError={(event) => console.error('Taxi map error:', event)}
      >
        <NavigationControl position="top-right" />

        {/* Taxista Posición */}
        <Marker longitude={taxiPos[1]} latitude={taxiPos[0]}>
          <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-lg">
            🚕
          </div>
        </Marker>

        {/* Pasajeros cercanos */}
        {!activeRide && isAvailable && validPassengers.map((passenger) => (
          <Marker key={passenger.id} longitude={passenger.coords[1]} latitude={passenger.coords[0]}>
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-[0_0_15px_rgba(59,130,246,0.6)] cursor-pointer hover:scale-110 transition-transform">
              🧍
            </div>
          </Marker>
        ))}

        {/* Ruta Activa */}
        {activeRide && validOrigin && validDestination && (
          <>
            <Marker longitude={validOrigin[1]} latitude={validOrigin[0]}>
              <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-xs">🧍</div>
            </Marker>
            <Marker longitude={validDestination[1]} latitude={validDestination[0]}>
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
          ? <><span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Disponible — {validPassengers.length} solicitud(es) cerca</>
          : <><span className="w-2 h-2 rounded-full bg-gray-500" /> No disponible</>}
      </div>
    </div>
  );
}
