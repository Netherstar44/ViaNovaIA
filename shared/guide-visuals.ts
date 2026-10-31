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

/**
 * Responsive sources generated next to each hero (see
 * `client/public/images/colombia`). AVIF is ~55-70% smaller than the WebP
 * fallback; the 900w variant covers phones without shipping the full crop.
 */
const heroWidths: Record<string, number> = {
  "/images/colombia/salento.webp": 1400,
  "/images/colombia/cartagena.webp": 1400,
  "/images/colombia/tatacoa.webp": 1400,
  "/images/colombia/hotel-huila.webp": 1200,
  "/images/colombia/cocora-hero.webp": 1920,
};

export type GuideHeroSources = {
  avif: string;
  avifSrcSet: string;
  webpSrcSet: string;
  sizes: string;
};

export function guideHeroSources(image: string): GuideHeroSources {
  const base = image.replace(/\.webp$/, "");
  const width = heroWidths[image] ?? 1400;
  return {
    avif: `${base}.avif`,
    avifSrcSet: `${base}-900.avif 900w, ${base}.avif ${width}w`,
    webpSrcSet: `${base}-900.webp 900w, ${image} ${width}w`,
    sizes: "(min-width: 900px) 46vw, 100vw",
  };
}

/** Small crop for index rows; the card art keeps the full-width version. */
export function guideThumb(slug: string): string {
  return guideVisual(slug).thumb;
}
