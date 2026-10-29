import { Link } from "wouter";
import type { SeoPage as SeoPageData } from "@shared/seo-content";
import { seoPages } from "@shared/seo-content";
import { guideThumb, guideVisual } from "@shared/guide-visuals";
import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Plus } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { LiquidGlass } from "@/components/ui/liquid-glass";

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

export default function SeoPage({ page }: { page: SeoPageData }) {
  const currentYear = new Date().getFullYear();
  const otherPages = seoPages.filter((candidate) => candidate.slug !== page.slug);
  const visual = guideVisual(page.slug);
  const reduce = useReducedMotion();
  const [titleLead, ...titleRest] = page.h1.split(":");
  const titleTail = titleRest.join(":").trim();

  return (
    <div className="min-h-screen bg-[#f5f4f0] text-[#1f1f1f] antialiased">
      <header className="glass-nav glass-nav--light sticky top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="VIANova, inicio">
            <img src="/brand-icon-192.png" alt="VIANova" className="h-8 w-8 rounded-lg" width={32} height={32} />
            <span className="font-heading text-[17px] font-bold tracking-tight text-[#1f1e1a]">
              VIANova
            </span>
          </Link>

          <nav
            aria-label="Navegación principal"
            className="hidden items-center gap-7 text-[12.5px] font-medium text-[#79746a] md:flex"
          >
            <Link href="/" className="transition-colors hover:text-[#1f1e1a]">Inicio</Link>
            <Link href="/explore" className="transition-colors hover:text-[#1f1e1a]">Explorar</Link>
            <Link href="/planificador-viajes-ia" className="transition-colors hover:text-[#1f1e1a]">Planificador IA</Link>
            <Link href="/viajes-colombia" className="transition-colors hover:text-[#1f1e1a]">Colombia</Link>
          </nav>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-[#ffbf00] px-3.5 py-2 text-[12.5px] font-semibold text-[#161200] shadow-[0_8px_20px_-12px_rgba(196,143,0,0.9)] transition-colors hover:bg-[#ffd34d]"
          >
            Abrir la app
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative isolate overflow-hidden border-b border-[#e4dfd2]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(48rem 30rem at 6% -14%, rgba(255,191,0,0.15), transparent 64%), radial-gradient(42rem 26rem at 92% 4%, rgba(255,255,255,0.95), transparent 62%)",
            }}
          />

          <div className="relative mx-auto grid w-full max-w-7xl gap-10 px-4 pb-14 pt-12 sm:px-6 min-[900px]:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)] min-[900px]:items-center min-[900px]:gap-12 lg:gap-16 lg:px-8 lg:pb-20 lg:pt-16">
            <div className="min-w-0">
              <nav aria-label="Migas de pan" className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#8a8578]">
                <Link href="/" className="transition-colors hover:text-[#1f1e1a]">Inicio</Link>
                <span aria-hidden="true" className="text-[#c9c2b1]">/</span>
                <span className="text-[#5f5b51]">Guías de viaje</span>
                <span aria-hidden="true" className="text-[#c9c2b1]">/</span>
                <span className="text-[#8a8578]">{visual.kicker}</span>
              </nav>

              <div className="mt-8 flex items-center gap-3 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-[#8a6a1a]">
                <span aria-hidden="true" className="h-px w-8 bg-[#ffbf00]" />
                {visual.kicker}
              </div>

              <h1 className="mt-5 max-w-[20ch] text-balance font-heading text-[clamp(2.1rem,4.2vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.04em] text-[#1c1b18]">
                {titleLead}
                <span className="sr-only">: </span>
                {titleTail && (
                  <>
                    <br />
                    <span className="text-[#7d5e12]">{titleTail}</span>
                  </>
                )}
              </h1>

              <p className="mt-6 max-w-2xl text-pretty text-[15px] leading-7 text-[#555147] sm:text-[16px] sm:leading-8">
                {page.intro}
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-4">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-[10px] bg-[#ffbf00] px-5 py-3 text-[13.5px] font-semibold text-[#161200] shadow-[0_14px_30px_-18px_rgba(196,143,0,0.9)] transition-colors hover:bg-[#ffd34d]"
                >
                  Planificar mi viaje
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/explore"
                  className="group inline-flex items-center gap-2 border-b border-[#c9c2b1] pb-1 text-[13.5px] font-medium text-[#555147] transition-colors hover:border-[#a87c00] hover:text-[#1f1e1a]"
                >
                  Explorar destinos
                  <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e4dfd2] pt-5 text-[11.5px] text-[#8a8578]">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  Actualizado el 27 de octubre de 2026
                </span>
                <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-[#c9c2b1] sm:block" />
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {page.destination?.name ?? "Colombia"}
                </span>
                <span aria-hidden="true" className="hidden h-1 w-1 rounded-full bg-[#c9c2b1] sm:block" />
                <span>{visual.place}</span>
              </div>
            </div>

            <motion.figure
              initial={reduce ? false : { opacity: 0, y: 22 }}
              animate={reduce ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}
              className="relative m-0 overflow-hidden rounded-[28px] border border-white/80 bg-[#e9e4d7] shadow-[0_36px_80px_-46px_rgba(53,44,18,0.55)]"
            >
              <div className="relative aspect-[4/5]">
                <img
                  src={visual.image}
                  alt={visual.alt}
                  className="h-full w-full object-cover object-center"
                  fetchPriority="high"
                  decoding="async"
                  width={1800}
                  height={1200}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#17140c]/58 via-[#17140c]/8 to-transparent"
                />

                <div className="absolute inset-x-4 bottom-4 sm:inset-x-5 sm:bottom-5">
                  <LiquidGlass variant="clear" refract interactive className="rounded-[18px] px-5 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a6a1a]">
                      {visual.kicker}
                    </p>
                    <p className="mt-1.5 font-heading text-[15px] font-semibold leading-6 tracking-[-0.01em] text-[#1c1b18]">
                      {visual.place}
                    </p>
                  </LiquidGlass>
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
                className="scroll-mt-24 border-t border-[#ddd7c8] pt-8 first:border-t-0 first:pt-0 [&+section]:mt-12"
                initial={reduce ? false : { opacity: 0, y: 18 }}
                whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.55, ease: EASE }}
              >
                <div className="flex items-baseline gap-4">
                  <span className="font-mono text-[11px] tabular-nums text-[#b08a2a]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-balance font-heading text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-[1.16] tracking-[-0.03em] text-[#1c1b18]">
                    {section.heading}
                  </h2>
                </div>

                <div className="mt-5 max-w-[68ch] space-y-4 sm:pl-8">
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph.slice(0, 48)} className="text-[15px] leading-7 text-[#555147] sm:text-[15.5px] sm:leading-[1.82]">
                      {paragraph}
                    </p>
                  ))}

                  {section.bullets && section.bullets.length > 0 && (
                    <ul className="mt-6 space-y-3 border-l border-[#e0d9c8] pl-5">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="relative text-[14.5px] leading-7 text-[#555147]">
                          <span
                            aria-hidden="true"
                            className="absolute -left-[21px] top-[0.72rem] h-1 w-1 bg-[#c48f00]"
                          />
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </motion.section>
            ))}

            <section id="preguntas-frecuentes" className="mt-16 scroll-mt-24 border-t border-[#ddd7c8] pt-10">
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-[11px] tabular-nums text-[#b08a2a]">
                  {String(page.sections.length + 1).padStart(2, "0")}
                </span>
                <h2 className="font-heading text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em] text-[#1c1b18]">
                  Preguntas frecuentes
                </h2>
              </div>

              <div className="mt-6 max-w-[68ch] border-t border-[#ddd7c8] sm:ml-8">
                {page.faqs.map((faq) => (
                  <details key={faq.question} className="group border-b border-[#ddd7c8] py-5">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[14.5px] font-medium leading-6 text-[#2c2a25] marker:hidden [&::-webkit-details-marker]:hidden">
                      {faq.question}
                      <Plus
                        className="h-4 w-4 shrink-0 text-[#a87c00] transition-transform duration-300 group-open:rotate-45"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-3 text-[14px] leading-7 text-[#5d594f]">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="mt-16 border-t border-[#ddd7c8] pt-10">
              <h2 className="font-heading text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em] text-[#1c1b18]">
                Sigue planificando
              </h2>
              <div className="mt-6 border-t border-[#ddd7c8]">
                {page.related.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group flex items-center justify-between gap-6 border-b border-[#ddd7c8] py-5"
                  >
                    <span className="min-w-0">
                      <span className="block text-[14.5px] font-medium text-[#1f1e1a] transition-colors group-hover:text-[#7d5e12]">
                        {link.label}
                      </span>
                      <span className="mt-1 block max-w-2xl text-[13px] leading-6 text-[#6a655a]">
                        {link.description}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 shrink-0 text-[#b3ac9b] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#a87c00]"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-10 min-[900px]:sticky min-[900px]:top-24 min-[900px]:self-start">
            <nav aria-label="Contenido de la guía">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a9486]">En esta guía</p>
              <ol className="mt-5 border-l border-[#ddd7c8]">
                {page.sections.map((section, index) => (
                  <li key={section.heading}>
                    <a
                      href={`#${slugifyHeading(section.heading, index)}`}
                      className="group flex gap-3 border-l border-transparent py-2 pl-4 text-[13px] leading-6 text-[#6a655a] transition-colors hover:border-[#c48f00] hover:text-[#1f1e1a]"
                    >
                      <span className="font-mono text-[10px] tabular-nums text-[#b3ac9b] group-hover:text-[#a87c00]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {section.heading}
                    </a>
                  </li>
                ))}
                <li>
                  <a
                    href="#preguntas-frecuentes"
                    className="group flex gap-3 border-l border-transparent py-2 pl-4 text-[13px] leading-6 text-[#6a655a] transition-colors hover:border-[#c48f00] hover:text-[#1f1e1a]"
                  >
                    <span className="font-mono text-[10px] tabular-nums text-[#b3ac9b] group-hover:text-[#a87c00]">
                      {String(page.sections.length + 1).padStart(2, "0")}
                    </span>
                    Preguntas frecuentes
                  </a>
                </li>
              </ol>
            </nav>

            <div className="relative overflow-hidden rounded-[22px] border border-white/80 shadow-[0_28px_60px_-40px_rgba(53,44,18,0.55)]">
              <img
                src={visual.image}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-[#17140c]/52" aria-hidden="true" />
              <LiquidGlass variant="clear" refract interactive className="relative rounded-none border-0 p-5">
                <p className="font-heading text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] text-[#1c1b18]">
                  ¿Listo para tu itinerario?
                </p>
                <p className="mt-2 text-[12.5px] leading-6 text-[#43413a]/85">
                  Cuéntale a la IA tus fechas, presupuesto e intereses. Recibe un plan editable en minutos.
                </p>
                <Link
                  href="/"
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#ffbf00] px-4 py-2.5 text-[12.5px] font-semibold text-[#161200] transition-colors hover:bg-[#ffd34d]"
                >
                  Crear plan gratis
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </LiquidGlass>
            </div>

            <nav aria-label="Otras guías">
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a9486]">Otras guías</p>
              <ul className="mt-4 border-t border-[#ddd7c8]">
                {otherPages.map((other) => (
                  <li key={other.slug}>
                    <Link
                      href={`/${other.slug}`}
                      className="group flex items-center gap-3 border-b border-[#ddd7c8] py-3.5"
                    >
                      <span className="relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-white shadow-[0_8px_18px_-14px_rgba(53,44,18,0.6)]">
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
                      <span className="min-w-0 flex-1 text-[12.5px] font-medium leading-5 text-[#555147] transition-colors group-hover:text-[#1f1e1a]">
                        {other.h1.split(":")[0]}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[#b3ac9b] transition-colors group-hover:text-[#a87c00]" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </main>

      <footer className="border-t border-[#ddd7c8] bg-[#efeee9]">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/brand-icon-192.png" alt="" className="h-8 w-8 rounded-lg" width={32} height={32} loading="lazy" />
              <span className="font-heading text-[15px] font-bold text-[#1f1e1a]">VIANova</span>
            </div>
            <p className="mt-3 max-w-xs text-[12.5px] leading-6 text-[#6a655a]">
              Planificador de viajes con inteligencia artificial. Itinerarios, proveedores locales y movilidad en un solo lugar.
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a9486]">Producto</p>
            <ul className="mt-4 space-y-2.5 text-[12.5px] text-[#6a655a]">
              <li><Link href="/" className="transition-colors hover:text-[#1f1e1a]">Inicio</Link></li>
              <li><Link href="/explore" className="transition-colors hover:text-[#1f1e1a]">Explorar destinos</Link></li>
              <li><Link href="/planificador-viajes-ia" className="transition-colors hover:text-[#1f1e1a]">Planificador IA</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a9486]">Guías</p>
            <ul className="mt-4 space-y-2.5 text-[12.5px] text-[#6a655a]">
              {seoPages.map((guide) => (
                <li key={guide.slug}>
                  <Link href={`/${guide.slug}`} className="transition-colors hover:text-[#1f1e1a]">
                    {guide.h1.split(":")[0]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a9486]">Legal</p>
            <ul className="mt-4 space-y-2.5 text-[12.5px] text-[#6a655a]">
              <li><Link href="/privacy" className="transition-colors hover:text-[#1f1e1a]">Privacidad</Link></li>
              <li><a href="/sitemap.xml" className="transition-colors hover:text-[#1f1e1a]">Sitemap</a></li>
              <li><a href="/llms.txt" className="transition-colors hover:text-[#1f1e1a]">llms.txt</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#ddd7c8]">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-[11px] text-[#8a8578] sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© {currentYear} VIANova. Todos los derechos reservados.</p>
            <p>Hecho en Colombia para viajeros que quieren planificar mejor.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
