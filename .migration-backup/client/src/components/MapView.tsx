import { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { LocationItem } from '@/data/mockData';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import type { SimulatedTaxi } from './TaxiOrderPanel';

// Fix for default markers in Leaflet with Vite/Webpack
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  locations: LocationItem[];
  selectedCategory: string | 'all';
  onMarkerClick?: (item: LocationItem) => void;
  selectedId?: string | null;
  routeCoords?: [number, number][];
  nearbyTaxis?: SimulatedTaxi[];
  routeInfo?: { distanceKm: number; durationMin: number } | null;
}

function FlyTo({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    // Invalidate size first so the map recalculates its container dimensions,
    // then fly to the center — this prevents off-center positioning.
    requestAnimationFrame(() => {
      map.invalidateSize({ animate: false });
      map.flyTo(center, zoom, { duration: 1.2, easeLinearity: 0.25 });
    });
  }, [center, zoom, map]);
  return null;
}

// ── Marker icon builders ─────────────────────────────────────────────────────

// Inject keyframes for the selected-marker animation (once)
if (typeof document !== 'undefined' && !document.getElementById('vianova-marker-anims')) {
  const style = document.createElement('style');
  style.id = 'vianova-marker-anims';
  style.textContent = `
    @keyframes vianova-bounce {
      0%, 100% { transform: translateY(0) scale(1); }
      20%      { transform: translateY(-8px) scale(1.08); }
      40%      { transform: translateY(0) scale(1); }
      60%      { transform: translateY(-4px) scale(1.04); }
      80%      { transform: translateY(0) scale(1); }
    }
    @keyframes vianova-ring-pulse {
      0%   { transform: scale(1);   opacity: 0.7; }
      100% { transform: scale(2.8); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

function makeCategoryIcon(svgPath: string, color: string, isSelected: boolean) {
  const size = isSelected ? 48 : 36;
  const innerSize = isSelected ? 24 : 18;
  const pulseRing = isSelected
    ? `<div style="
        position:absolute;
        inset:-12px;
        border:3px solid ${color};
        border-radius:50%;
        animation: vianova-ring-pulse 2s ease-out infinite;
        pointer-events:none;
      "></div>`
    : '';

  const bounce = isSelected ? 'animation: vianova-bounce 1.4s ease-in-out 1;' : '';
  const filter = isSelected ? `drop-shadow(0px 8px 12px rgba(0,0,0,0.4))` : `drop-shadow(0px 4px 6px rgba(0,0,0,0.3))`;

  // Custom teardrop pin SVG
  const pinSvg = `
    <svg viewBox="0 0 24 24" width="${size}" height="${size}" style="filter: ${filter}; transition: all 0.3s;">
      <path fill="${color}" stroke="#ffffff" stroke-width="1.5" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <g transform="translate(${12 - innerSize/2}, ${9 - innerSize/2})">
        <svg width="${innerSize}" height="${innerSize}" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          ${svgPath}
        </svg>
      </g>
    </svg>
  `;

  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;
      width:${size}px;height:${size}px;
      display:flex;align-items:center;justify-content:center;
      ${bounce}
      cursor:pointer;
      z-index: ${isSelected ? 1000 : 2};
    ">
      ${pulseRing}
      ${pinSvg}
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

function iconFor(cat: LocationItem['category'], isSelected: boolean) {
  switch (cat) {
    case 'hotel': 
      return makeCategoryIcon('<path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h6M9 11h6M9 15h6"/>', '#7c3aed', isSelected);
    case 'restaurant': 
      return makeCategoryIcon('<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 2v11c0 1.1-.9 2-2 2h-1v7M21 2c-2.2 0-4 1.8-4 4v5h4V2z"/>', '#ea580c', isSelected);
    case 'recreation': 
      return makeCategoryIcon('<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>', '#16a34a', isSelected);
    case 'transport': 
      return makeCategoryIcon('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2M7 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>', '#ca8a04', isSelected);
    default: 
      return DefaultIcon;
  }
}

const userIcon = L.divIcon({
  className: '',
  html: `<div style="position:relative;width:20px;height:20px;">
    <div style="
      position:absolute;inset:-6px;
      background:rgba(59,130,246,0.15);
      border-radius:50%;
      animation:pulse-ring 2s ease-out infinite;
    "></div>
    <div style="
      width:20px;height:20px;
      background:linear-gradient(135deg,#3b82f6,#2563eb);
      border:3px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(37,99,235,0.5);
    "></div>
  </div>
  <style>
    @keyframes pulse-ring {
      0%   { transform:scale(1); opacity:1; }
      100% { transform:scale(2.5); opacity:0; }
    }
  </style>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -14],
});

// ── Taxi radar marker icon ───────────────────────────────────────────────────

function taxiRadarIcon() {
  return L.divIcon({
    className: '',
    html: `<div style="
      position:relative;
      width:36px;height:36px;
      display:flex;align-items:center;justify-content:center;
    ">
      <div style="
        position:absolute;
        inset:-6px;
        border:2px solid #eab308;
        border-radius:50%;
        animation: vianova-ring-pulse 2s ease-out infinite;
        pointer-events:none;
      "></div>
      <div style="
        width:36px;height:36px;
        display:flex;align-items:center;justify-content:center;
        background:linear-gradient(135deg,#eab308,#f59e0b);
        border-radius:50%;
        border:2px solid #fff;
        font-size:18px;
        box-shadow:0 0 12px rgba(234,179,8,0.5);
        cursor:pointer;
      ">🚕</div>
    </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -22],
  });
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MapView({ locations, selectedCategory, onMarkerClick, selectedId, routeCoords, nearbyTaxis, routeInfo }: MapViewProps) {
  const filteredLocations = selectedCategory === 'all'
    ? locations
    : locations.filter(l => l.category === selectedCategory);

  const [center, setCenter] = useState<[number, number] | null>(null);
  const [zoom, setZoom] = useState(13);
  const [initializing, setInitializing] = useState(true);
  const [userLoc, setUserLoc] = useState<[number, number] | null>(null);
  const markerRefs = useRef<Record<string, L.Marker>>({});

  // Get user location on mount
  useEffect(() => {
    const fallback: [number, number] = [2.936, -75.289];
    if (!navigator.geolocation) {
      setCenter(fallback);
      setInitializing(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLoc(c);
        setCenter(c);
        setInitializing(false);
      },
      (err) => {
        console.warn("Geo error:", err);
        setCenter(fallback);
        setInitializing(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // When a selectedId is set, fly to that location and center it
  useEffect(() => {
    if (!selectedId) return;

    // Search in ALL locations (not just filtered) to always find the item
    const loc = locations.find(l => l.id === selectedId);
    if (loc) {
      setCenter(loc.coordinates);
      setZoom(16); // Zoom in close to show the location clearly
    }

    // Open popup after a longer delay so flyTo + invalidateSize finish first.
    // This prevents the popup from shifting the map off-center.
    const timer = setTimeout(() => {
      if (selectedId && markerRefs.current[selectedId]) {
        markerRefs.current[selectedId].openPopup();
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [selectedId, locations]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border/50 shadow-md bg-card">
      {center ? (
        <>
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <FlyTo center={center} zoom={zoom} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User location marker with pulsing effect */}
          {userLoc && (
            <Marker position={userLoc} icon={userIcon}>
              <Popup>
                <div className="text-black font-medium text-sm">Tu ubicación actual</div>
              </Popup>
            </Marker>
          )}

          {/* Location markers */}
          {filteredLocations.map((loc) => (
            <Marker
              key={loc.id}
              position={loc.coordinates}
              ref={(ref: any) => { if (ref) markerRefs.current[loc.id] = ref; }}
              eventHandlers={{
                click: () => onMarkerClick && onMarkerClick(loc),
              }}
              icon={iconFor(loc.category, selectedId === loc.id)}
              zIndexOffset={selectedId === loc.id ? 1000 : 0}
              opacity={selectedId && selectedId !== loc.id ? 0.45 : 1}
            >
              <Popup>
                <div className="min-w-[160px] text-black">
                  <h3 className="font-bold text-sm">{loc.name}</h3>
                  <p className="text-xs opacity-70 capitalize mt-0.5">{loc.category}</p>
                  {loc.rating && (
                    <p className="text-xs mt-1">⭐ {loc.rating}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}

          {/* OSRM recommended route */}
          {routeCoords && routeCoords.length > 1 && (
            <Polyline
              positions={routeCoords}
              pathOptions={{
                color: '#3b82f6',
                weight: 5,
                opacity: 0.8,
                dashArray: undefined,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          )}

          {/* Nearby taxi markers (radar) */}
          {nearbyTaxis && nearbyTaxis.map((taxi) => (
            <Marker
              key={taxi.id}
              position={[taxi.lat, taxi.lng]}
              icon={taxiRadarIcon()}
              zIndexOffset={500}
            >
              <Popup>
                <div className="min-w-[140px] text-black">
                  <h3 className="font-bold text-sm">🚕 {taxi.name}</h3>
                  <p className="text-xs opacity-70 mt-0.5">{taxi.vehicleType}</p>
                  <p className="text-xs opacity-70">{taxi.plate}</p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* My location button */}
        <button
          onClick={() => {
            if (userLoc) {
              setCenter(userLoc);
              setZoom(14);
            } else if (navigator.geolocation) {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  const c: [number, number] = [pos.coords.latitude, pos.coords.longitude];
                  setUserLoc(c);
                  setCenter(c);
                  setZoom(14);
                },
                (err) => {
                  alert("No pudimos obtener tu ubicación. Revisa los permisos de tu navegador.");
                  console.warn(err);
                },
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
              );
            }
          }}
          className="absolute z-[400] top-3 right-3 bg-background/80 backdrop-blur-md px-3 py-2 rounded-xl border border-border/50 text-xs font-medium hover:bg-background shadow-lg flex items-center gap-1.5 transition-all hover:scale-105"
          title="Centrar en mi ubicación"
        >
          <MapPin className="w-4 h-4 text-red-500 fill-red-500/20" /> Mi ubicación
        </button>

        {/* Route info overlay */}
        {routeInfo && (
          <div className="absolute z-[400] bottom-3 left-3 bg-background/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-primary/30 shadow-lg flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-3 h-0.5 bg-blue-500 rounded-full" />
              <span className="font-semibold text-foreground">{routeInfo.distanceKm.toFixed(1)} km</span>
            </div>
            <div className="w-px h-4 bg-border/50" />
            <div className="text-xs text-muted-foreground">
              ~{routeInfo.durationMin} min en auto
            </div>
          </div>
        )}

        {/* Nearby taxis count */}
        {nearbyTaxis && nearbyTaxis.length > 0 && (
          <div className="absolute z-[400] bottom-3 right-3 bg-background/90 backdrop-blur-md px-3 py-2 rounded-xl border border-yellow-500/30 shadow-lg flex items-center gap-2 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500" />
            </span>
            <span className="font-semibold text-foreground">{nearbyTaxis.length} taxis</span>
            <span className="text-muted-foreground">cerca</span>
          </div>
        )}
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          {initializing ? 'Obteniendo ubicación…' : 'Ubicación no disponible'}
        </div>
      )}
    </div>
  );
}
