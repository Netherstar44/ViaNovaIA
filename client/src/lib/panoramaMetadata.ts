export function gpanoPacket(width: number, height: number, coverage: number): string {
  return `<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:GPano="http://ns.google.com/photos/1.0/panorama/" xmlns:ViaNova="https://vianova.local/ns/panorama/1.0/" GPano:ProjectionType="equirectangular" GPano:UsePanoramaViewer="True" GPano:FullPanoWidthPixels="${width}" GPano:FullPanoHeightPixels="${height}" GPano:CroppedAreaImageWidthPixels="${width}" GPano:CroppedAreaImageHeightPixels="${height}" GPano:CroppedAreaLeftPixels="0" GPano:CroppedAreaTopPixels="0" ViaNova:CoveragePercent="${Math.max(0, Math.min(100, coverage)).toFixed(2)}" ViaNova:Source="guided-sphere-v1"/></rdf:RDF></x:xmpmeta>`;
}
export function withGpano(jpeg: Uint8Array, width: number, height: number, coverage: number): Uint8Array {
  if (jpeg[0] !== 255 || jpeg[1] !== 216) throw new Error("El archivo debe ser JPEG.");
  const packet = new TextEncoder().encode(`http://ns.adobe.com/xap/1.0/\0${gpanoPacket(width, height, coverage)}`);
  const length = packet.length + 2;
  const out = new Uint8Array(jpeg.length + packet.length + 4);
  out.set(jpeg.subarray(0, 2)); out.set([255, 225, length >> 8, length & 255], 2); out.set(packet, 6); out.set(jpeg.subarray(2), packet.length + 6);
  return out;
}
export function readSphereMetadata(bytes: Uint8Array): { coverage: number | null; guided: boolean } {
  // Bounded header only. Metadata is untrusted and is never inserted into HTML.
  const header = new TextDecoder().decode(bytes.subarray(0, 128 * 1024));
  const match = header.match(/ViaNova:CoveragePercent="([\d.]+)"/);
  const coverage = match ? Number(match[1]) : NaN;
  return { coverage: Number.isFinite(coverage) && coverage >= 0 && coverage <= 100 ? coverage : null, guided: header.includes('ViaNova:Source="guided-sphere-v1"') };
}
