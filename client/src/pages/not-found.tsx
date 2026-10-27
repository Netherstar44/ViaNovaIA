import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowRight } from "lucide-react";
import { seoPages } from "@shared/seo-content";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg border-border/60">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle className="h-8 w-8 text-primary-ink" />
            <h1 className="font-heading text-2xl font-bold text-foreground">Página no encontrada</h1>
          </div>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            La dirección que abriste no existe o cambió de lugar. Puedes volver al inicio, explorar destinos o leer
            nuestras guías de viaje.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              Volver al inicio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-semibold"
            >
              Explorar destinos
            </Link>
          </div>

          <div className="mt-6 border-t border-border/60 pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Guías populares</p>
            <ul className="mt-3 space-y-2 text-sm">
              {seoPages.map((page) => (
                <li key={page.slug}>
                  <Link href={`/${page.slug}`} className="font-medium hover:text-primary-ink">
                    {page.h1.split(":")[0]}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
