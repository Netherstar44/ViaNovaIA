import React, { useEffect } from 'react';

interface Viewer3DProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
}

export function Viewer3D({ src, alt = "3D Model", poster, className = "" }: Viewer3DProps) {
  useEffect(() => {
    import('@google/model-viewer').catch(() => {});
  }, []);

  return (
    <div className={`relative w-full h-full bg-black/20 flex items-center justify-center overflow-hidden ${className}`}>
      {React.createElement('model-viewer', {
        src,
        alt,
        poster,
        'auto-rotate': true,
        'camera-controls': true,
        'shadow-intensity': '1',
        class: 'w-full h-full outline-none',
        style: { width: '100%', height: '100%' }
      })}
    </div>
  );
}
