import { useEffect, useRef, useState } from 'react';
import Map, {
  Layer,
  Marker,
  NavigationControl,
  Source,
  type MapRef,
} from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import '@/lib/maplibre-worker';
import { Car, MapPin } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import { isUsableCoordinatePair, isValidLatLng } from '@/lib/geo';
import { useVectorMapStyle } from '@/lib/use-vector-map-style';

type LatLng = [number, number];

interface RouteFeature {
  type: 'Feature';
  properties: { estimated: boolean };
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
}

interface RouteMapProps {
  /** [lat, lng] */
  origin?: LatLng | null;
  /** [lat, lng] */
  destination?: LatLng | null;
  /** Optional live vehicle position, [lat, lng]. */
  driver?: LatLng | null;
  className?: string;
  fitPadding?: number;
  showNavigation?: boolean;
}

const DEFAULT_VIEW = {
  latitude: 2.936,
  longitude: -75.289,
  zoom: 12.5,
  pitch: 0,
  bearing: 0,
};

function usablePoint(value?: LatLng | null): LatLng | null {
  return value && isUsableCoordinatePair(value) ? [Number(value[0]), Number(value[1])] : null;
}

function pointKey(value: LatLng | null): string {
  return value ? `${value[0]},${value[1]}` : '';
}

function parseKey(key: string): LatLng | null {
  if (!key) return null;
  const [lat, lng] = key.split(',').map(Number);
  return isValidLatLng(lat, lng) ? [lat, lng] : null;
}

/**
 * Compact MapLibre map for origin → destination taxi trips. It resolves a
 * driving route on OSRM and gracefully falls back to a straight line so the
 * trip is always legible, even when the routing service is unavailable.
 */
export default function RouteMap({
  origin,
  destination,
  driver,
  className,
  fitPadding = 56,
  showNavigation = true,
}: RouteMapProps) {
  const reduceMotion = useReducedMotion();
  const mapRef = useRef<MapRef | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [route, setRoute] = useState<RouteFeature | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const { mapStyle, handleMapError } = useVectorMapStyle();

  const originPoint = usablePoint(origin);
  const destinationPoint = usablePoint(destination);
  const driverPoint = usablePoint(driver);
  const originKey = pointKey(originPoint);
  const destinationKey = pointKey(destinationPoint);
  const driverKey = pointKey(driverPoint);

  useEffect(() => {
    const start = parseKey(originKey);
    const end = parseKey(destinationKey);
    if (!start || !end) {
      setRoute(null);
      setIsRouting(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    // OSRM's public demo server occasionally accepts the connection and then
    // stalls. Fall back to the straight line quickly instead of leaving the
    // rider staring at a spinner for the browser's 30s network timeout.
    const timeoutId = window.setTimeout(() => controller.abort(), 9000);
    setIsRouting(true);

    const straightLine: RouteFeature = {
      type: 'Feature',
      properties: { estimated: true },
      geometry: {
        type: 'LineString',
        coordinates: [
          [start[1], start[0]],
          [end[1], end[0]],
        ],
      },
    };

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        const raw = data?.routes?.[0]?.geometry?.coordinates;
        const coordinates = Array.isArray(raw)
          ? raw.filter(
              (coordinate: unknown): coordinate is [number, number] =>
                Array.isArray(coordinate) &&
                coordinate.length >= 2 &&
                isValidLatLng(coordinate[1], coordinate[0]),
            )
          : [];

        if (coordinates.length > 1) {
          setRoute({
            type: 'Feature',
            properties: { estimated: false },
            geometry: { type: 'LineString', coordinates },
          });
          return;
        }

        setRoute(straightLine);
      })
      .catch(() => {
        if (!cancelled) setRoute(straightLine);
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        if (!cancelled) setIsRouting(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [originKey, destinationKey]);

  useEffect(() => {
    if (!mapReady) return;

    const start = parseKey(originKey);
    const end = parseKey(destinationKey);
    const vehicle = parseKey(driverKey);
    const points: [number, number][] = [];

    if (start) points.push([start[1], start[0]]);
    if (end) points.push([end[1], end[0]]);
    if (vehicle) points.push([vehicle[1], vehicle[0]]);

    const coordinates =
      route && route.geometry.coordinates.length > 1 ? route.geometry.coordinates : points;
    if (!coordinates.length) return;

    if (coordinates.length === 1) {
      mapRef.current?.flyTo({
        center: coordinates[0],
        zoom: 14.5,
        duration: reduceMotion ? 0 : 900,
      });
      return;
    }

    let [minLng, minLat] = coordinates[0];
    let [maxLng, maxLat] = coordinates[0];

    for (const [lng, lat] of coordinates) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }

    if (!isValidLatLng(minLat, minLng) || !isValidLatLng(maxLat, maxLng)) return;

    mapRef.current?.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      {
        padding: fitPadding,
        maxZoom: coordinates.length > 5 ? 15 : 14,
        duration: reduceMotion ? 0 : 900,
      },
    );
  }, [mapReady, originKey, destinationKey, driverKey, route, fitPadding, reduceMotion]);

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-[#e9e7e1] ${className ?? ''}`}
      data-testid="route-map"
    >
      <Map
        ref={mapRef}
        initialViewState={DEFAULT_VIEW}
        mapStyle={mapStyle}
        attributionControl={{ compact: true }}
        style={{ width: '100%', height: '100%' }}
        onLoad={() => setMapReady(true)}
        onError={handleMapError}
      >
        {showNavigation && <NavigationControl position="top-right" showCompass={false} />}

        {driverPoint && (
          <Marker longitude={driverPoint[1]} latitude={driverPoint[0]} anchor="center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#ffbf00] text-black shadow-lg">
              <Car className="h-5 w-5" strokeWidth={2.4} />
            </div>
          </Marker>
        )}

        {originPoint && (
          <Marker longitude={originPoint[1]} latitude={originPoint[0]} anchor="center">
            <div className="relative flex h-5 w-5 items-center justify-center" title="Origen">
              <span className="absolute h-5 w-5 animate-ping rounded-full bg-emerald-500/35" />
              <span className="relative h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.65)]" />
            </div>
          </Marker>
        )}

        {destinationPoint && (
          <Marker longitude={destinationPoint[1]} latitude={destinationPoint[0]} anchor="bottom">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#ef4444] text-white shadow-lg"
              title="Destino"
            >
              <MapPin className="h-4 w-4" strokeWidth={2.6} />
            </div>
          </Marker>
        )}

        {route && (
          <Source id="taxi-trip-route" type="geojson" data={route}>
            <Layer
              id="taxi-trip-route-casing"
              type="line"
              filter={['==', ['get', 'estimated'], false]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#1f1e1a', 'line-width': 9, 'line-opacity': 0.14 }}
            />
            <Layer
              id="taxi-trip-route-line"
              type="line"
              filter={['==', ['get', 'estimated'], false]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{ 'line-color': '#f2b300', 'line-width': 5, 'line-opacity': 0.95 }}
            />
            <Layer
              id="taxi-trip-route-estimated"
              type="line"
              filter={['==', ['get', 'estimated'], true]}
              layout={{ 'line-join': 'round', 'line-cap': 'round' }}
              paint={{
                'line-color': '#c9a227',
                'line-width': 4,
                'line-opacity': 0.85,
                'line-dasharray': [2, 1.6],
              }}
            />
          </Source>
        )}
      </Map>

      {isRouting && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-white/60 bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-600 shadow-sm backdrop-blur">
          Trazando ruta…
        </div>
      )}
    </div>
  );
}
