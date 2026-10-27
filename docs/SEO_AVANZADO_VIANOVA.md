# SEO avanzado — VIANova IA

Fecha de implementación: 27 de octubre de 2026
Dominio canónico: `https://via-nova-ia.vercel.app`
Dominio secundario: `https://vianova.netherstar44.workers.dev`

## 1. Resumen ejecutivo

Se implementó una capa SEO técnica completa sobre la SPA React:

- Metadatos únicos por ruta (título, descripción, canonical, robots, Open Graph y Twitter Cards).
- Cuatro guías públicas con contenido real, prerenderizadas a HTML estático en el build.
- Datos estructurados JSON-LD: `Organization`, `WebSite`, `SoftwareApplication`, `WebPage`, `Article`, `BreadcrumbList`, `FAQPage` y `TouristDestination`.
- `robots.txt`, `sitemap.xml`, `llms.txt`, imagen Open Graph 1200×630 y manifest PWA enriquecido.
- Estrategia de un solo canonical para evitar contenido duplicado entre los dos dominios.
- `noindex` por cabecera `X-Robots-Tag` en rutas privadas, incluso antes de ejecutar JavaScript.
- Cabeceras de seguridad y caché en Vercel y Cloudflare.
- Enlazado interno desde la portada y desde las guías.

### Expectativa realista

No es posible garantizar posiciones 1–4 para términos como **“viajes”**, **“turismo”**, **“trivago”** o **“airbnb”**. Esos resultados están dominados por marcas globales con años de autoridad, millones de enlaces y búsquedas navegacionales. Cualquier agencia que prometa eso está mintiendo.

Lo que sí se puede construir con esta base:

1. Indexación correcta y sin canibalización.
2. Posiciones para **long-tail** de intención clara: “planificador de viajes con IA”, “qué hacer en Neiva”, “turismo en el Huila”, “cómo comparar Trivago y Airbnb”, “Desierto de la Tatacoa”.
3. Crecimiento sostenido con contenido, enlaces y señales de marca durante 6–12 meses.

## 2. Estrategia de dominios

| Dominio | Rol | Indexación |
|---|---|---|
| `via-nova-ia.vercel.app` | Canónico | `index, follow` |
| `vianova.netherstar44.workers.dev` | Espejo | `canonical` al dominio principal |

Ambos dominios sirven la misma aplicación. Sin canonical, Google vería dos copias y elegiría una por su cuenta. Ahora todas las páginas del dominio de Cloudflare declaran el canonical de Vercel.

### Por qué no indexar los dos

Dos dominios con el mismo contenido compiten entre sí (“canibalización”). El canonical concentra señales en una sola URL. No se activó un 301 desde `workers.dev` para no romper ese despliegue como fallback. Si quieres convertirlo en espejo puro:

```txt
# client/public/_redirects (solo Cloudflare)
https://vianova.netherstar44.workers.dev/* https://via-nova-ia.vercel.app/:splat 301
```

Solo hazlo si Vercel es la única versión que quieres en Google.

### Recomendación fuerte: dominio propio

`vercel.app` y `workers.dev` son subdominios compartidos de terceros. Para SEO serio conviene un dominio propio:

- `vianova.co`
- `vianova.com.co`
- `vianova.app`

Al comprarlo:

1. Añadirlo a Vercel como dominio principal.
2. Redirigir 301 los dos dominios actuales al dominio propio.
3. Cambiar `SITE_URL` y `SECONDARY_URL` en `shared/seo-content.ts`.
4. Actualizar `CORS_ALLOWED_ORIGINS`, `CLIENT_URL` y `PUBLIC_URL` en el entorno.
5. Volver a desplegar y reenviar el sitemap en Search Console.

## 3. URLs públicas creadas

| URL | Intención | Keyword principal |
|---|---|---|
| `/` | Producto | planificador de viajes con IA |
| `/planificador-viajes-ia` | Comercial / informativa | planificador de viajes con IA |
| `/viajes-colombia` | Planificación | viajes por Colombia |
| `/que-hacer-en-neiva` | Turismo local | qué hacer en Neiva |
| `/comparar-trivago-airbnb` | Comparación | Trivago vs Airbnb |
| `/explore` | Catálogo | explorar destinos |
| `/privacy` | Legal | privacidad |

