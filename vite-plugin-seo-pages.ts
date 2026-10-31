import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  CONTENT_UPDATED,
  SITE_URL,
  absoluteUrl,
  baseGraph,
  jsonLdScript,
  pageJsonLd,
  pagePath,
  seoPages,
  type SeoPage,
} from "./shared/seo-content";
import { guideThumb, guideVisual } from "./shared/guide-visuals";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugifyHeading(value: string, index: number): string {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "seccion"}-${index + 1}`;
}

function verificationTags(): string {
  // Tokens públicos de verificación de buscadores. No son secretos.
  const google =
    process.env.GOOGLE_SITE_VERIFICATION ||
    process.env.VITE_GOOGLE_SITE_VERIFICATION ||
    "YG7IZrSM9mL6VVBcMZn3w4bjMzKqU10vgEH-lkLXtFM";
  const bing =
    process.env.BING_SITE_VERIFICATION ||
    process.env.VITE_BING_SITE_VERIFICATION ||
    "28459F182F4433434EF7E43823CB0289";
  return [
    google ? `<meta name="google-site-verification" content="${escapeHtml(google)}" />` : "",
    bing ? `<meta name="msvalidate.01" content="${escapeHtml(bing)}" />` : "",
  ]
    .filter(Boolean)
    .join("\n  ");
}

function renderHead(page: SeoPage): string {
  const url = absoluteUrl(pagePath(page.slug));
  const visual = guideVisual(page.slug);
  // Share cards use the same art as the page hero, cropped to 1200x630.
  const ogImage = visual.image.replace("w=1800", "w=1200&h=630");
  const jsonLd = [
    `<script type="application/ld+json">${jsonLdScript(baseGraph())}</script>`,
    `<script type="application/ld+json" id="seo-route-jsonld">${jsonLdScript(pageJsonLd(page))}</script>`,
  ].join("\n  ");

  return `<!-- SEO:START -->
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="keywords" content="${escapeHtml(page.keywords.join(", "))}" />
  <meta name="author" content="VIANova" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="VIANova" />
  <meta property="og:locale" content="es_CO" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(page.h1)}" />
  <meta property="article:modified_time" content="${CONTENT_UPDATED}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <meta name="twitter:image:alt" content="${escapeHtml(page.h1)}" />

  <link rel="preload" as="image" href="${escapeHtml(visual.image)}" fetchpriority="high" />

  ${verificationTags()}
  ${jsonLd}
  <style>
    #seo-prerender{--ink:#1f1e1a;--muted:#555147;--soft:#6a655a;--faint:#8a8578;--line:#ddd7c8;--hair:#e4dfd2;--gold:#ffbf00;--gold-ink:#7d5e12;--bg:#f5f4f0;background:var(--bg);background-image:radial-gradient(48rem 30rem at 6% -14%,rgba(255,191,0,.15),transparent 64%),radial-gradient(42rem 26rem at 92% 4%,rgba(255,255,255,.95),transparent 62%);color:var(--ink);font-family:Inter,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.7;min-height:100vh;-webkit-font-smoothing:antialiased}
    #seo-prerender *{box-sizing:border-box}
    #seo-prerender a{color:inherit}
    #seo-prerender .seo-wrap{max-width:1200px;margin:0 auto;padding:0 20px}
    #seo-prerender .seo-display{font-family:Poppins,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;font-weight:600;letter-spacing:-.035em}
    #seo-prerender .seo-header{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.62);border-bottom:1px solid rgba(80,72,50,.12);backdrop-filter:blur(22px) saturate(1.7);-webkit-backdrop-filter:blur(22px) saturate(1.7)}
    #seo-prerender .seo-header .seo-wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px}
    #seo-prerender .seo-brand{display:flex;align-items:center;gap:10px;color:var(--ink);text-decoration:none;font-family:Poppins,sans-serif;font-weight:700;font-size:17px}
    #seo-prerender .seo-brand img{width:32px;height:32px;border-radius:8px}
    #seo-prerender .seo-nav{display:flex;gap:24px;flex-wrap:wrap;font-size:12.5px;font-weight:500}
    #seo-prerender .seo-nav a{color:#79746a;text-decoration:none}
    #seo-prerender .seo-nav a:hover{color:var(--ink)}
    #seo-prerender .seo-app{display:inline-block;background:var(--gold);color:#161200;text-decoration:none;font-weight:600;font-size:12.5px;padding:9px 14px;border-radius:8px;box-shadow:0 8px 20px -12px rgba(196,143,0,.9)}
    #seo-prerender .seo-hero{position:relative;border-bottom:1px solid var(--hair);padding:48px 0 56px;overflow:hidden}
    #seo-prerender .seo-hero-grid{display:grid;grid-template-columns:minmax(0,1.06fr) minmax(0,.94fr);gap:56px;align-items:center}
    #seo-prerender .seo-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
    #seo-prerender .seo-crumb{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--faint);margin-bottom:30px}
    #seo-prerender .seo-crumb a{text-decoration:none}
    #seo-prerender .seo-eyebrow{display:flex;align-items:center;gap:12px;margin:0;color:var(--gold-ink);font-size:10.5px;font-weight:600;letter-spacing:.28em;text-transform:uppercase}
    #seo-prerender .seo-eyebrow:before{content:"";width:32px;height:1px;background:var(--gold)}
    #seo-prerender h1{max-width:20ch;margin:18px 0 0;color:var(--ink);font-size:clamp(34px,4.6vw,58px);line-height:1.04;letter-spacing:-.04em}
    #seo-prerender .seo-title-tail{display:block;color:var(--gold-ink)}
    #seo-prerender .seo-lead{max-width:620px;margin:22px 0 0;font-size:15.5px;line-height:1.8;color:var(--muted)}
    #seo-prerender .seo-actions{display:flex;align-items:center;flex-wrap:wrap;gap:24px;margin-top:30px}
    #seo-prerender .seo-btn{display:inline-block;border-radius:10px;padding:12px 20px;font-weight:600;font-size:13.5px;text-decoration:none;background:var(--gold);color:#161200;box-shadow:0 14px 30px -18px rgba(196,143,0,.9)}
    #seo-prerender .seo-btn:hover{background:#ffd34d}
    #seo-prerender .seo-btn-out{background:none;border:0;border-bottom:1px solid #c9c2b1;border-radius:0;padding:0 0 5px;color:var(--muted);box-shadow:none}
    #seo-prerender .seo-meta{display:flex;gap:18px;flex-wrap:wrap;margin-top:32px;padding-top:18px;border-top:1px solid var(--hair);color:var(--faint);font-size:11.5px}
    #seo-prerender .seo-figure{position:relative;margin:0;overflow:hidden;border-radius:28px;border:1px solid rgba(255,255,255,.85);background:#e9e4d7;box-shadow:0 36px 80px -46px rgba(53,44,18,.55);aspect-ratio:4/5}
    #seo-prerender .seo-figure img{display:block;width:100%;height:100%;object-fit:cover;object-position:center}
    #seo-prerender .seo-figure:after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(23,20,12,.58),rgba(23,20,12,.08) 46%,transparent)}
    #seo-prerender .seo-figure-card{position:absolute;left:16px;right:16px;bottom:16px;z-index:1;padding:14px 18px;border-radius:18px;border:1px solid rgba(255,255,255,.72);background:rgba(255,255,255,.55);backdrop-filter:blur(18px) saturate(1.7);-webkit-backdrop-filter:blur(18px) saturate(1.7);box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 18px 46px -24px rgba(20,16,4,.45)}
    #seo-prerender .seo-figure-kicker{margin:0;color:#8a6a1a;font-size:10px;font-weight:600;letter-spacing:.22em;text-transform:uppercase}
    #seo-prerender .seo-figure-place{margin:4px 0 0;color:var(--ink);font-family:Poppins,sans-serif;font-size:15px;font-weight:600;line-height:1.5}
    #seo-prerender .seo-main{padding:56px 0 72px}
    #seo-prerender .seo-grid{display:grid;grid-template-columns:minmax(0,1fr) 296px;gap:64px;align-items:start}
    #seo-prerender .seo-section{padding-top:32px;border-top:1px solid var(--line);margin-top:44px}
    #seo-prerender .seo-section:first-child{padding-top:0;border-top:0;margin-top:0}
    #seo-prerender .seo-section-head{display:flex;align-items:baseline;gap:16px}
    #seo-prerender .seo-num{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:#b08a2a}
    #seo-prerender article h2{margin:0;color:var(--ink);font-family:Poppins,sans-serif;font-weight:600;font-size:clamp(24px,2.6vw,32px);line-height:1.16;letter-spacing:-.03em}
    #seo-prerender .seo-section-body{max-width:68ch;margin-top:18px;padding-left:0}
    #seo-prerender article p{color:var(--muted);margin:0 0 14px;font-size:15px;line-height:1.82}
    #seo-prerender article ul{margin:22px 0 0;padding-left:20px;border-left:1px solid #e0d9c8;list-style:none;color:var(--muted)}
    #seo-prerender article li{position:relative;margin:10px 0;font-size:14.5px;line-height:1.75}
    #seo-prerender article li:before{content:"";position:absolute;left:-21px;top:.72em;width:3px;height:3px;background:#c48f00}
    #seo-prerender .seo-faq{border-top:1px solid var(--line);margin-top:56px;padding-top:36px}
    #seo-prerender .seo-faq h2{margin-bottom:14px}
    #seo-prerender details{border-bottom:1px solid var(--line);padding:18px 0}
    #seo-prerender summary{display:flex;justify-content:space-between;gap:16px;font-weight:500;font-size:14.5px;cursor:pointer;color:#2c2a25}
    #seo-prerender details p{margin:10px 0 0;font-size:14px}
    #seo-prerender .seo-related{display:grid;gap:0;margin-top:18px;border-top:1px solid var(--line)}
    #seo-prerender .seo-related a{display:block;border-bottom:1px solid var(--line);padding:18px 0;text-decoration:none}
    #seo-prerender .seo-related strong{display:block;font-size:14.5px;font-weight:500}
    #seo-prerender .seo-related span{display:block;font-size:13px;color:var(--soft);margin-top:4px}
    #seo-prerender aside{display:flex;flex-direction:column;gap:36px;position:sticky;top:96px}
    #seo-prerender aside h3{margin:0 0 14px;font-size:10px;font-weight:600;letter-spacing:.24em;text-transform:uppercase;color:#9a9486}
    #seo-prerender .seo-toc{display:grid;border-left:1px solid var(--line)}
    #seo-prerender .seo-toc a{display:block;padding:8px 0 8px 16px;color:var(--soft);text-decoration:none;font-size:13px;line-height:1.55}
    #seo-prerender .seo-toc a:hover{color:var(--ink);border-left:1px solid #c48f00;margin-left:-1px}
    #seo-prerender .seo-cta{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.8);border-radius:22px;padding:20px;background-color:#f5f4f0;background-size:cover;background-position:center;box-shadow:0 28px 60px -40px rgba(53,44,18,.55)}
    #seo-prerender .seo-cta h3{display:none}
    #seo-prerender .seo-cta p{margin:0;color:#43413a;font-size:12.5px;line-height:1.7}
    #seo-prerender .seo-cta strong{display:block;font-family:Poppins,sans-serif;font-weight:600;font-size:21px;line-height:1.2;letter-spacing:-.02em;color:var(--ink);margin-bottom:8px}
    #seo-prerender .seo-cta a{display:inline-block;margin-top:18px;background:var(--gold);color:#161200;text-decoration:none;font-weight:600;font-size:12.5px;padding:10px 16px;border-radius:8px}
    #seo-prerender .seo-other{display:grid;border-top:1px solid var(--line)}
    #seo-prerender .seo-other a{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line);text-decoration:none;font-size:12.5px;font-weight:500;color:var(--muted)}
    #seo-prerender .seo-other img{width:62px;height:46px;object-fit:cover;border-radius:8px;border:1px solid rgba(255,255,255,.9);flex:none;box-shadow:0 8px 18px -14px rgba(53,44,18,.6)}
    #seo-prerender footer{border-top:1px solid var(--line);background:#efeee9;padding:36px 0;font-size:12.5px;color:#6a655a}
    #seo-prerender footer a{color:#6a655a;text-decoration:none;margin-right:16px}
    #seo-prerender footer a:hover{color:var(--ink)}
    #seo-prerender .seo-disclaimer{border-top:1px solid var(--line);margin-top:22px;padding-top:16px;font-size:11.5px;color:var(--faint)}
    @media(max-width:900px){#seo-prerender .seo-hero-grid{grid-template-columns:1fr;gap:36px}#seo-prerender .seo-hero{padding:32px 0 44px}#seo-prerender .seo-figure{aspect-ratio:5/4}#seo-prerender .seo-grid{grid-template-columns:1fr;gap:44px}#seo-prerender aside{position:static}#seo-prerender .seo-nav{display:none}#seo-prerender .seo-section-body{padding-left:0}#seo-prerender .seo-cta{display:none}}
  </style>
  <!-- SEO:END -->`;
}

function renderStaticBody(page: SeoPage): string {
  const visual = guideVisual(page.slug);
  const [titleLead, ...titleRest] = page.h1.split(":");
  const titleTail = titleRest.join(":").trim();
  const visualTitle = `${escapeHtml(titleLead)}<span class="seo-sr">: </span>${
    titleTail ? `<span class="seo-title-tail">${escapeHtml(titleTail)}</span>` : ""
  }`;

  const sections = page.sections
    .map(
      (section, index) => `<section class="seo-section" id="${slugifyHeading(section.heading, index)}">
          <div class="seo-section-head">
            <span class="seo-num">${String(index + 1).padStart(2, "0")}</span>
            <h2>${escapeHtml(section.heading)}</h2>
          </div>
          <div class="seo-section-body">
            ${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n            ")}
            ${
              section.bullets
                ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
                : ""
            }
          </div>
        </section>`,
    )
    .join("\n      ");

  const faqs = page.faqs
    .map(
      (faq) => `<details>
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>`,
    )
    .join("\n        ");

  const related = page.related
    .map(
      (link) => `<a href="${escapeHtml(link.href)}">
          <strong>${escapeHtml(link.label)}</strong>
          <span>${escapeHtml(link.description)}</span>
        </a>`,
    )
    .join("\n        ");

  const otherGuides = seoPages
    .filter((candidate) => candidate.slug !== page.slug)
    .map(
      (candidate) =>
        `<li><a href="${escapeHtml(pagePath(candidate.slug))}"><img src="${escapeHtml(
          guideThumb(candidate.slug),
        )}" alt="" width="62" height="46" loading="lazy" />${escapeHtml(candidate.h1.split(":")[0])}</a></li>`,
    )
    .join("\n            ");

  const toc = page.sections
    .map(
      (section, index) =>
        `<a href="#${slugifyHeading(section.heading, index)}">${escapeHtml(section.heading)}</a>`,
    )
    .join("\n            ");

  const disclaimer =
    page.slug === "comparar-trivago-airbnb"
      ? `<p class="seo-disclaimer">VIANova no está afiliada a Trivago, Airbnb ni a sus empresas matrices. Las marcas se mencionan únicamente con fines comparativos e informativos.</p>`
      : "";

  return `<div id="seo-prerender">
    <header class="seo-header">
      <div class="seo-wrap">
        <a class="seo-brand" href="/"><img src="/brand-icon-192.png" alt="VIANova" width="32" height="32" />VIANova</a>
        <nav class="seo-nav" aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/explore">Explorar</a>
          <a href="/planificador-viajes-ia">Planificador IA</a>
          <a href="/viajes-colombia">Colombia</a>
          <a href="/que-hacer-en-neiva">Neiva</a>
        </nav>
        <a class="seo-app" href="/">Abrir la app</a>
      </div>
    </header>

    <section class="seo-hero">
      <div class="seo-wrap seo-hero-grid">
        <div class="seo-hero-copy">
          <nav class="seo-crumb" aria-label="Migas de pan">
            <a href="/">Inicio</a><span>/</span><span>Guías de viaje</span><span>/</span><span>${escapeHtml(visual.kicker)}</span>
          </nav>
          <p class="seo-eyebrow">${escapeHtml(visual.kicker)}</p>
          <h1 class="seo-display">${visualTitle}</h1>
          <p class="seo-lead">${escapeHtml(page.intro)}</p>
          <div class="seo-actions">
            <a class="seo-btn" href="/">Planificar mi viaje</a>
            <a class="seo-btn seo-btn-out" href="/explore">Explorar destinos</a>
          </div>
          <div class="seo-meta">
            <span>Actualizado: <time datetime="${CONTENT_UPDATED}">27 de octubre de 2026</time></span>
            <span>${escapeHtml(page.destination?.name ?? "Colombia")}</span>
            <span>${escapeHtml(visual.place)}</span>
          </div>
        </div>
        <figure class="seo-figure">
          <img src="${escapeHtml(visual.image)}" alt="${escapeHtml(visual.alt)}" width="1800" height="1200" fetchpriority="high" />
          <figcaption class="seo-figure-card">
            <p class="seo-figure-kicker">${escapeHtml(visual.kicker)}</p>
            <p class="seo-figure-place">${escapeHtml(visual.place)}</p>
          </figcaption>
        </figure>
      </div>
    </section>

    <main class="seo-main">
      <div class="seo-wrap seo-grid">
        <article>
          ${sections}
          <section class="seo-faq" id="preguntas-frecuentes">
            <h2 class="seo-display">Preguntas frecuentes</h2>
            ${faqs}
          </section>
          <section class="seo-section" style="border-top:0;padding-top:0">
            <h2 class="seo-display">Sigue planificando</h2>
            <div class="seo-related">
              ${related}
            </div>
          </section>
        </article>

        <aside>
          <div>
            <h3>En esta guía</h3>
            <nav class="seo-toc">
              ${toc}
              <a href="#preguntas-frecuentes">Preguntas frecuentes</a>
            </nav>
          </div>
          <div class="seo-cta" style="background-image:linear-gradient(160deg,rgba(245,244,240,.86),rgba(245,244,240,.94)),url('${escapeHtml(visual.image)}');background-size:cover;background-position:center">
            <h3>Planificador</h3>
            <p><strong>¿Listo para tu itinerario?</strong>Cuéntale a la IA tus fechas, presupuesto e intereses y recibe un plan editable en minutos.</p>
            <a href="/">Crear plan gratis →</a>
          </div>
          <div>
            <h3>Otras guías</h3>
            <ul class="seo-other" style="list-style:none;margin:0;padding:0">
              ${otherGuides}
            </ul>
          </div>
        </aside>
      </div>
    </main>

    <footer>
      <div class="seo-wrap">
        <a href="/">Inicio</a>
        <a href="/explore">Explorar</a>
        <a href="/privacy">Privacidad</a>
        <a href="/sitemap.xml">Sitemap</a>
        ${disclaimer}
        <div class="seo-disclaimer">© ${new Date().getFullYear()} VIANova. Hecho en Colombia para viajar mejor.</div>
      </div>
    </footer>
  </div>`;
}

