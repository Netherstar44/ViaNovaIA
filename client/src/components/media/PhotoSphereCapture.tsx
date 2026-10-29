import { createPortal } from "react-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  Check,
  ImagePlus,
  Info,
  Loader2,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { inspectPanorama, preparePanorama, type PanoramaCheck } from "@/lib/photoSphere";
import { PanoramaCamera } from "./PanoramaCamera";

const Viewer360 = lazy(() => import("./Viewer360").then((module) => ({ default: module.Viewer360 })));

type Phase = "choose" | "camera" | "review";

interface PhotoSphereCaptureProps {
  open: boolean;
  onClose: () => void;
  /** Receives the validated (and, when needed, re-encoded) panorama. */
  onConfirm: (file: File) => void;
  title?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PhotoSphereCapture({ open, onClose, onConfirm, title = "Captura 360°" }: PhotoSphereCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("choose");
  const [preparing, setPreparing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [check, setCheck] = useState<PanoramaCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("choose");
    setFile(null);
    setCheck(null);
    setError(null);
    setPreparing(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    panel?.focus();

    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, phase]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const ingestPanorama = async (selected: File) => {
    setError(null);
    setPreparing(true);
    try {
      if (!selected.type.startsWith("image/")) {
        throw new Error("Selecciona una imagen panorámica (JPEG, PNG o WebP).");
      }
      const metadata = await inspectPanorama(selected);
      if (!metadata.ok) {
        throw new Error("La imagen es demasiado pequeña. Usa al menos 2048 × 1024 px.");
      }
      const ready = await preparePanorama(selected);
      const finalCheck = ready === selected ? metadata : await inspectPanorama(ready);
      setFile(ready);
      setCheck(finalCheck);
      setPhase("review");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFile = async (selected: File | null) => {
    if (!selected) return;
    try {
      await ingestPanorama(selected);
    } catch (caught) {
      setFile(null);
      setCheck(null);
      setError(caught instanceof Error ? caught.message : "No se pudo leer la imagen.");
      setPhase("choose");
    }
  };

  const handleConfirm = () => {
    if (!file) return;
    onConfirm(file);
    onClose();
  };

  const reset = () => {
    setFile(null);
    setCheck(null);
    setError(null);
    setPhase("choose");
  };

  const subtitle =
    phase === "camera"
      ? "Gira despacio sobre ti. La app une los fotogramas y se detiene al completar 360°."
      : phase === "review"
        ? "Revisa el panorama y confirma que se ve completo antes de subirlo."
        : "Captura un panorama guiado con la cámara o importa una foto equirectangular 2:1.";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="glass-scrim glass-scrim--deep fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={(event) => event.target === event.currentTarget && onClose()}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            tabIndex={-1}
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="liquid-glass liquid-glass--ink liquid-glass--refract flex w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-white/12 focus:outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary/80">Galería inmersiva</p>
                <h2 className="mt-1.5 font-heading text-xl font-semibold tracking-tight text-white">{title}</h2>
                <p className="mt-1 text-[13px] leading-5 text-white/55">{subtitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-lg border border-white/10 p-2 text-white/60 transition-colors hover:border-white/25 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
              {phase === "choose" && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setPhase("camera");
                    }}
                    className="group relative flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/[0.16] via-primary/[0.05] to-transparent p-4 text-left transition-colors hover:border-primary/50"
                  >
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/20 blur-3xl transition-opacity group-hover:opacity-80"
                    />
                    <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-black/40 text-primary">
                      <Camera className="h-5 w-5" />
                    </span>
                    <span className="relative min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">Capturar con la cámara</span>
                        <span className="inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-primary">
                          <Sparkles className="h-2.5 w-2.5" />
                          Guiado
                        </span>
                      </span>
                      <span className="mt-1 block text-[12.5px] leading-5 text-white/55">
                        Gira sobre ti siguiendo la guía. La app une los fotogramas y crea el panorama 2:1 sin instalar nada.
                      </span>
                    </span>
                    <span className="relative shrink-0 rounded-lg bg-primary px-3 py-2 text-[11px] font-bold text-black transition group-hover:bg-primary/85">
                      Abrir
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={preparing}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void handleFile(event.dataTransfer.files?.[0] ?? null);
                    }}
                    className="group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-6 py-8 text-center transition-colors hover:border-primary/45 hover:bg-primary/[0.04] disabled:opacity-60"
                  >
                    {preparing ? (
                      <Loader2 className="h-7 w-7 animate-spin text-primary" />
                    ) : (
                      <span className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-primary transition-transform group-hover:-translate-y-0.5">
                        <ImagePlus className="h-6 w-6" />
                      </span>
                    )}
                    <span className="text-sm font-semibold text-white">
                      {preparing ? "Procesando panorama…" : "Importar panorama"}
                    </span>
                    <span className="max-w-sm text-[12.5px] leading-5 text-white/45">
                      Arrastra la foto 360° o elige un archivo. Debe ser una imagen equirectangular en 2:1.
                    </span>
                  </button>

                  <div className="flex items-start gap-2.5 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-[12px] leading-5 text-white/45">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                    <p>
                      Busca buena luz y evita moverte del sitio: el panorama se ve mejor cuando giras sobre tu propio eje.
                      También puedes importar una foto 360° descargada.
                    </p>
                  </div>

                  {error && (
                    <p className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-300">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {error}
                    </p>
                  )}
                </div>
              )}

              {phase === "camera" && (
                <PanoramaCamera onCapture={ingestPanorama} />
              )}

              {phase === "review" && file && previewUrl && (
                <div className="space-y-4">
                  <div className="relative aspect-[2/1] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <Suspense
                      fallback={
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      }
                    >
                      <Viewer360 url={previewUrl} />
                    </Suspense>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Resolución</p>
                      <p className="mt-1 text-sm font-semibold text-white">
                        {check ? `${check.width} × ${check.height}` : "—"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Proporción</p>
                      <p className="mt-1 text-sm font-semibold text-white">{check ? `${check.ratio.toFixed(2)} : 1` : "—"}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/35">Peso</p>
                      <p className="mt-1 text-sm font-semibold text-white">{formatBytes(file.size)}</p>
                    </div>
                  </div>

                  {check?.warning && (
                    <p className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[12px] leading-5 text-amber-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {check.warning} Puedes continuar, pero el giro puede verse deformado.
                    </p>
                  )}

                  <p className="flex items-start gap-2 text-[12px] leading-5 text-white/45">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
                    Arrastra la vista previa para comprobar el panorama antes de subirlo.
                  </p>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-white/[0.07] px-6 py-4">
              {phase === "review" ? (
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white/60 transition hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Elegir otra
                </button>
              ) : phase === "camera" ? (
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setPhase("choose");
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white/60 transition hover:text-white"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Volver
                </button>
              ) : (
                <span className="text-[11px] text-white/30">JPEG, PNG o WebP · hasta 10 MB</span>
              )}

              {phase === "review" ? (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-black transition hover:bg-primary/85"
                >
                  <Check className="h-4 w-4" />
                  Usar este panorama
                </button>
              ) : phase === "camera" ? (
                <span className="text-[11px] text-white/30">Se detiene solo a 360°</span>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 transition hover:border-primary/40 hover:text-white"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Elegir archivo
                </button>
              )}
            </footer>

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0] ?? null)}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
