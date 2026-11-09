---
name: ViaNova SEO
description: Usar cuando se cree o edite una landing SEO, se añada contenido a shared/seo-content.ts, se toquen JSON-LD, sitemap, robots, llms.txt o el prerenderizado de vite-plugin-seo-pages.ts.
---

# ViaNova SEO

## Pipeline

1. El contenido vive en `shared/seo-content.ts` como objetos `SeoPage`.
2. `client/src/App.tsx` genera una ruta por cada `seoPages` y renderiza `client/src/pages/SeoLanding.tsx`.
3. `vite-plugin-seo-pages.ts` se ejecuta al cerrar el build (`seoPagesPlugin()` en `vite.config.ts`).
4. `generateSeoPages(outDir)` lee `dist/public/index.html` y escribe:
   - `dist/public/<slug>.html` (una página estática por slug)
   - `dist/public/sitemap.xml`
   - `dist/public/llms-full.txt`
5. `client/public/llms.txt` es el catálogo corto estático; `llms-full.txt` es la versión larga generada.
6. `client/public/robots.txt` y `client/public/sitemap.xml` existen como base; el build regenera el sitemap en `dist/public`.

## Estructura de una página

```ts
export type SeoPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  intro: string;
  keywords: string[];
  sections: { heading: string; paragraphs: string[]; bullets?: string[] }[];
  faqs: { question: string; answer: string }[];
  related: { href: string; label: string; description: string }[];
  destination?: {
    name: string;
    region: string;
    latitude: number;
    longitude: number;
    attractions: string[];
  };
};
```

Si `destination` existe, el plugin emite JSON-LD de `TouristDestination` + `TouristAttraction`. El resto de páginas recibe el grafo base y el JSON-LD de ruta.

## Añadir una landing

1. Añade un objeto al array `seoPages` en `shared/seo-content.ts`.
2. Usa un `slug` único, en kebab-case y sin barras.
3. Escribe `title` (≤ 60 caracteres útil), `description` (≈ 150–160), `h1`, `intro`, `sections` y `faqs` con contenido real y específico.
4. Enlaza páginas relacionadas con `related`; usa rutas internas (`/slug`) o URLs absolutas.
5. Si la página describe un destino, rellena `destination` con coordenadas reales.
6. Actualiza `CONTENT_UPDATED` si cambió el contenido editorial.
7. Ejecuta `npm run build` y verifica los artefactos.

## Reglas

- **No inventes datos**: precios, reseñas, proveedores, coordenadas o atracciones deben ser reales o estar claramente marcados como ejemplo.
- No dupliques `slug`: `seoPageBySlug` es un `Map` y la última entrada gana.
- No publiques rutas privadas en el sitemap. Las rutas privadas llevan `X-Robots-Tag: noindex` en `vercel.json`.
- No edites archivos generados en `dist/`; edita la fuente y reconstruye.
- No uses `dangerouslySetInnerHTML` con contenido de usuario, de la IA o scrapeado.
- Mantén `SITE_URL` como dominio canónico. `SECONDARY_URL` es el espejo en Workers.
- Si añades una página, considera `npm run indexnow` después del despliegue.

## Verificación

```bash
npm run build
```

Comprueba:

- `dist/public/<slug>.html` existe y contiene el `<title>`, la meta description y el JSON-LD.
- `dist/public/sitemap.xml` incluye la URL nueva una sola vez.
- `dist/public/llms-full.txt` incluye el contenido largo.
- `npm test` sigue en verde (incluye `tests/deploy-config.test.ts`).
- En producción: la URL responde 200, canonical correcto y sin `noindex`.

## Errores frecuentes

| Síntoma | Causa |
| --- | --- |
| La página no aparece en el build | El slug no está en `seoPages` o el plugin no se ejecutó. |
| Sale HTML sin estilos | El template de `dist/public/index.html` no existía al generar. |
| Sitemap duplicado o viejo | Se editó `client/public/sitemap.xml` en vez de la fuente; el build lo regenera. |
| JSON-LD no aparece | `destination` mal formado o el plugin no llegó a `pageJsonLd`. |
| Ruta privada indexada | Falta `X-Robots-Tag` en `vercel.json` o se añadió al sitemap. |
