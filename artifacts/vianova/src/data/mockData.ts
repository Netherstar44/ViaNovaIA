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
  price?: number;
  schedule?: string;
  roomService?: boolean;
  roomServiceSchedule?: string;
  hasVR?: boolean;
  hasAR?: boolean;
  contact?: string;
  parentHotelId?: string | null;
  foodCategories?: string[];
  mediaGallery?: { images: string[] };
  googleMapsUrl?: string;
  menuData?: {
    categories?: {
      id: string;
      name: string;
      items: { id: string; name: string; price: number; description?: string; available: boolean }[];
    }[];
    pdfUrl?: string;
    imageUrl?: string;
  };
}

// All locations are loaded from the API (real DB data).
// This array is kept empty so the app uses only real data.
export const locations: LocationItem[] = [];
