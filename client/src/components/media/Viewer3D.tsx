import React from 'react';

// model-viewer needs to be imported to register the web component
import '@google/model-viewer';

interface Viewer3DProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
}

export function Viewer3D({ src, alt = "3D Model", poster, className = "" }: Viewer3DProps) {
  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-black/20 ${className}`}>
      {React.createElement('model-viewer', {
        src,
        alt,
        poster,
        'auto-rotate': true,
        'camera-controls': true,
        'shadow-intensity': '1',
        class: 'block h-full w-full outline-none',
        style: { width: '100%', height: '100%' }
      })}
    </div>
  );
}
