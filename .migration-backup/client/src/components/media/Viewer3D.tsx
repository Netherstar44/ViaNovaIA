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
