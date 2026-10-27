import { Link } from "wouter";
import { seoPages } from "@shared/seo-content";
import { ArrowRight, BookOpen, MapPin, Sparkles } from "lucide-react";

const guideIcons = [Sparkles, MapPin, BookOpen, BookOpen];

export default function HomeSeoSection() {
  return (
    <section aria-labelledby="home-seo-title" className="border-t border-border/60 bg-secondary/20">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-primary-ink">
            <Sparkles className="h-3.5 w-3.5" />
            Guías de viaje
          </p>
          <h2 id="home-seo-title" className="mt-4 font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Planifica tu viaje a Colombia con inteligencia artificial
          </h2>
          <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
            VIANova IA convierte tus fechas, presupuesto e intereses en un itinerario con hoteles, restaurantes,
            experiencias y transporte local. Explora el mapa, compara opciones y guarda el plan completo en tu cuenta.
          </p>
          <p className="mt-3 text-[15px] leading-7 text-muted-foreground">
            Si es tu primera vez en el país, empieza por nuestras guías de Colombia, del Huila y de la Tatacoa. Si ya
            tienes claro el destino, abre el planificador y pide un itinerario a tu medida.
          </p>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {seoPages.map((page, index) => {
            const Icon = guideIcons[index] ?? BookOpen;
            return (
              <Link
                key={page.slug}
                href={`/${page.slug}`}
                className="group flex flex-col rounded-2xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/50"
              >
                <Icon className="h-5 w-5 text-primary-ink" aria-hidden="true" />
                <span className="mt-4 font-heading text-base font-bold leading-snug group-hover:text-primary-ink">
                  {page.h1.split(":")[0]}
                </span>
                <span className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                  {page.description.split(".")[0]}.
                </span>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary-ink">
                  Leer guía <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-5 text-xs font-medium text-muted-foreground">
          <Link href="/" className="hover:text-primary-ink">Inicio</Link>
          <Link href="/explore" className="hover:text-primary-ink">Explorar destinos</Link>
          <Link href="/privacy" className="hover:text-primary-ink">Privacidad</Link>
          <a href="/sitemap.xml" className="hover:text-primary-ink">Sitemap</a>
          <a href="/llms.txt" className="hover:text-primary-ink">llms.txt</a>
          <span className="sm:ml-auto">© {new Date().getFullYear()} VIANova IA</span>
        </div>
      </div>
    </section>
  );
}
