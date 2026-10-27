import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import {
  CONTENT_UPDATED,
  DEFAULT_OG_IMAGE,
  SITE_URL,
  absoluteUrl,
  baseGraph,
  jsonLdScript,
  pageJsonLd,
  pagePath,
  seoPages,
  type SeoPage,
} from "./shared/seo-content";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function verificationTags(): string {
  const google = process.env.GOOGLE_SITE_VERIFICATION || process.env.VITE_GOOGLE_SITE_VERIFICATION;
  const bing = process.env.BING_SITE_VERIFICATION || process.env.VITE_BING_SITE_VERIFICATION;
  return [
    google ? `<meta name="google-site-verification" content="${escapeHtml(google)}" />` : "",
    bing ? `<meta name="msvalidate.01" content="${escapeHtml(bing)}" />` : "",
  ]
    .filter(Boolean)
    .join("\n  ");
}

function renderHead(page: SeoPage): string {
  const url = absoluteUrl(pagePath(page.slug));
  const jsonLd = [
    `<script type="application/ld+json">${jsonLdScript(baseGraph())}</script>`,
    `<script type="application/ld+json" id="seo-route-jsonld">${jsonLdScript(pageJsonLd(page))}</script>`,
  ].join("\n  ");

  return `<!-- SEO:START -->
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="keywords" content="${escapeHtml(page.keywords.join(", "))}" />
  <meta name="author" content="VIANova IA" />
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  <link rel="canonical" href="${url}" />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="VIANova IA" />
  <meta property="og:locale" content="es_CO" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:url" content="${url}" />
  <meta property="og:image" content="${DEFAULT_OG_IMAGE}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeHtml(page.h1)}" />
  <meta property="article:modified_time" content="${CONTENT_UPDATED}" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="${DEFAULT_OG_IMAGE}" />
  <meta name="twitter:image:alt" content="${escapeHtml(page.h1)}" />

  ${verificationTags()}
  ${jsonLd}
  <style>
    #seo-prerender{--seo-bg:#f7f6f2;--seo-ink:#14130f;--seo-muted:#57544b;--seo-line:#e2dfd5;--seo-gold:#b8860b;background:var(--seo-bg);color:var(--seo-ink);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.65;min-height:100vh}
    #seo-prerender *{box-sizing:border-box}
    #seo-prerender .seo-wrap{max-width:1120px;margin:0 auto;padding:0 20px}
    #seo-prerender .seo-header{background:#0b0b0c;color:#fff;border-bottom:1px solid rgba(255,255,255,.12)}
    #seo-prerender .seo-header .seo-wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px}
    #seo-prerender .seo-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:800;font-size:18px}
    #seo-prerender .seo-brand img{width:34px;height:34px;border-radius:9px}
    #seo-prerender .seo-nav{display:flex;gap:18px;flex-wrap:wrap;font-size:14px;font-weight:600}
    #seo-prerender .seo-nav a{color:rgba(255,255,255,.78);text-decoration:none}
    #seo-prerender .seo-nav a:hover{color:#ffbf00}
    #seo-prerender .seo-hero{background:linear-gradient(145deg,#0b0b0c 0%,#191712 55%,#2a2414 100%);color:#fff;padding:64px 0 56px}
    #seo-prerender .seo-eyebrow{display:inline-block;color:#ffbf00;border:1px solid rgba(255,191,0,.35);background:rgba(255,191,0,.08);border-radius:999px;padding:5px 12px;font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase}
    #seo-prerender h1{font-size:clamp(30px,5vw,50px);line-height:1.12;letter-spacing:-.025em;margin:18px 0 14px;max-width:900px}
    #seo-prerender .seo-lead{font-size:18px;color:rgba(255,255,255,.76);max-width:780px;margin:0 0 24px}
    #seo-prerender .seo-actions{display:flex;gap:12px;flex-wrap:wrap}
    #seo-prerender .seo-btn{display:inline-block;border-radius:999px;padding:11px 20px;font-weight:800;font-size:14px;text-decoration:none;background:#ffbf00;color:#14130f}
    #seo-prerender .seo-btn-out{border:1px solid rgba(255,255,255,.25);color:#fff;background:transparent}
    #seo-prerender .seo-meta{display:flex;gap:20px;flex-wrap:wrap;margin-top:24px;color:rgba(255,255,255,.55);font-size:12px}
    #seo-prerender .seo-main{padding:48px 0 56px}
    #seo-prerender .seo-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:40px;align-items:start}
    #seo-prerender article h2{font-size:26px;line-height:1.25;letter-spacing:-.015em;margin:38px 0 12px}
    #seo-prerender article h2:first-child{margin-top:0}
    #seo-prerender article p{color:var(--seo-muted);margin:0 0 14px;font-size:16px}
    #seo-prerender article ul{margin:0 0 18px;padding-left:22px;color:var(--seo-muted)}
    #seo-prerender article li{margin:7px 0}
    #seo-prerender .seo-faq{margin-top:44px;background:#fff;border:1px solid var(--seo-line);border-radius:20px;padding:24px}
    #seo-prerender .seo-faq h2{margin-top:0}
    #seo-prerender details{border-top:1px solid var(--seo-line);padding:14px 0}
    #seo-prerender details:first-of-type{border-top:0}
    #seo-prerender summary{font-weight:700;cursor:pointer}
    #seo-prerender details p{margin:8px 0 0}
    #seo-prerender aside{display:flex;flex-direction:column;gap:16px;position:sticky;top:24px}
    #seo-prerender .seo-card{background:#fff;border:1px solid var(--seo-line);border-radius:18px;padding:20px}
    #seo-prerender .seo-card h3{margin:0 0 10px;font-size:16px}
    #seo-prerender .seo-card a{color:var(--seo-ink);text-decoration:none;font-weight:600;font-size:14px}
    #seo-prerender .seo-card a:hover{color:#8a6508}
    #seo-prerender .seo-card ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    #seo-prerender .seo-cta{background:#fff8e1;border-color:rgba(184,134,11,.35)}
    #seo-prerender .seo-related{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:20px}
    #seo-prerender .seo-related a{display:block;background:#fff;border:1px solid var(--seo-line);border-radius:14px;padding:14px;text-decoration:none;color:var(--seo-ink)}
    #seo-prerender .seo-related strong{display:block;font-size:14px;margin-bottom:4px}
    #seo-prerender .seo-related span{font-size:13px;color:var(--seo-muted)}
    #seo-prerender footer{background:#0b0b0c;color:rgba(255,255,255,.62);padding:32px 0;font-size:13px}
    #seo-prerender footer a{color:rgba(255,255,255,.82);text-decoration:none;margin-right:16px}
    #seo-prerender .seo-disclaimer{border-top:1px solid rgba(255,255,255,.12);margin-top:18px;padding-top:14px;font-size:12px;color:rgba(255,255,255,.45)}
    @media(max-width:900px){#seo-prerender .seo-grid{grid-template-columns:1fr}#seo-prerender aside{position:static}#seo-prerender .seo-related{grid-template-columns:1fr}#seo-prerender .seo-nav{display:none}}
  </style>
  <!-- SEO:END -->`;
}

