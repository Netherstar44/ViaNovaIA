import { Link } from "wouter";
import { seoPages } from "@shared/seo-content";
import { guideThumb, guideVisual } from "@shared/guide-visuals";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { LiquidGlass } from "@/components/ui/liquid-glass";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function HomeSeoSection() {
  const reduce = useReducedMotion();
  const featured = seoPages.find((page) => page.slug === "viajes-colombia") ?? seoPages[0];
  const listPages = seoPages.filter((page) => page.slug !== featured?.slug);
  const featuredVisual = guideVisual(featured.slug);

  return (
    <section
      aria-labelledby="home-seo-title"
      className="relative isolate overflow-hidden border-t border-[#e4dfd2] bg-[#f5f4f0] text-[#1f1f1f] dark:border-white/10 dark:bg-[#0b0e0c] dark:text-[#f2efe6]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          background:
            "radial-gradient(52rem 30rem at 4% -12%, rgba(255,191,0,0.16), transparent 62%), radial-gradient(46rem 28rem at 96% 2%, rgba(255,255,255,0.9), transparent 60%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            "radial-gradient(52rem 30rem at 4% -12%, rgba(255,191,0,0.12), transparent 62%), radial-gradient(46rem 28rem at 96% 2%, rgba(255,255,255,0.05), transparent 60%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <motion.header
          initial={reduce ? false : { opacity: 0, y: 18 }}
          whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10.5px] font-semibold uppercase tracking-[0.28em] text-[#8d8778] dark:text-white/45">
            <span aria-hidden="true" className="h-px w-9 bg-[#ffbf00]" />
            <span className="text-[#6f6a5e] dark:text-white/65">Guías de viaje</span>
            <span className="font-mono text-[10px] tabular-nums text-[#b3ac9b] dark:text-white/35">04</span>
            <span className="ml-auto hidden items-center gap-2 text-[10px] tracking-[0.22em] text-[#a49d8b] dark:text-white/40 sm:flex">
              <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#d6cfbd] dark:bg-white/25" />
              Lecturas breves
            </span>
          </div>

          <div className="mt-7 grid gap-7 min-[900px]:grid-cols-[minmax(0,1.22fr)_minmax(0,0.78fr)] min-[900px]:items-end min-[900px]:gap-12 lg:gap-16">
            <h2
              id="home-seo-title"
              className="max-w-[20ch] text-balance font-heading text-[clamp(2.1rem,4.2vw,3.6rem)] font-semibold leading-[1.04] tracking-[-0.035em] text-[#1c1b18] dark:text-white"
            >
              Colombia, sin prisa
              <br className="hidden sm:block" />{" "}
              <span className="relative inline-block">
                y con un buen plan.
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-1 h-[6px] rounded-full bg-[#ffbf00]/35 sm:-bottom-2 sm:h-[8px]"
                />
              </span>
            </h2>

            <div className="lg:pb-1">
              <p className="max-w-md text-pretty text-[14.5px] leading-7 text-[#5f5b51] dark:text-white/65">
                Cuatro lecturas para decidir mejor: cuándo viajar, qué hacer en el Huila, cómo se arma un
                itinerario con IA y cómo comparar alojamiento sin pagar de más.
              </p>
              <Link
                href="/planificador-viajes-ia"
                className="mt-5 inline-flex items-center gap-2 border-b border-[#c9a24a]/50 pb-1 text-[13px] font-semibold text-[#7d5e12] transition-colors hover:border-[#a87c00] hover:text-[#5c4400] dark:border-[#ffd34d]/40 dark:text-[#ffd34d] dark:hover:border-[#ffd34d] dark:hover:text-[#ffe89a]"
              >
                Conocer el planificador
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </motion.header>

        <div className="mt-12 grid gap-10 min-[900px]:mt-16 min-[900px]:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)] min-[900px]:gap-10 lg:gap-14">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.08 }}
          >
            <Link
              href={`/${featured.slug}`}
              className="group relative block overflow-hidden rounded-[24px] border border-white/80 bg-[#e9e4d7] shadow-[0_30px_70px_-40px_rgba(53,44,18,0.5)] dark:border-white/10 dark:bg-white/[0.04] dark:shadow-black/50"
            >
              <div className="relative aspect-[5/4] min-[900px]:aspect-[4/5]">
                <img
                  src={featuredVisual.image}
                  alt={featuredVisual.alt}
                  className="h-full w-full object-cover transition-transform duration-[1400ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.045]"
                  loading="lazy"
                  decoding="async"
                  width={1800}
                  height={2250}
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-gradient-to-t from-[#17140c]/62 via-[#17140c]/12 to-transparent"
                />

                <div className="absolute inset-x-5 top-5 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/90">
                    {featuredVisual.kicker}
                  </span>
                  <span className="font-mono text-[10px] tabular-nums text-white/70">01</span>
                </div>

                <LiquidGlass
                  variant="clear"
                  refract
                  interactive
                  className="home-seo-glass absolute inset-x-4 bottom-4 rounded-[20px] p-5 sm:inset-x-5 sm:bottom-5 sm:p-6"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#8a6a1a]">
                    {featuredVisual.place}
                  </p>
                  <h3 className="mt-2 font-heading text-[clamp(1.45rem,2.4vw,1.95rem)] font-semibold leading-[1.1] tracking-[-0.025em] text-[#1c1b18]">
                    {featured.h1.split(":")[0]}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-[#43413a]/80">
                    {featured.description}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-2 text-[12px] font-semibold text-[#1c1b18]">
                    Leer la guía
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </span>
                </LiquidGlass>
              </div>
            </Link>
          </motion.div>

          <div className="flex flex-col justify-center">
            <div className="border-t border-[#ddd7c8] dark:border-white/10">
              {listPages.map((page, index) => {
                const visual = guideVisual(page.slug);
                return (
                  <motion.div
                    key={page.slug}
                    initial={reduce ? false : { opacity: 0, y: 16 }}
                    whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.55, ease: EASE, delay: 0.06 * index }}
                  >
                    <Link
                      href={`/${page.slug}`}
                      className="group -mx-3 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border-b border-[#ddd7c8] px-3 py-6 transition-colors duration-300 hover:bg-white/60 dark:border-white/10 dark:hover:bg-white/[0.05] sm:gap-6 sm:py-7"
                    >
                      <span className="self-start pt-1 font-mono text-[10.5px] tabular-nums text-[#a49b83] transition-colors group-hover:text-[#8a6a1a] dark:text-white/35 dark:group-hover:text-[#ffd34d]">
                        {String(index + 2).padStart(2, "0")}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
                          <span className="text-[#8a6a1a] dark:text-[#ffd34d]">{visual.kicker}</span>
                          <span aria-hidden="true" className="text-[#c9c2b1] dark:text-white/20">/</span>
                          <span className="text-[#8d8778] dark:text-white/45">{visual.place}</span>
                        </div>
                        <h3 className="mt-2 text-balance font-heading text-[clamp(1.3rem,2vw,1.7rem)] font-semibold leading-[1.14] tracking-[-0.025em] text-[#1f1e1a] transition-colors duration-300 group-hover:text-[#6d5210] dark:text-white dark:group-hover:text-[#ffe08a]">
                          {page.h1.split(":")[0]}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 max-w-xl text-[13px] leading-6 text-[#625d52] dark:text-white/60">
                          {page.description}
                        </p>
                      </div>

                      <div className="hidden items-center gap-4 sm:flex">
                        <span className="relative block h-16 w-24 overflow-hidden rounded-xl border border-white shadow-[0_10px_24px_-16px_rgba(53,44,18,0.6)] dark:border-white/10 dark:shadow-black/40">
                          <img
                            src={guideThumb(page.slug)}
                            alt=""
                            aria-hidden="true"
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                            loading="lazy"
                            decoding="async"
                            width={480}
                            height={320}
                          />
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-[#a49b83] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#8a6a1a] dark:text-white/40 dark:group-hover:text-[#ffd34d]" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#e4dfd2] pt-6 text-[11px] text-[#8a8578] dark:border-white/10 dark:text-white/45">
              <Link href="/" className="transition-colors hover:text-[#1f1e1a] dark:hover:text-white">Inicio</Link>
              <Link href="/explore" className="transition-colors hover:text-[#1f1e1a] dark:hover:text-white">Explorar destinos</Link>
              <Link href="/privacy" className="transition-colors hover:text-[#1f1e1a] dark:hover:text-white">Privacidad</Link>
              <a href="/sitemap.xml" className="transition-colors hover:text-[#1f1e1a] dark:hover:text-white">Sitemap</a>
              <a href="/llms.txt" className="transition-colors hover:text-[#1f1e1a] dark:hover:text-white">llms.txt</a>
              <span className="sm:ml-auto">© {new Date().getFullYear()} VIANova</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