Las cuatro guías se generan en el build como archivos `.html` con contenido visible antes de ejecutar React. Vercel las sirve con `cleanUrls`; Cloudflare con `html_handling: auto-trailing-slash`.

## 4. Arquitectura implementada

### Fuente única de verdad

`shared/seo-content.ts` contiene:

- Dominio canónico, marca, imagen OG y fecha de actualización.
- Títulos, descripciones, keywords, secciones, FAQs y enlaces internos de cada guía.
- Metadatos de rutas públicas y privadas.
- Generadores de JSON-LD.

### Prerender en build

`vite-plugin-seo-pages.ts` se ejecuta al compilar y:

1. Lee `dist/public/index.html`.
2. Genera `dist/public/<slug>.html` con head único, JSON-LD y contenido estático.
3. Regenera `sitemap.xml` con la fecha del build.
4. Inyecta las verificaciones de Search Console/Bing si existen las variables de entorno.

El HTML estático se reemplaza por la app React al cargar. No hay cloaking: el contenido estático y el renderizado tratan el mismo tema y la misma URL.

### Navegación interna

`client/src/hooks/useSeo.ts` actualiza metadatos al navegar dentro de la SPA. `client/src/components/HomeSeoSection.tsx` enlaza las guías desde la portada y `client/src/components/SeoPage.tsx` las renderiza con navegación, tabla de contenidos, FAQs y pie.

### Rutas privadas

`X-Robots-Tag: noindex, nofollow` en Vercel y Cloudflare para:

`/login`, `/select-role`, `/dashboard`, `/admin`, `/settings`, `/my-products`, `/notifications`, `/messages`, `/social`, `/products`, `/taxi-dashboard`, `/taxi/*`, `/request-ride`, `/ride-history`, `/u/*`.

Además, `useSeo` retira el canonical y aplica `noindex` al navegar a esas rutas.

## 5. Verificación después del despliegue

### Comprobaciones rápidas

```bash
curl -I https://via-nova-ia.vercel.app/planificador-viajes-ia
curl -s https://via-nova-ia.vercel.app/robots.txt
curl -s https://via-nova-ia.vercel.app/sitemap.xml
curl -s https://via-nova-ia.vercel.app/planificador-viajes-ia | grep -E "canonical|<title>|FAQPage"
```

Comprobar en el navegador:

- `https://via-nova-ia.vercel.app/planificador-viajes-ia`
- `https://vianova.netherstar44.workers.dev/que-hacer-en-neiva` (debe declarar canonical de Vercel)
- `https://via-nova-ia.vercel.app/login` (debe responder `X-Robots-Tag: noindex`)

### Estado del despliegue (27 de octubre de 2026)

- Vercel producción: `https://via-nova-ia.vercel.app` — desplegado y verificado.
- Cloudflare Workers: `https://vianova.netherstar44.workers.dev` — desplegado y verificado.
- Las 4 guías responden `200` con HTML prerenderizado, un solo `<h1>`, canonical y JSON-LD.
- `/robots.txt`, `/sitemap.xml`, `/llms.txt` y `/og-image.png` responden `200` en ambos dominios.
- `/login` responde `200` con `X-Robots-Tag: noindex, nofollow` en ambos dominios.
- En Vercel, el rewrite catch-all debe apuntar a `/`, no a `/index.html`: con `cleanUrls: true`, `/index.html` responde `308` y el rewrite devuelve `404` en rutas profundas.

Pendiente de acción manual: verificar Google Search Console y Bing, enviar el sitemap y solicitar indexación. Sin los códigos de verificación no se pueden inyectar las etiquetas.

### Google Search Console

1. Añadir propiedad de tipo **Prefijo de URL**: `https://via-nova-ia.vercel.app/`.
2. Verificar por etiqueta HTML. El build inyecta la etiqueta si defines `GOOGLE_SITE_VERIFICATION` en Vercel (Production) y vuelves a desplegar. También acepta `VITE_GOOGLE_SITE_VERIFICATION`.
3. Enviar `https://via-nova-ia.vercel.app/sitemap.xml`.
4. Inspeccionar cada guía y pulsar **Solicitar indexación**.
5. Revisar “Páginas” tras 7–14 días.

