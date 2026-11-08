// Tipos del catálogo recibido de la API. No incluye registros de demostración.
export interface LocationItem {
  id: string;
  name: string;
  category: 'restaurant' | 'hotel' | 'recreation' | 'transport';
  description: string;
  image: string;
  coordinates: [number, number];
  rating: number;
  priceRange?: string;
  hasVR?: boolean;
  hasAR?: boolean;
  /** Real equirectangular 2:1 panorama uploaded by the provider. */
  panoramaUrl?: string | null;
  panoramaCaption?: string;
  modelUrl?: string | null;
  media?: import("@shared/catalog-media").CatalogMedia[];
  contact?: string;
  parentHotelId?: string | null;
  responsibleVerified?: boolean;
}

