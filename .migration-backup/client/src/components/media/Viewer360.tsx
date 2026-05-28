import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Loader2 } from 'lucide-react';

function SphereImage({ url }: { url: string }) {
  const texture = useTexture(url);
  return (
    <Sphere args={[500, 60, 40]}>
      <meshBasicMaterial map={texture} side={THREE.BackSide} />
    </Sphere>
  );
}

export function Viewer360({ url, className = "" }: { url: string; className?: string }) {
  return (
    <div className={`relative w-full h-full bg-black cursor-move ${className}`}>
      <Suspense fallback={
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }>
        <Canvas camera={{ position: [0, 0, 0.1] }}>
          <OrbitControls 
            enableZoom={false} 
            enablePan={false} 
            enableDamping 
            dampingFactor={0.05} 
            autoRotate 
            autoRotateSpeed={0.5} 
            rotateSpeed={-0.5}
          />
          <SphereImage url={url} />
        </Canvas>
      </Suspense>
      <div className="absolute bottom-4 right-4 z-20 pointer-events-none">
        <div className="bg-black/50 backdrop-blur-sm text-white/80 px-3 py-1.5 rounded-full text-xs flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9m-9 9a9 9 0 0 1 9-9"/></svg>
          360°
        </div>
      </div>
    </div>
  );
}