### Bing Webmaster Tools

1. Añadir el dominio.
2. Verificar con `BING_SITE_VERIFICATION` (o `VITE_BING_SITE_VERIFICATION`).
3. Enviar el mismo sitemap.

### Validadores

- Rich Results Test: `https://search.google.com/test/rich-results`
- Schema Markup Validator: `https://validator.schema.org`
- PageSpeed Insights: `https://pagespeed.web.dev`

## 6. Palabras clave y expectativas

### Lo que se puede atacar primero

| Clúster | Ejemplos | Dificultad | Horizonte |
|---|---|---|---|
| Planificación con IA | planificador de viajes con IA, itinerario con IA, planificar viaje Colombia | Media | 3–6 meses |
| Turismo local | qué hacer en Neiva, turismo en el Huila, Tatacoa, termales de Rivera | Baja-media | 2–5 meses |
| Comparativas | Trivago vs Airbnb, cómo comparar alojamiento, precio final hotel | Media | 4–8 meses |
| Rutas | viajes por Colombia, ruta 7 días Colombia, qué visitar en Colombia | Alta | 9–18 meses |
| Marcas | trivago, airbnb | Navegacional | No realista a corto plazo |
| Genéricos | viajes, turismo | Muy alta | No realista a corto plazo |

### Por qué “trivago” y “airbnb” no son objetivo directo

Quien busca “airbnb” quiere entrar a Airbnb. Google muestra la marca porque resuelve la intención. Lo mismo con Trivago. La oportunidad real está en búsquedas comparativas y de decisión:

- “trivago vs airbnb”
- “cómo comparar hoteles y apartamentos”
- “airbnb o hotel para viajar en grupo”
- “alternativa a trivago para comparar”
- “precio final airbnb con cargos”
- “dónde reservar alojamiento en Neiva”

La página `/comparar-trivago-airbnb` ataca ese segundo grupo, no la marca pura.

## 7. Plan de contenidos (90 días)

Cada página debe tener datos reales, fotos propias o con licencia, autoría y enlaces internos. No publiques 50 páginas vacías: es la forma más rápida de que Google ignore el sitio.

| Semana | Página nueva | Keyword |
|---|---|---|
| 1 | `/destinos/desierto-de-la-tatacoa` | desierto de la Tatacoa |
| 1 | `/destinos/san-agustin` | San Agustín Huila |
| 2 | `/rutas/colombia-7-dias` | ruta Colombia 7 días |
| 2 | `/rutas/colombia-14-dias` | itinerario Colombia 14 días |
| 3 | `/presupuesto/viaje-colombia` | cuánto cuesta viajar a Colombia |
| 3 | `/guias/viajar-con-ninos-colombia` | viajar con niños Colombia |
| 4 | `/comparativas/airbnb-vs-booking` | Airbnb vs Booking |
| 4 | `/comparativas/trivago-vs-booking` | Trivago vs Booking |
| 5 | `/gastronomia/huila` | comida típica del Huila |
| 6 | `/destinos/cartagena` | qué hacer en Cartagena |
| 6 | `/destinos/eje-cafetero` | Eje Cafetero Colombia |
| 7 | `/guias/seguridad-viajar-colombia` | es seguro viajar a Colombia |

Para añadir una página:

1. Añade un objeto al array `seoPages` en `shared/seo-content.ts`.
2. Ejecuta `npm run build`.
3. La ruta React, el HTML estático, el sitemap y los enlaces internos se generan solos.
4. Verifica el canonical y solicita indexación.

## 8. Enlaces y autoridad

El contenido técnico no sustituye la autoridad. Sin enlaces, las guías no competirán.

Acciones legítimas:

- Perfil de Google Business si VIANova presta un servicio local verificable en Neiva (no inventes una dirección).
- Directorios de turismo y emprendimiento de Colombia.
- Cámaras de comercio, incubadoras y universidades.
- Alianzas con hoteles, restaurantes y operadores del Huila: ficha o enlace “planifica tu visita”.
- Notas de prensa locales sobre turismo con IA.
- Artículos invitados en medios de viajes.
- Entrevistas en podcasts y newsletters.
- Contenido compartible: presupuestos, mapas, comparativas, datos de temporada.

