export function CatalogImage({ src, alt, className = "" }: { src?: string | null; alt?: string; className?: string }) {
  return src ? <img src={src} alt={alt ?? "Fotografía del servicio"} loading="lazy" decoding="async" className={className} />
    : <div role="img" aria-label="Sin fotografía publicada" className={`flex items-center justify-center bg-secondary text-muted-foreground ${className}`}><span className="px-3 text-center text-sm">Sin fotografía publicada</span></div>;
}
