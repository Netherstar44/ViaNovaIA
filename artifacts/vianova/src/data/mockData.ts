export interface LocationItem {
  id: string;
  name: string;
  category: 'restaurant' | 'hotel' | 'recreation' | 'transport';
  description: string;
  image: string;
  coordinates: [number, number];
  rating: number;
  city?: string;
  priceRange?: string;
  hasVR?: boolean;
  hasAR?: boolean;
  contact?: string;
  parentHotelId?: string | null;
}

// All locations are loaded from the API (real DB data).
// This array is kept empty so the app uses only real data.
export const locations: LocationItem[] = [];
