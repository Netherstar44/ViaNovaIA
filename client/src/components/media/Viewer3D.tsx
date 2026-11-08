import React, { useEffect, useRef, useState } from 'react';

// model-viewer needs to be imported to register the web component
import '@google/model-viewer';

interface Viewer3DProps {
  src: string;
  alt?: string;
  poster?: string;
  className?: string;
}

export function Viewer3D({ src, alt = "3D Model", poster, className = "" }: Viewer3DProps) {
  const model = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState(false), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setLoaded(false); setFailed(false);
    const element = model.current;
    const onLoad = () => setLoaded(true), onError = () => setFailed(true);
    element?.addEventListener('load', onLoad); element?.addEventListener('error', onError);
    return () => { element?.removeEventListener('load', onLoad); element?.removeEventListener('error', onError); };
  }, [src, attempt]);
  return (
    <div aria-busy={!loaded && !failed} className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-black/20 ${className}`}>
      {React.createElement('model-viewer', {
        key: `${src}:${attempt}`,
        ref: model,
        src,
        alt,
        poster,
        'auto-rotate': true,
        'camera-controls': true,
        'shadow-intensity': '1',
        class: 'block h-full w-full outline-none',
        style: { width: '100%', height: '100%' }
      })}
      {!loaded && !failed && <p role="status" className="pointer-events-none absolute bottom-4 rounded bg-black/80 px-3 py-2 text-sm text-white">Cargando modelo 3D publicado…</p>}
      {failed && <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background p-5 text-center text-foreground"><p>No se pudo cargar el modelo 3D. Revisa la conexión o el archivo publicado.</p><button onClick={() => setAttempt(n => n + 1)} className="rounded border border-border px-4 py-2">Reintentar</button></div>}
    </div>
  );
}
