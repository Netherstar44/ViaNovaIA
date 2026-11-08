import { lazy, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, PanelsTopLeft } from 'lucide-react';

const Viewer360 = lazy(() =>
  import('@/components/media/Viewer360').then((module) => ({ default: module.Viewer360 })),
);
const Viewer3D = lazy(() => import('@/components/media/Viewer3D').then(module => ({ default: module.Viewer3D })));

interface VRViewerProps {
  mode: 'product' | 'interior';
  onClose: () => void;
  /** Equirectangular 2:1 panorama uploaded by the provider. */
  panoramaUrl?: string | null;
  panoramaCaption?: string;
  modelUrl?: string | null;
  modelCaption?: string;
}

/**
 * Interior mode renders a real equirectangular panorama with the same viewer
 * used by the product gallery. When the provider has not uploaded one yet we
 * say so instead of showing a fake room.
 */
export default function VRViewer({ mode, onClose, panoramaUrl, panoramaCaption, modelUrl, modelCaption }: VRViewerProps) {
  const hasPanorama = Boolean(panoramaUrl);

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden rounded-xl bg-black/90">
      <div className="relative z-30 flex shrink-0 flex-wrap items-center gap-2 bg-card px-3 py-3 pr-12 sm:px-4 sm:pr-14">
        <div className="liquid-glass-chip flex items-center rounded-full px-3 py-1 text-xs text-[#1f1f1f]">
          {mode === 'product' ? 'Vista previa 3D' : 'Panorama 360°'}
        </div>
        <Button
          onClick={onClose}
          variant="destructive"
          size="sm"
          className="rounded-full px-4 text-xs font-bold"
        >
          Cerrar visor
        </Button>
      </div>

      <div className="relative min-h-0 flex-1">
      {mode === 'interior' ? (
        hasPanorama ? (
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center gap-2 bg-black text-sm text-white/80">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando panorama 360°…
              </div>
            }
          >
            <Viewer360 url={panoramaUrl as string} caption={panoramaCaption} />
          </Suspense>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0b1220] px-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary-ink">
              <PanelsTopLeft className="h-7 w-7" />
            </span>
            <div className="space-y-1.5">
              <p className="text-base font-semibold text-white">Aún no hay panorama 360° verificado</p>
              <p className="max-w-sm text-sm text-white/70">
                Este proveedor todavía no ha subido una foto equirectangular 2:1 de su espacio.
                Pídesela desde el chat y la verás aquí, sin montajes ni esferas de relleno.
              </p>
            </div>
            <Button onClick={onClose} className="rounded-full">
              Volver al detalle
            </Button>
          </div>
        )
      ) : modelUrl ? <Suspense fallback={<div role="status" className="flex h-full items-center justify-center text-white">Cargando modelo 3D…</div>}><Viewer3D src={modelUrl} alt={modelCaption ?? "Modelo 3D publicado"} /></Suspense>
        : <div className="flex h-full items-center justify-center px-6 text-center text-white">Este servicio todavía no tiene un modelo 3D publicado.</div>}
      </div>
    </div>
  );
}
