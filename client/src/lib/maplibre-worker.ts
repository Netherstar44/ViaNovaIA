import { setWorkerUrl } from 'maplibre-gl';
// MapLibre v6 loads its worker from `./maplibre-gl-worker.mjs` at runtime.
// Vite does not copy that file automatically, so import it as an asset and
// tell MapLibre where the hashed copy lives.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

setWorkerUrl(workerUrl);
