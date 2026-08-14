import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stage, Environment, Text, Float } from '@react-three/drei';
import { useRef, useState } from 'react';
import { Mesh } from 'three';
import { Button } from '@/components/ui/button';

function ProductModel(props: any) {
  return (
    <group {...props}>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshStandardMaterial color="hotpink" roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}

function InteriorSphere() {
   return (
     <mesh>
       <sphereGeometry args={[5, 32, 32]} />
       <meshStandardMaterial color="#87ceeb" side={2} /> {/* DoubleSide to see inside */}
     </mesh>
   )
}

interface VRViewerProps {
  mode: 'product' | 'interior';
  onClose: () => void;
}

export default function VRViewer({ mode, onClose }: VRViewerProps) {
  return (
    <div className="relative h-full w-full bg-black/90 rounded-xl overflow-hidden">
      <div className="absolute top-4 right-4 z-10 flex gap-2">
         <div className="bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-md flex items-center">
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
      
      <Canvas shadows camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
        <pointLight position={[-10, -10, -10]} />
        
        {mode === 'product' ? (
          <Stage environment="city" intensity={0.6} adjustCamera={false}>
            <ProductModel />
          </Stage>
        ) : (
           <group>
             <Environment preset="apartment" background />
             <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
             <Text 
                position={[0, 0, -2]} 
                fontSize={0.5} 
                color="white"
                anchorX="center" 
                anchorY="middle"
             >
               Vista 360°
             </Text>
           </group>
        )}
        <OrbitControls makeDefault />
      </Canvas>
      
      <div className="absolute bottom-4 left-4 right-4 z-10">
         <div className="bg-white/10 backdrop-blur-md rounded-lg p-3 text-white text-sm text-center">
            {mode === 'product' 
               ? "Arrastra para rotar el producto. Haz clic para interactuar." 
               : "Arrastra para mirar alrededor del interior."}
         </div>
      </div>
    </div>
  );
}
