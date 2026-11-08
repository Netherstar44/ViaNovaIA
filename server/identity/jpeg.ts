// Parse JPEG SOF without allocating a decoded bitmap. No EXIF or filenames trusted.
export function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes[0] !== 255 || bytes[1] !== 216) return null;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i++] !== 255) return null;
    while (bytes[i] === 255) i++;
    const marker = bytes[i++];
    if (marker === 217 || marker === 218) return null;
    if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const length = bytes[i] * 256 + bytes[i + 1];
    if (length < 2 || i + length > bytes.length) return null;
    if ([192, 193, 194].includes(marker)) return { height: bytes[i + 3] * 256 + bytes[i + 4], width: bytes[i + 5] * 256 + bytes[i + 6] };
    i += length;
  }
  return null;
}
