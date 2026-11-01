import { lazy, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import { Button } from '@/components/ui/button';
import { Loader2, PanelsTopLeft } from 'lucide-react';

const Viewer360 = lazy(() =>
  import('@/components/media/Viewer360').then((module) => ({ default: module.Viewer360 })),
);

/**
 * Showroom model. It is an illustrative stand-in, never presented as the
 * real product: vendors upload real 3D assets through ProductManager.
 */
function ProductModel(props: any) {
  return (
    <group {...props}>
      <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.35}>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshStandardMaterial color="#ffbf00" roughness={0.35} metalness={0.15} />
        </mesh>
      </Float>
      <mesh position={[0, -0.85, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial color="#111827" roughness={1} />
      </mesh>
    </group>
  );
}

interface VRViewerProps {
  mode: 'product' | 'interior';
  onClose: () => void;
  /** Equirectangular 2:1 panorama uploaded by the provider. */
  panoramaUrl?: string | null;
  panoramaCaption?: string;
}

/**
 * Interior mode renders a real equirectangular panorama with the same viewer
 * used by the product gallery. When the provider has not uploaded one yet we
 * say so instead of showing a fake room.
 */
export default function VRViewer({ mode, onClose, panoramaUrl, panoramaCaption }: VRViewerProps) {
  const hasPanorama = Boolean(panoramaUrl);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black/90">
      <div className="absolute left-3 right-12 top-3 z-10 flex flex-wrap items-center gap-2 sm:left-4 sm:right-14 sm:top-4">
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
      ) : (
        <Canvas
          shadows
          dpr={[1, 2]}
          camera={{ position: [0, 0, 5], fov: 50 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={0.8} />
          <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow />
          <pointLight position={[-5, -2, -5]} intensity={0.5} />
          <ProductModel />
          <OrbitControls
            makeDefault
            enablePan={false}
            enableZoom
            minDistance={3}
            maxDistance={9}
          />
        </Canvas>
      )}

      {mode === 'product' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center px-6">
          <p className="rounded-full bg-black/55 px-3 py-1.5 text-center text-[11px] text-white/80">
            Modelo ilustrativo. Arrastra para girarlo.
          </p>
        </div>
      )}
    </div>
  );
}