Evita:

- Compra de enlaces o PBN.
- Texto oculto o cloaking.
- Reseñas falsas.
- Páginas puerta con la misma plantilla y ciudades cambiadas.
- Keyword stuffing.

## 9. Core Web Vitals

Ya se optimizaron las tres imágenes locales principales de PNG a WebP (de ~5,7 MB a ~0,43 MB combinados) y se añadió `loading="lazy"` a las tarjetas.

Siguientes mejoras recomendadas:

1. Reducir el bundle inicial: `Home` y `Navbar` siguen siendo pesados. Medir con `vite-bundle-visualizer`.
2. Cargar la hoja de Leaflet solo cuando se monte el mapa.
3. Autoalojar Poppins/Inter o usar `font-display: swap` con subconjuntos latinos.
4. Añadir `width`/`height` o `aspect-ratio` a todas las imágenes para evitar CLS.
5. Precargar la imagen LCP real de la portada (hoy es una foto remota de Unsplash).
6. Revisar `sw.js` para no cachear HTML de forma agresiva.

## 10. Variables de entorno

| Variable | Uso |
|---|---|
| `GOOGLE_SITE_VERIFICATION` | Etiqueta de verificación de Google Search Console |
| `BING_SITE_VERIFICATION` | Etiqueta de verificación de Bing |
| `VITE_GOOGLE_SITE_VERIFICATION` | Alternativa pública para Google |
| `VITE_BING_SITE_VERIFICATION` | Alternativa pública para Bing |

Las verificaciones se inyectan en el build. Después de cambiarlas, hay que volver a desplegar.

### IndexNow (Bing, Yandex, Seznam)

El archivo `client/public/84f844541d60e9b000ccb51fc22f265d.txt` demuestra la propiedad del dominio. Para avisar a los buscadores de las URLs del sitemap:

```bash
npm run build
npm run indexnow
```

El script lee `dist/public/sitemap.xml`, filtra el dominio canónico y publica en `api.indexnow.org`. No sustituye a Google Search Console.

## 11. Archivos modificados o creados

- `client/index.html`
- `client/src/App.tsx`
- `client/src/hooks/useSeo.ts`
- `client/src/components/SeoPage.tsx`
- `client/src/components/HomeSeoSection.tsx`
- `client/src/pages/SeoLanding.tsx`
- `client/src/pages/not-found.tsx`
- `client/src/pages/Home.tsx`
- `client/src/i18n.ts`
- `client/src/data/mockData.ts`
- `client/src/components/CardItem.tsx`
- `client/public/robots.txt`
- `client/public/sitemap.xml`
- `client/public/llms.txt`
- `client/public/_headers`
- `client/public/og-image.png`
- `client/public/84f844541d60e9b000ccb51fc22f265d.txt`
- `scripts/indexnow.mjs`
- `client/public/manifest.json`
- `client/public/sw.js`
- `shared/seo-content.ts`
- `vite-plugin-seo-pages.ts`
- `vite.config.ts`
- `vercel.json`
- `wrangler.jsonc`
- `.gitignore`

## 12. Checklist de despliegue

- [x] `npx tsc --noEmit`
- [x] `npm run build`
- [x] Verificar `dist/public/*.html`, `sitemap.xml`, `robots.txt` y `og-image.png`
- [x] Desplegar Vercel
- [x] Desplegar Cloudflare
- [x] Comprobar canonical en ambos dominios
- [x] Comprobar `X-Robots-Tag` en `/login`
- [ ] Enviar sitemap a Google y Bing
- [ ] Solicitar indexación de las 5 URLs principales
- [ ] Validar JSON-LD en Rich Results Test
- [ ] Medir Core Web Vitals
- [ ] Empezar plan de contenidos y enlaces

## 13. Nota final

La parte técnica ya está resuelta. El resultado en posiciones depende de tres factores que no se configuran con código: autoridad del dominio, calidad y volumen de contenido, y señales externas. Para competir por “viajes” o “turismo” hará falta un dominio propio, meses de contenido y una estrategia de enlaces. Para las búsquedas long-tail de Neiva, Huila, Tatacoa y planificación con IA, esta base es la correcta para empezar a medir.
