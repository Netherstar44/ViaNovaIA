import type { StyleSpecification } from 'maplibre-gl';

/**
 * Token-free OpenStreetMap raster basemap.
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
