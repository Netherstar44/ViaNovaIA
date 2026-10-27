import { Canvas } from '@react-three/fiber';
import { OrbitControls, Float } from '@react-three/drei';
import { BackSide } from 'three';
import { Button } from '@/components/ui/button';

function ProductModel(props: any) {
  return (
    <group {...props}>
      <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.35}>
        <mesh castShadow receiveShadow position={[0, 0, 0]}>
          <boxGeometry args={[1.2, 1.2, 1.2]} />
          <meshStandardMaterial color="hotpink" roughness={0.4} metalness={0.1} />
        </mesh>
      </Float>
      <mesh position={[0, -0.85, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.6, 48]} />
        <meshStandardMaterial color="#111827" roughness={1} />
      </mesh>
    </group>
  );
}

function InteriorScene() {
  return (
    <>
      <color attach="background" args={["#0b1220"]} />
      <mesh>
        <sphereGeometry args={[8, 32, 32]} />
        <meshBasicMaterial color="#16233d" side={BackSide} />
      </mesh>
      <mesh position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 64]} />
        <meshStandardMaterial color="#1f2937" roughness={0.95} />
      </mesh>
    </>
  );
}

interface VRViewerProps {
  mode: 'product' | 'interior';
  onClose: () => void;
}

export default function VRViewer({ mode, onClose }: VRViewerProps) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-black/90">
      <div className="absolute left-3 right-12 top-3 z-10 flex flex-wrap items-center gap-2 sm:left-4 sm:right-14 sm:top-4">
        <div className="flex items-center rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-md">
          {mode === 'product' ? 'Modo Producto' : 'Modo Interior 360°'}
        </div>
        <Button
          onClick={onClose}
          variant="destructive"
          size="sm"
          className="rounded-full px-4 text-xs font-bold"
        >
          Cerrar Visualizador
        </Button>
      </div>

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, 5], fov: 50 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.4} castShadow />
        <pointLight position={[-5, -2, -5]} intensity={0.5} />

        {/* Everything is generated locally: no remote HDR/environment fetch. */}
        {mode === 'product' ? <ProductModel /> : <InteriorScene />}

        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={mode === 'product'}
          minDistance={3}
          maxDistance={9}
          autoRotate={mode === 'interior'}
          autoRotateSpeed={0.4}
        />
      </Canvas>

      {mode === 'interior' && (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <span className="rounded-full bg-black/35 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur-sm">
            Vista 360°
          </span>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-10">
        <div className="rounded-lg bg-white/10 p-3 text-center text-sm text-white backdrop-blur-md">
          {mode === 'product'
            ? "Arrastra para rotar el producto. Haz clic para interactuar."
            : "Arrastra para mirar alrededor del interior."}
        </div>
      </div>
    </div>
  );
}
