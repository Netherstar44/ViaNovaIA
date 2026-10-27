import { useEffect } from "react";
import { useLocation } from "wouter";
import { getRouteSeo } from "@shared/seo-content";

function upsertMeta(attribute: "name" | "property", key: string, content?: string) {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (!content) {
    existing?.remove();
    return;
  }

  if (existing) {
    existing.setAttribute("content", content);
    return;
  }

  const meta = document.createElement("meta");
  meta.setAttribute(attribute, key);
  meta.setAttribute("content", content);
  document.head.appendChild(meta);
}

function upsertCanonical(href?: string) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!href) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.setAttribute("href", href);
    return;
  }
  const link = document.createElement("link");
  link.rel = "canonical";
  link.href = href;
  document.head.appendChild(link);
}

/**
 * Mantiene título, descripción, canonical, Open Graph y JSON-LD sincronizados
 * con la ruta actual. El HTML inicial ya trae los metadatos de la portada y de
 * las guías prerenderizadas; este hook los actualiza al navegar dentro de la SPA.
 */
export function useSeo() {
  const [location] = useLocation();

  useEffect(() => {
    const seo = getRouteSeo(location);
    const isIndexable = !seo.robots.includes("noindex");

    document.title = seo.title;

    upsertMeta("name", "description", seo.description);
    upsertMeta("name", "robots", seo.robots);
    upsertMeta("name", "googlebot", seo.robots);
    upsertMeta("name", "keywords", seo.keywords?.join(", "));

    upsertCanonical(isIndexable ? seo.canonical : undefined);

    upsertMeta("property", "og:type", seo.ogType);
    upsertMeta("property", "og:title", seo.title);
    upsertMeta("property", "og:description", seo.description);
    upsertMeta("property", "og:url", seo.canonical);
    upsertMeta("property", "og:image", seo.image);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:image:alt", `${seo.title} — VIANova IA`);

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", seo.title);
    upsertMeta("name", "twitter:description", seo.description);
    upsertMeta("name", "twitter:image", seo.image);
    upsertMeta("name", "twitter:image:alt", `${seo.title} — VIANova IA`);

    const previous = document.getElementById("seo-route-jsonld");
    previous?.remove();

    if (seo.jsonLd) {
      const script = document.createElement("script");
      script.type = "application/ld+json";
      script.id = "seo-route-jsonld";
      script.textContent = JSON.stringify(seo.jsonLd).replace(/</g, "\\u003c");
      document.head.appendChild(script);
    }
  }, [location]);
}
