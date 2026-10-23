export type LatLng = [number, number];

export function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidLatLng(lat: unknown, lng: unknown): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

export function isValidCoordinatePair(coords: unknown): coords is LatLng {
  return (
    Array.isArray(coords) &&
    coords.length >= 2 &&
    isValidLatLng(coords[0], coords[1])
  );
}

/**
 * Coordinates (0, 0) are valid on Earth, but in this app they almost always
 * mean "the provider did not set a location". Keep them out of maps and
 * distance calculations so markers do not pile up in the Gulf of Guinea.
 */
export function isUsableCoordinatePair(coords: unknown): coords is LatLng {
  return isValidCoordinatePair(coords) && !(coords[0] === 0 && coords[1] === 0);
}

export function parseCoordinate(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