function renderPage(template: string, page: SeoPage): string {
  // Guide pages ship real prerendered content, so the generic <noscript> fallback
  // would only duplicate the H1 and the internal links for crawlers and no-JS users.
  const withoutNoscript = template.replace(/\s*<noscript>[\s\S]*?<\/noscript>/, "");

  return withoutNoscript
    .replace(/<!-- SEO:START -->[\s\S]*?<!-- SEO:END -->/, renderHead(page))
    .replace('<div id="root"></div>', `<div id="root">${renderStaticBody(page)}</div>`);
}

function renderSitemap(): string {
  const lastmod = CONTENT_UPDATED;
  const core = [
    { url: `${SITE_URL}/`, priority: "1.0", changefreq: "weekly", image: `${SITE_URL}/og-image.png` },
    { url: absoluteUrl("/explore"), priority: "0.7", changefreq: "weekly", image: `${SITE_URL}/og-image.png` },
    { url: absoluteUrl("/privacy"), priority: "0.2", changefreq: "yearly" },
  ];
  const guides = seoPages.map((page) => ({
    url: absoluteUrl(pagePath(page.slug)),
    priority: "0.9",
    changefreq: "monthly",
    image: guideVisual(page.slug).image,
    slug: page.slug,
  }));

  const entries = [...core, ...guides]
    .map((entry) => {
      const alternates = ["es-CO", "en", "fr"]
        .map(
          (lang) =>
            `    <xhtml:link rel="alternate" hreflang="${lang}" href="${entry.url}" />`,
        )
        .join("\n");
      const image = "image" in entry && entry.image
        ? `\n    <image:image>\n      <image:loc>${entry.image}</image:loc>\n    </image:image>`
        : "";
      return `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
${alternates}${image}
  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries}
</urlset>
`;
}

/**
 * `llms-full.txt` is the long-form companion of `llms.txt`: every guide is
 * flattened to plain text so answer engines can quote it without rendering
 * the React app. It is generated at build time from the same source of truth
 * as the HTML pages, so it can never drift.
 */
function renderLlmsFull(): string {
  const lines: string[] = [
    "# VIANova IA — contenido completo para modelos de lenguaje",
    "",
    `> Fuente canónica: ${SITE_URL}`,
    `> Última actualización editorial: ${CONTENT_UPDATED}`,
    "> Idioma: español (Colombia). Interfaz también en inglés y francés.",
    "> Licencia de citación: puedes citar y resumir este contenido indicando la URL canónica de la página.",
    "",
    "## Índice",
    "",
    ...seoPages.map((page) => `- ${absoluteUrl(pagePath(page.slug))} — ${page.h1}`),
    "",
  ];

  for (const page of seoPages) {
    lines.push(
      "---",
      "",
      `# ${page.h1}`,
      "",
      `URL canónica: ${absoluteUrl(pagePath(page.slug))}`,
      `Descripción: ${page.description}`,
      "",
      page.intro,
      "",
    );
    for (const section of page.sections) {
      lines.push(`## ${section.heading}`, "");
      for (const paragraph of section.paragraphs) lines.push(paragraph, "");
      if (section.bullets?.length) {
        for (const bullet of section.bullets) lines.push(`- ${bullet}`);
        lines.push("");
      }
    }
    if (page.faqs.length) {
      lines.push("## Preguntas frecuentes", "");
      for (const faq of page.faqs) {
        lines.push(`### ${faq.question}`, "", faq.answer, "");
      }
    }
  }

  return `${lines.join("\n").trim()}\n`;
}

export function seoPagesPlugin(): Plugin {
  let outDir = "";
  return {
    name: "vianova-seo-pages",
    apply: "build",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      // Fire-and-forget async generation; Vite awaits the returned promise.
      return generateSeoPages(outDir);
    },
  };
}

export async function generateSeoPages(outDir: string): Promise<void> {
  const indexPath = path.join(outDir, "index.html");
  let waited = 0;
  while (!existsSync(indexPath) && waited < 10000) {
    await new Promise((r) => setTimeout(r, 200));
    waited += 200;
  }
  if (!existsSync(indexPath)) {
    console.warn(`[vianova-seo-pages] ${indexPath} not found, skipping.`);
    return;
  }
  const template = readFileSync(indexPath, "utf8");

  for (const page of seoPages) {
    writeFileSync(path.join(outDir, `${page.slug}.html`), renderPage(template, page), "utf8");
  }

  writeFileSync(path.join(outDir, "sitemap.xml"), renderSitemap(), "utf8");
  writeFileSync(path.join(outDir, "llms-full.txt"), renderLlmsFull(), "utf8");

  const verification = verificationTags();
  if (verification) {
    const home = template.replace("</head>", `  ${verification}\n</head>`);
    writeFileSync(indexPath, home, "utf8");
  }
}
