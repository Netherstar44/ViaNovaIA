import { useCallback, useEffect, useRef, useState } from 'react';
import type { StyleSpecification } from 'maplibre-gl';
import { OSM_MAP_STYLE, VECTOR_MAP_STYLE_URL } from './map-style';

type MapStyle = string | StyleSpecification;

/**
 * Loads the OpenFreeMap vector style and falls back to the token-free OSM
 * raster if the style endpoint is unreachable. The fallback is applied at most
 * once so a single missing tile cannot swap a healthy vector map.
 */
export function useVectorMapStyle() {
  const [mapStyle, setMapStyle] = useState<MapStyle>(VECTOR_MAP_STYLE_URL);
  const fallbackApplied = useRef(false);

  const fallbackToOsm = useCallback(() => {
    if (fallbackApplied.current) return;
    fallbackApplied.current = true;
    setMapStyle(OSM_MAP_STYLE);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 7000);

    fetch(VECTOR_MAP_STYLE_URL, {
      signal: controller.signal,
      cache: 'force-cache',
      headers: { Accept: 'application/json' },
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      })
      .catch(() => {
        if (active) fallbackToOsm();
      })
      .finally(() => window.clearTimeout(timeout));

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [fallbackToOsm]);

  const handleMapError = useCallback(
    (event: unknown) => {
      const error = (event as {
        error?: { message?: string; url?: string; status?: number };
      } | null)?.error;
      const url = error?.url ?? '';
      const message = error?.message ?? '';

      // A missing tile should not take down the whole vector basemap; a failed
      // style request should.
      if (!fallbackApplied.current && (/\/styles\//.test(url) || /style/i.test(message))) {
        fallbackToOsm();
        return;
      }

      if (import.meta.env.DEV) {
        console.warn('[map]', message || event);
      }
    },
    [fallbackToOsm],
  );

  return { mapStyle, handleMapError };
}
