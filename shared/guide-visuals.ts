/**
 * Editorial art direction for the public travel guides.
 *
 * Shared by the React pages and the static prerenderer so the first paint and
 * the hydrated page use the same imagery, copy and crop. Every asset is a real
 * Colombian photograph stored locally, so the guides do not depend on a
 * third-party image CDN or an AI-generated placeholder.
 */

export type GuideVisual = {
  /** Wide crop used for hero art. */
  image: string;
  /** Small crop used by the guide index rows. */
  thumb: string;
  alt: string;
  /** Short editorial label; never rendered as a pill. */
  kicker: string;
  /** Place / reading hint shown next to the label. */
  place: string;
};

const local = (name: string) => `/images/colombia/${name}.webp`;

export const guideVisuals: Record<string, GuideVisual> = {
  "planificador-viajes-ia": {
    image: local("salento"),
    thumb: local("salento-thumb"),
    alt: "Calle de Salento con casas de colores y balcones de madera.",
    kicker: "Planificación",
    place: "Colombia · 8 min",
  },
  "viajes-colombia": {
    image: local("cartagena"),
    thumb: local("cartagena-thumb"),
    alt: "Calle colonial de Cartagena con balcones de colores y flores.",
    kicker: "Destinos",
    place: "Colombia · 12 min",
  },
  "que-hacer-en-neiva": {
    image: local("tatacoa"),
    thumb: local("tatacoa-thumb"),
    alt: "Formaciones de arena rojiza bajo un cielo abierto en la Tatacoa.",
    kicker: "Huila",
    place: "Neiva · 10 min",
  },
  "comparar-trivago-airbnb": {
    image: local("hotel-huila"),
    thumb: local("hotel-huila-thumb"),
    alt: "Fachada de un hotel tradicional en el Huila.",
    kicker: "Comparativa",
    place: "Alojamiento · 9 min",
  },
};

const fallbackVisual: GuideVisual = {
  image: local("cocora-hero"),
  thumb: local("cocora-hero-thumb"),
  alt: "Palmas de cera gigantes en el verde del Valle del Cocora.",
  kicker: "Guías",
  place: "Colombia · 10 min",
};

export function guideVisual(slug: string): GuideVisual {
  return guideVisuals[slug] ?? fallbackVisual;
}

/** Small crop for index rows; the card art keeps the full-width version. */
export function guideThumb(slug: string): string {
  return guideVisual(slug).thumb;
}
