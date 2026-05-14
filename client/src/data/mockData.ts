import hotelImg from '@assets/generated_images/modern_luxury_hotel_exterior_with_pool.png';
import restaurantImg from '@assets/generated_images/cozy_italian_restaurant_interior.png';
import recreationImg from '@assets/generated_images/adventure_park_with_zip_lines.png';

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
  contact?: string;
  parentHotelId?: string | null;
}

// Datos de ejemplo — Neiva, Huila, Colombia
// Centro de referencia: ~2.9273°N, -75.2819°W (Parque Santander)
// Los lugares están distribuidos a distintas distancias para demostrar el filtro:
//   < 1 km  → 2 lugares  |  < 5 km → 5 lugares  |  < 10 km → 7 lugares  |  Todos → 8
export const locations: LocationItem[] = [

  // ─── DENTRO DE 1 KM (Centro de Neiva) ─────────────────────────────────────
  {
    id: 'h1',
    name: 'Hotel Plaza Neiva',
    category: 'hotel',
    description: 'Hotel boutique frente al Parque Santander, en el corazón de Neiva.',
    image: hotelImg,
    coordinates: [2.9280, -75.2810], // ~0.1 km del centro
    rating: 4.8,
    priceRange: '$$$'
  },
  {
    id: 'r1',
    name: 'Asadero El Huilense',
    category: 'restaurant',
    description: 'Auténtica gastronomía huilense: asado, tamal y bizcocho de achira en el centro.',
    image: restaurantImg,
    coordinates: [2.9260, -75.2830], // ~0.2 km del centro
    rating: 4.7,
    priceRange: '$$',
    hasVR: true,
    hasAR: true
  },

  // ─── ENTRE 1 Y 5 KM ──────────────────────────────────────────────────────
  {
    id: 'h2',
    name: 'Hotel Chicalá Real',
    category: 'hotel',
    description: 'Confort moderno con piscina, al norte de Neiva cerca del río Magdalena.',
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&q=80&w=800',
    coordinates: [2.9380, -75.2720], // ~1.6 km del centro
    rating: 4.5,
    priceRange: '$$'
  },
  {
    id: 'r2',
    name: 'Restaurante La Casona del Río',
    category: 'restaurant',
    description: 'Cocina fusión con ingredientes del Huila y vista al Malecón del Magdalena.',
    image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&q=80&w=800',
    coordinates: [2.9400, -75.2650], // ~2.3 km del centro
    rating: 4.6,
    priceRange: '$$$',
    hasVR: true
  },
  {
    id: 'rec1',
    name: 'Parque Isla — Centro Recreacional',
    category: 'recreation',
    description: 'Parque natural con senderos, piscinas y actividades al aire libre.',
    image: recreationImg,
    coordinates: [2.9500, -75.2600], // ~3.5 km del centro
    rating: 4.9
  },

  // ─── ENTRE 5 Y 10 KM ─────────────────────────────────────────────────────
  {
    id: 'rec2',
    name: 'Museo Paleontológico de Neiva',
    category: 'recreation',
    description: 'Fósiles del Desierto de la Tatacoa y arte precolombino del Huila.',
    image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?auto=format&fit=crop&q=80&w=800',
    coordinates: [2.9750, -75.2500], // ~6.4 km del centro
    rating: 4.7
  },
  {
    id: 't1',
    name: 'Taxi Rápido Neiva — Terminal',
    category: 'transport',
    description: 'Servicio 24/7 desde la Terminal de Transportes de Neiva.',
    image: 'https://images.unsplash.com/photo-1600320254374-ce2d293c324e?auto=format&fit=crop&q=80&w=800',
    coordinates: [2.9800, -75.3200], // ~7.2 km del centro
    rating: 4.8,
    contact: '+57 310 456 7890'
  },

  // ─── MÁS DE 10 KM ────────────────────────────────────────────────────────
  {
    id: 't2',
    name: 'Transfer al Desierto de la Tatacoa',
    category: 'transport',
    description: 'Transporte turístico al Desierto de la Tatacoa y observatorio astronómico.',
    image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800',
    coordinates: [3.2300, -75.1700], // ~36 km del centro (Tatacoa)
    rating: 5.0,
    contact: '+57 315 987 6543'
  }
];
