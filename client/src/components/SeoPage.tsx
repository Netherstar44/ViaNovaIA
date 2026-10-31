import { Link } from "wouter";
import type { SeoPage as SeoPageData } from "@shared/seo-content";
import { seoPages } from "@shared/seo-content";
import { guideHeroSources, guideThumb, guideVisual } from "@shared/guide-visuals";
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Navbar from "@/components/Navbar";

const EASE = [0.22, 1, 0.36, 1] as const;

function slugifyHeading(value: string, index: number) {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "seccion"}-${index + 1}`;
}

/** Opens the real in-app assistant instead of bouncing the visitor home. */
function openPlanner() {
  window.__vianovaChatRequested = true;
  window.dispatchEvent(new CustomEvent("vianova:open-chat"));
}

export default function SeoPage({ page }: { page: SeoPageData }) {
  const currentYear = new Date().getFullYear();
  const otherPages = seoPages.filter((candidate) => candidate.slug !== page.slug);
  const visual = guideVisual(page.slug);
  const hero = guideHeroSources(visual.image);
  const reduce = useReducedMotion();
  const [titleLead, ...titleRest] = page.h1.split(":");
  const titleTail = titleRest.join(":").trim();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Navbar />

      <main>
        <section className="relative isolate overflow-hidden border-b border-border">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(48rem 30rem at 6% -14%, color-mix(in srgb, var(--primary) 16%, transparent), transparent 64%), radial-gradient(42rem 26rem at 92% 4%, color-mix(in srgb, var(--card) 88%, transparent), transparent 62%)",
            }}
          />

          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-14 pt-10 sm:px-6 min-[900px]:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] min-[900px]:items-center min-[900px]:gap-12 lg:gap-16 lg:px-8 lg:pb-20 lg:pt-14">
            <div className="min-w-0">
              <nav
                aria-label="Migas de pan"
                className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground"
              >
                <Link href="/" className="transition-colors hover:text-foreground">Inicio</Link>
                <span aria-hidden="true" className="text-muted-foreground/50">/</span>
                <span className="text-foreground/70">Guías de viaje</span>
                <span aria-hidden="true" className="text-muted-foreground/50">/</span>
                <span>{visual.kicker}</span>
              </nav>

              <div className="mt-8 flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-primary-ink">
                <span aria-hidden="true" className="h-px w-8 bg-primary" />
                {visual.kicker}
              </div>

              <h1 className="mt-5 max-w-[20ch] text-balance font-heading text-[clamp(2.1rem,4.2vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-foreground">
                {titleLead}
                <span className="sr-only">: </span>
                {titleTail && (
                  <>
                    <br />
                    <span className="text-primary-ink">{titleTail}</span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-2xl text-pretty text-[15px] leading-7 text-muted-foreground sm:text-[16px] sm:leading-8">
                {page.intro}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                <button
                  type="button"
                  onClick={openPlanner}
                  className="inline-flex items-center gap-2 rounded-[10px] bg-primary px-5 py-3 text-[13.5px] font-semibold text-primary-foreground shadow-[0_14px_30px_-18px_rgba(0,0,0,0.45)] transition-colors hover:bg-primary/90"
                >
                  Planificar mi viaje
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <Link
                  href="/explore"
                  className="group inline-flex items-center gap-2 border-b border-border pb-1 text-[13.5px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  Explorar destinos
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-5 text-[11.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  Actualizado el 27 de octubre de 2026
                </span>
                <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-border sm:block" />
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {page.destination?.name ?? "Colombia"}
                </span>
                <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-border sm:block" />
                <span>{visual.place}</span>
              </div>
            </div>

            <motion.figure
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
              className="relative m-0 overflow-hidden rounded-[28px] border border-border bg-muted shadow-[0_36px_80px_-46px_rgba(0,0,0,0.55)]"
            >
              <div className="relative aspect-[4/5]">
                <picture className="contents">
                  <source type="image/avif" srcSet={hero.avifSrcSet} sizes={hero.sizes} />
                  <img
                    src={visual.image}
                    srcSet={hero.webpSrcSet}
                    sizes={hero.sizes}
                    alt={visual.alt}
                    className="h-full w-full object-cover object-center"
                    fetchPriority="high"
                    decoding="async"
                    width={1800}
                    height={1200}
                  />
                </picture>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
                />

                <div className="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5">
                  <div className="rounded-[18px] border border-white/25 bg-black/55 px-5 py-4 text-white shadow-[0_18px_46px_-24px_rgba(0,0,0,0.75)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary">
                      {visual.kicker}
                    </p>
                    <p className="mt-1.5 font-heading text-[15px] font-semibold leading-6 tracking-[-0.01em]">
                      {visual.place}
                    </p>
                  </div>
                </div>
              </div>
            </motion.figure>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 py-14 sm:px-6 min-[900px]:grid-cols-[minmax(0,1fr)_18.5rem] min-[900px]:gap-12 min-[900px]:py-16 lg:gap-16 lg:px-8 lg:py-20">
          <article className="min-w-0">
            {page.sections.map((section, index) => (
              <motion.section
                key={section.heading}
                id={slugifyHeading(section.heading, index)}
                className="scroll-mt-24 border-t border-border pt-8 first:border-t-0 first:pt-0 [&+section]:mt-12"
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] tabular-nums text-primary-ink">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-balance font-heading text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.16] tracking-[-0.03em] text-foreground">
                    {section.heading}
                  </h2>
                </div>

                <div className="mt-5 max-w-[68ch] space-y-4 sm:pl-8">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="text-[15px] leading-7 text-muted-foreground sm:text-[15.5px] sm:leading-[1.82]">
                      {paragraph}
                    </p>
                  ))}

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-6 space-y-3 border-l border-border pl-5">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="relative text-[14.5px] leading-7 text-muted-foreground">
                          <span
                            aria-hidden="true"
                            className="absolute -left-[21px] top-[0.72rem] h-1 w-1 bg-primary"
                          />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.section>
            ))}

            <section id="preguntas-frecuentes" className="mt-16 scroll-mt-24 border-t border-border pt-10">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-[11px] tabular-nums text-primary-ink">
                  {String(page.sections.length + 1).padStart(2, "0")}
                </span>
                <h2 className="font-heading text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                  Preguntas frecuentes
                </h2>
              </div>

              <div className="mt-6 max-w-[68ch] border-t border-border sm:ml-8">
                {page.faqs.map((faq) => (
                  <details key={faq.question} className="group border-b border-border py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[14.5px] font-medium leading-6 text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <Plus
                        className="h-4 w-4 shrink-0 text-primary-ink transition-transform duration-300 group-open:rotate-45"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-3 text-[14px] leading-7 text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="mt-16 border-t border-border pt-10">
              <h2 className="font-heading text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em] text-foreground">
                Sigue planificando
              </h2>
              <div className="mt-6 border-t border-border">
                {page.related.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center justify-between gap-6 border-b border-border py-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium text-foreground transition-colors group-hover:text-primary-ink">
                        {link.label}
                      </span>
                      <span className="mt-1 block max-w-2xl text-[13px] leading-6 text-muted-foreground">
                        {link.description}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary-ink"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-10 min-[900px]:sticky min-[900px]:top-24 min-[900px]:self-start">
            <nav aria-label="Contenido de la guía">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">En esta guía</p>
              <ol className="mt-5 border-l border-border">
                {page.sections.map((section, index) => (
                  <li key={section.heading}>
                    <a
                      href={`#${slugifyHeading(section.heading, index)}`}
                      className="group flex gap-3 border-l border-transparent py-2 pl-4 text-[13px] leading-6 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70 group-hover:text-primary-ink">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {section.heading}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="#preguntas-frecuentes"
                    className="group flex gap-3 border-l border-transparent py-2 pl-4 text-[13px] leading-6 text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                  >
                    <span className="font-mono text-[10px] tabular-nums text-muted-foreground/70 group-hover:text-primary-ink">
                      {String(page.sections.length + 1).padStart(2, "0")}
                    </span>
                    Preguntas frecuentes
                  </a>
                </li>
              </ol>
            </nav>

            <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_28px_60px_-40px_rgba(0,0,0,0.55)]">
              <div className="relative h-28">
                <img
                  src={visual.thumb}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                  width={480}
                  height={320}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-black/10" aria-hidden="true" />
              </div>
              <div className="p-5">
                <p className="font-heading text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-card-foreground">
                  ¿Listo para tu itinerario?
                </p>
                <p className="mt-2 text-[12.5px] leading-6 text-muted-foreground">
                  Cuéntale a la IA tus fechas, presupuesto e intereses. Recibe un plan editable en minutos.
                </p>
                <button
                  type="button"
                  onClick={openPlanner}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Crear plan gratis
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <nav aria-label="Otras guías">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Otras guías</p>
              <ul className="mt-4 border-t border-border">
                {otherPages.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={`/${other.slug}`}
                      className="group flex items-center gap-3 border-b border-border py-3.5"
                    >
                      <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-border shadow-[0_8px_18px_-14px_rgba(0,0,0,0.6)]">
                        <img
                          src={guideThumb(other.slug)}
                          alt=""
                          aria-hidden="true"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                          loading="lazy"
                          decoding="async"
                          width={480}
                          height={320}
                        />
                      </span>
                      <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-5 text-muted-foreground transition-colors group-hover:text-foreground">
                        {other.h1.split(":")[0]}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary-ink" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </main>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/brand-icon-192.png" alt="" className="h-8 w-8 rounded-lg" width={32} height={32} loading="lazy" />
              <span className="font-heading text-[15px] font-bold text-foreground">VIANova</span>
            </div>
            <p className="mt-3 max-w-xs text-[12.5px] leading-6 text-muted-foreground">
              Planificador de viajes con inteligencia artificial. Itinerarios, proveedores locales y movilidad en un solo lugar.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Producto</p>
            <ul className="mt-4 space-y-2.5 text-[12.5px] text-muted-foreground">
              <li><Link href="/" className="transition-colors hover:text-foreground">Inicio</Link></li>
              <li><Link href="/explore" className="transition-colors hover:text-foreground">Explorar destinos</Link></li>
              <li><Link href="/planificador-viajes-ia" className="transition-colors hover:text-foreground">Planificador IA</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Guías</p>
            <ul className="mt-4 space-y-2.5 text-[12.5px] text-muted-foreground">
              {seoPages.map((guide) => (
                <li key={guide.slug}>
                  <Link href={`/${guide.slug}`} className="transition-colors hover:text-foreground">
                    {guide.h1.split(":")[0]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Legal</p>
            <ul className="mt-4 space-y-2.5 text-[12.5px] text-muted-foreground">
              <li><Link href="/privacy" className="transition-colors hover:text-foreground">Privacidad</Link></li>
              <li><a href="/sitemap.xml" className="transition-colors hover:text-foreground">Sitemap</a></li>
              <li><a href="/llms.txt" className="transition-colors hover:text-foreground">llms.txt</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© {currentYear} VIANova. Todos los derechos reservados.</p>
            <p>Hecho en Colombia para viajeros que quieren planificar mejor.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
