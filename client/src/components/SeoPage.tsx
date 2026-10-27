import { Link } from "wouter";
import type { SeoPage as SeoPageData } from "@shared/seo-content";
import { seoPages } from "@shared/seo-content";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Compass,
  MapPin,
  Sparkles,
} from "lucide-react";

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5" aria-label="VIANova IA, inicio">
            <img src="/brand-icon-192.png" alt="VIANova IA" className="h-9 w-9 rounded-xl" width={36} height={36} />
            <span className="font-heading text-lg font-extrabold tracking-tight">
              VIANova <span className="text-primary">IA</span>
            </span>
          </Link>

          <nav aria-label="Navegación principal" className="hidden items-center gap-6 text-sm font-semibold text-muted-foreground md:flex">
            <Link href="/" className="transition-colors hover:text-foreground">Inicio</Link>
            <Link href="/explore" className="transition-colors hover:text-foreground">Explorar</Link>
            <Link href="/planificador-viajes-ia" className="transition-colors hover:text-foreground">Planificador IA</Link>
            <Link href="/viajes-colombia" className="transition-colors hover:text-foreground">Colombia</Link>
          </nav>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
          >
            Abrir la app
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-border/60 bg-[#0b0b0c] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{
              backgroundImage:
                "radial-gradient(60rem 30rem at 15% 10%, rgba(255,191,0,0.22), transparent 60%), radial-gradient(40rem 24rem at 85% 20%, rgba(255,191,0,0.10), transparent 60%), linear-gradient(180deg, #0b0b0c 0%, #141310 100%)",
            }}
          />
          <div className="relative mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
            <nav aria-label="Migas de pan" className="mb-8 flex flex-wrap items-center gap-2 text-xs font-medium text-white/60">
              <Link href="/" className="hover:text-primary">Inicio</Link>
              <span aria-hidden="true">/</span>
              <span className="text-white/85">Guías de viaje</span>
            </nav>

            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Guía VIANova IA
            </div>

            <h1 className="text-balance font-heading text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
              {page.h1}
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base leading-relaxed text-white/75 sm:text-lg">
              {page.intro}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:scale-[1.02]"
              >
                Planificar mi viaje
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/explore"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-semibold text-white/85 transition-colors hover:border-primary/50 hover:text-primary"
              >
                Explorar destinos
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-xs text-white/55">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                Actualizado: 27 de octubre de 2026
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                Colombia
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5" />
                Lectura de 8 a 12 minutos
              </span>
            </div>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8 lg:py-16">
          <article className="min-w-0">
            {page.sections.map((section, index) => (
              <section key={section.heading} id={slugifyHeading(section.heading, index)} className="mb-10 scroll-mt-24">
                <h2 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  {section.heading}
                </h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph.slice(0, 48)} className="mt-4 text-[15px] leading-7 text-muted-foreground sm:text-base">
                    {paragraph}
                  </p>
                ))}
                {section.bullets && section.bullets.length > 0 && (
                  <ul className="mt-5 space-y-2.5">
                    {section.bullets.map((bullet) => (
                      <li key={bullet} className="flex gap-2.5 text-[15px] leading-7 text-muted-foreground">
                        <CheckCircle2 className="mt-1.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}

            <section id="preguntas-frecuentes" className="mt-14 scroll-mt-24 rounded-3xl border border-border/60 bg-secondary/20 p-6 sm:p-8">
              <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Preguntas frecuentes</h2>
              <div className="mt-6 divide-y divide-border/60">
                {page.faqs.map((faq) => (
                  <details key={faq.question} className="group py-4">
                    <summary className="cursor-pointer list-none pr-6 text-base font-semibold text-foreground marker:hidden">
                      {faq.question}
                    </summary>
                    <p className="mt-3 text-[15px] leading-7 text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="mt-14">
              <h2 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl">Sigue planificando</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {page.related.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="group rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/50"
                  >
                    <span className="font-heading text-base font-bold group-hover:text-primary-ink">{link.label}</span>
                    <span className="mt-2 block text-sm leading-6 text-muted-foreground">{link.description}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary-ink">
                      Leer guía <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          </article>

          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <nav aria-label="Contenido de la guía" className="rounded-2xl border border-border/60 bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">En esta guía</p>
              <ol className="mt-4 space-y-2.5 text-sm">
                {page.sections.map((section, index) => (
                  <li key={section.heading}>
                    <a
                      href={`#${slugifyHeading(section.heading, index)}`}
                      className="text-muted-foreground transition-colors hover:text-primary-ink"
                    >
                      {section.heading}
                    </a>
                  </li>
                ))}
                <li>
                  <a href="#preguntas-frecuentes" className="text-muted-foreground transition-colors hover:text-primary-ink">
                    Preguntas frecuentes
                  </a>
                </li>
              </ol>
            </nav>

            <div className="rounded-2xl border border-primary/30 bg-primary/10 p-5">
              <p className="font-heading text-lg font-bold">¿Listo para tu itinerario?</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Cuéntale a la IA tus fechas, presupuesto e intereses. Recibe un plan editable en minutos.
              </p>
              <Link
                href="/"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
              >
                Crear plan gratis
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <nav aria-label="Otras guías" className="rounded-2xl border border-border/60 bg-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Otras guías</p>
              <ul className="mt-4 space-y-3 text-sm">
                {otherPages.map((other) => (
                  <li key={other.slug}>
                    <Link href={`/${other.slug}`} className="font-medium text-foreground transition-colors hover:text-primary-ink">
                      {other.h1}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        </div>
      </main>

      <footer className="border-t border-border/60 bg-secondary/20">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/brand-icon-192.png" alt="" className="h-8 w-8 rounded-lg" width={32} height={32} loading="lazy" />
              <span className="font-heading text-base font-extrabold">VIANova IA</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Planificador de viajes con inteligencia artificial. Itinerarios, proveedores locales y movilidad en un solo lugar.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Producto</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/" className="hover:text-primary-ink">Inicio</Link></li>
              <li><Link href="/explore" className="hover:text-primary-ink">Explorar destinos</Link></li>
              <li><Link href="/planificador-viajes-ia" className="hover:text-primary-ink">Planificador IA</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Guías</p>
            <ul className="mt-3 space-y-2 text-sm">
              {seoPages.map((guide) => (
                <li key={guide.slug}>
                  <Link href={`/${guide.slug}`} className="hover:text-primary-ink">{guide.h1.split(":")[0]}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Legal</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li><Link href="/privacy" className="hover:text-primary-ink">Privacidad</Link></li>
              <li><a href="/sitemap.xml" className="hover:text-primary-ink">Sitemap</a></li>
              <li><a href="/llms.txt" className="hover:text-primary-ink">llms.txt</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>© {currentYear} VIANova IA. Todos los derechos reservados.</p>
            <p>Hecho en Colombia para viajeros que quieren planificar mejor.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