function renderStaticBody(page: SeoPage): string {
  const sections = page.sections
    .map(
      (section) => `<h2>${escapeHtml(section.heading)}</h2>
        ${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n        ")}
        ${
          section.bullets
            ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
            : ""
        }`,
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
        `<li><a href="${escapeHtml(pagePath(candidate.slug))}">${escapeHtml(candidate.h1.split(":")[0])}</a></li>`,
    )
    .join("\n            ");

  const disclaimer =
    page.slug === "comparar-trivago-airbnb"
      ? `<p class="seo-disclaimer">VIANova IA no está afiliada a Trivago, Airbnb ni a sus empresas matrices. Las marcas se mencionan únicamente con fines comparativos e informativos.</p>`
      : "";

  return `<div id="seo-prerender">
    <header class="seo-header">
      <div class="seo-wrap">
        <a class="seo-brand" href="/"><img src="/brand-icon-192.png" alt="VIANova IA" width="34" height="34" />VIANova IA</a>
        <nav class="seo-nav" aria-label="Navegación principal">
          <a href="/">Inicio</a>
          <a href="/explore">Explorar</a>
          <a href="/planificador-viajes-ia">Planificador IA</a>
          <a href="/viajes-colombia">Colombia</a>
          <a href="/que-hacer-en-neiva">Neiva</a>
        </nav>
      </div>
    </header>

    <section class="seo-hero">
      <div class="seo-wrap">
        <span class="seo-eyebrow">Guía VIANova IA</span>
        <h1>${escapeHtml(page.h1)}</h1>
        <p class="seo-lead">${escapeHtml(page.intro)}</p>
        <div class="seo-actions">
          <a class="seo-btn" href="/">Planificar mi viaje</a>
          <a class="seo-btn seo-btn-out" href="/explore">Explorar destinos</a>
        </div>
        <div class="seo-meta">
          <span>Actualizado: <time datetime="${CONTENT_UPDATED}">27 de octubre de 2026</time></span>
          <span>Colombia</span>
          <span>Lectura de 8 a 12 minutos</span>
        </div>
      </div>
    </section>

    <main class="seo-main">
      <div class="seo-wrap seo-grid">
        <article>
          ${sections}
          <section class="seo-faq" id="preguntas-frecuentes">
            <h2>Preguntas frecuentes</h2>
            ${faqs}
          </section>
          <h2>Sigue planificando</h2>
          <div class="seo-related">
            ${related}
          </div>
        </article>

        <aside>
          <div class="seo-card">
            <h3>Otras guías</h3>
            <ul>
              ${otherGuides}
            </ul>
          </div>
          <div class="seo-card seo-cta">
            <h3>¿Listo para tu itinerario?</h3>
            <p>Cuéntale a la IA tus fechas, presupuesto e intereses y recibe un plan editable en minutos.</p>
            <a href="/">Crear plan gratis →</a>
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
        <div class="seo-disclaimer">© ${new Date().getFullYear()} VIANova IA. Hecho en Colombia para viajar mejor.</div>
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
  const today = new Date().toISOString().slice(0, 10);
  const core = [
    { url: `${SITE_URL}/`, priority: "1.0", changefreq: "weekly" },
    { url: absoluteUrl("/explore"), priority: "0.7", changefreq: "weekly" },
    { url: absoluteUrl("/privacy"), priority: "0.2", changefreq: "yearly" },
  ];
  const guides = seoPages.map((page) => ({
    url: absoluteUrl(pagePath(page.slug)),
    priority: "0.9",
    changefreq: "monthly",
  }));

  const entries = [...core, ...guides]
    .map(
      (entry) => `  <url>
    <loc>${entry.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
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
      const indexPath = path.join(outDir, "index.html");
      const template = readFileSync(indexPath, "utf8");

      for (const page of seoPages) {
        writeFileSync(path.join(outDir, `${page.slug}.html`), renderPage(template, page), "utf8");
      }

      writeFileSync(path.join(outDir, "sitemap.xml"), renderSitemap(), "utf8");

      const verification = verificationTags();
      if (verification) {
        const home = template.replace("</head>", `  ${verification}\n</head>`);
        writeFileSync(indexPath, home, "utf8");
      }
    },
  };
}
