import type { StyleSpecification } from 'maplibre-gl';

/**
 * Vector basemap with real terrain shading, labels and points of interest.
 * OpenFreeMap serves it without an API key; the style already carries the
 * OpenStreetMap attribution required by the tiles.
 */
export const VECTOR_MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

/** Dark companion for dark palettes, kept for future themed maps. */
export const VECTOR_MAP_STYLE_DARK_URL = 'https://tiles.openfreemap.org/styles/dark';

/**
 * Token-free OpenStreetMap raster basemap used as a resilient fallback when
 * the vector style or its tiles cannot be reached.
 *
 * OSM's public tile server is fine for local development and small apps.
 * For high-traffic production use, replace this source with your own tile
 * provider (MapTiler, Stadia, Protomaps, etc.) and keep the attribution.
 */
export const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export const OSM_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      minzoom: 0,
      maxzoom: 19,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [
    {
      id: 'openstreetmap',
      type: 'raster',
      source: 'openstreetmap',
    },
  ],
};
