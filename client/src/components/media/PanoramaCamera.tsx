import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  MIN_COVERAGE_DEG,
  clearPanorama,
  columnProfile,
  coverageDeg,
  createPanoramaCanvas,
  drawPanoramaFrame,
  estimateShift,
  fillPanoramaPoles,
  horizontalFovForFrame,
  panoramaToFile,
  verticalFov,
} from "@/lib/panoramaStitcher";

type CameraStatus = "idle" | "requesting" | "live" | "paused" | "finishing";

interface PanoramaCameraProps {
  /** Recibe el JPEG equirectangular listo para validar y subir. */
  onCapture: (file: File) => Promise<void> | void;
}

const SAMPLE_WIDTH = 480;
const SAMPLE_INTERVAL_MS = 220;
const MIN_SHIFT_SCORE = 0.5;
const MIN_SHIFT_PX = 0.75;

function describeCameraError(error: unknown): string {
  if (!(error instanceof Error)) return "No se pudo abrir la cámara.";
  switch (error.name) {
    case "NotAllowedError":
    case "SecurityError":
      return "El navegador bloqueó la cámara. Concede el permiso desde el candado de la barra de direcciones o abre la app instalada.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "No encontramos una cámara disponible en este dispositivo.";
    case "NotReadableError":
      return "La cámara está siendo usada por otra aplicación. Ciérrala e inténtalo de nuevo.";
    default:
      return error.message || "No se pudo abrir la cámara.";
  }
}

function waitForVideoSize(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth && video.videoHeight) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      video.removeEventListener("loadedmetadata", done);
      resolve();
    };
    video.addEventListener("loadedmetadata", done, { once: true });
    window.setTimeout(done, 1500);
  });
}

export function PanoramaCamera({ onCapture }: PanoramaCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const panoramaRef = useRef<{ canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const sampleRef = useRef<HTMLCanvasElement | null>(null);
  const frameSizeRef = useRef({ width: 0, height: 0 });
  const profileRef = useRef<Float32Array | null>(null);
  const yawRef = useRef(0);
  const minYawRef = useRef(Number.POSITIVE_INFINITY);
  const maxYawRef = useRef(Number.NEGATIVE_INFINITY);
  const coverageRef = useRef(0);
  const framesRef = useRef(0);
  const missedRef = useRef(0);
  const finishingRef = useRef(false);
  const requestingRef = useRef(false);
  const mountedRef = useRef(true);
  const onCaptureRef = useRef(onCapture);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [coverage, setCoverage] = useState(0);
  const [frames, setFrames] = useState(0);
  const [hint, setHint] = useState("Activa la cámara y gira despacio sobre ti.");
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopStream();
    };
  }, [stopStream]);

  const prepareCanvas = useCallback((frameWidth: number, frameHeight: number) => {
    const panorama = createPanoramaCanvas();
    panoramaRef.current = panorama;
    scratchRef.current = document.createElement("canvas");

    const sample = document.createElement("canvas");
    sample.width = SAMPLE_WIDTH;
    sample.height = Math.max(2, Math.round(SAMPLE_WIDTH / (frameWidth / frameHeight)));
    sampleRef.current = sample;

    frameSizeRef.current = { width: frameWidth, height: frameHeight };
    profileRef.current = null;
    yawRef.current = 0;
    minYawRef.current = Number.POSITIVE_INFINITY;
    maxYawRef.current = Number.NEGATIVE_INFINITY;
    coverageRef.current = 0;
    framesRef.current = 0;
    missedRef.current = 0;
    finishingRef.current = false;

    setCoverage(0);
    setFrames(0);
    setLost(false);
    setHint("Gira el teléfono en horizontal. Mantén el horizonte al centro.");
  }, []);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    const panorama = panoramaRef.current;
    if (!panorama) return;

    const reached = coverageRef.current;
    if (reached < MIN_COVERAGE_DEG) {
      setError(`Necesitas al menos ${MIN_COVERAGE_DEG}° de barrido. Llevas ${Math.round(reached)}°.`);
      return;
    }

    finishingRef.current = true;
    setStatus("finishing");
    setError(null);

    try {
      const { width, height } = frameSizeRef.current;
      const hFov = horizontalFovForFrame(width, height);
      const vFov = verticalFov(hFov, width, height);
      fillPanoramaPoles(panorama.context, vFov);
      const file = await panoramaToFile(panorama.canvas, `panorama-360-${Date.now()}.jpg`);
      await onCaptureRef.current(file);

      // Si el padre no desmontó la cámara (por ejemplo, la validación falló),
      // dejamos el barrido en pausa para poder reintentar sin perderlo.
      if (mountedRef.current) {
        finishingRef.current = false;
        setStatus("paused");
      }
    } catch (caught) {
      finishingRef.current = false;
      setStatus("paused");
      setError(caught instanceof Error ? caught.message : "No se pudo crear el panorama.");
    }
  }, []);

  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  }, [finish]);

  const sampleFrame = useCallback(() => {
    if (finishingRef.current) return;
    const video = videoRef.current;
    const sample = sampleRef.current;
    const panorama = panoramaRef.current;
    const scratch = scratchRef.current;
    if (!video || !sample || !panorama || !scratch) return;
    if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

    const context = sample.getContext("2d", { willReadFrequently: true });
    if (!context) return;

    context.drawImage(video, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    const profile = columnProfile(pixels, sample.width, sample.height);
    const hFov = horizontalFovForFrame(video.videoWidth, video.videoHeight);
    const vFov = verticalFov(hFov, video.videoWidth, video.videoHeight);
    const previous = profileRef.current;

    if (!previous) {
      const startYaw = hFov / 2;
      yawRef.current = startYaw;
      minYawRef.current = startYaw;
      maxYawRef.current = startYaw;
      // El primer fotograma va opaco: sus bordes exteriores forman el cierre
      // del círculo y no deben quedar transparentes.
      drawPanoramaFrame(
        panorama.context,
        video,
        { yawDeg: startYaw, hFovDeg: hFov, vFovDeg: vFov, feather: "none" },
        scratch,
      );
      profileRef.current = profile;
      framesRef.current = 1;
      coverageRef.current = hFov;
      setFrames(1);
      setCoverage(Math.round(hFov));
      setHint("Bien. Sigue girando hacia un lado, sin cambiar la inclinación.");
      return;
    }

    const result = estimateShift(previous, profile);

    if (result.score < MIN_SHIFT_SCORE) {
      missedRef.current += 1;
      if (missedRef.current >= 3) {
        // Reengancha el seguimiento en la orientación actual. El hueco queda
        // marcado para que la persona pueda reiniciar si quiere un 360 limpio.
        profileRef.current = profile;
        missedRef.current = 0;
        setLost(true);
        setHint("Se perdió el hilo. Reinicia el barrido para evitar una zona vacía.");
      } else {
        setHint("Gira más despacio, con el horizonte al centro.");
      }
      return;
    }

    missedRef.current = 0;

    if (Math.abs(result.shift) < MIN_SHIFT_PX) {
      setHint("Sigue girando…");
      return;
    }

    const delta = (result.shift / sample.width) * hFov;
    if (!Number.isFinite(delta) || Math.abs(delta) > hFov * 0.6) {
      setHint("Gira más despacio para no perder el hilo.");
      return;
    }

    const nextYaw = yawRef.current + delta;
    yawRef.current = nextYaw;
    minYawRef.current = Math.min(minYawRef.current, nextYaw);
    maxYawRef.current = Math.max(maxYawRef.current, nextYaw);

    drawPanoramaFrame(
      panorama.context,
      video,
      {
        yawDeg: nextYaw,
        hFovDeg: hFov,
        vFovDeg: vFov,
        // Fundimos solo el borde que se solapa con el fotograma anterior.
        // Así el borde de cierre del círculo queda opaco y sin costura negra.
        feather: delta >= 0 ? "left" : "right",
      },
      scratch,
    );

    profileRef.current = profile;
    framesRef.current += 1;
    const reached = Math.min(360, coverageDeg(minYawRef.current, maxYawRef.current) + hFov);
    coverageRef.current = reached;
    setFrames(framesRef.current);
    setCoverage(Math.round(reached));
    setHint(reached >= 340 ? "Casi listo: completa el círculo." : "Buen ritmo. Sigue girando.");

    if (reached >= 359.5) {
      void finishRef.current();
    }
  }, []);

  const start = useCallback(async () => {
    if (requestingRef.current) return;
    requestingRef.current = true;
    setError(null);
    setStatus("requesting");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Este navegador no puede abrir la cámara. Prueba con Chrome o Safari actualizado.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stopStream();
        return;
      }

      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await waitForVideoSize(video);

      if (!video.videoWidth || !video.videoHeight) {
        throw new Error("La cámara no entregó imagen. Cierra otras apps que la estén usando.");
      }

      prepareCanvas(video.videoWidth, video.videoHeight);
      setStatus("live");
    } catch (caught) {
      stopStream();
      setStatus("idle");
      setError(describeCameraError(caught));
    } finally {
      requestingRef.current = false;
    }
  }, [prepareCanvas, stopStream]);

  useEffect(() => {
    if (status !== "live") return;
    const id = window.setInterval(sampleFrame, SAMPLE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [status, sampleFrame]);

  const pause = () => {
    if (status === "live") {
      setStatus("paused");
      setHint("Barrido en pausa. Reanuda cuando estés listo.");
    }
  };

  const resume = () => {
    if (status === "paused") {
      setError(null);
      setStatus("live");
      setHint("Sigue girando despacio.");
    }
  };

  const reset = () => {
    const panorama = panoramaRef.current;
    if (panorama) clearPanorama(panorama.context);
    profileRef.current = null;
    yawRef.current = 0;
    minYawRef.current = Number.POSITIVE_INFINITY;
    maxYawRef.current = Number.NEGATIVE_INFINITY;
    coverageRef.current = 0;
    framesRef.current = 0;
    missedRef.current = 0;
    setCoverage(0);
    setFrames(0);
    setLost(false);
    setError(null);
    setHint("Gira despacio sobre ti para empezar de nuevo.");
  };

  const busy = status === "requesting" || status === "finishing";
  const active = status === "live" || status === "paused" || status === "finishing";
  const progress = Math.min(100, (coverage / 360) * 100);
  const canFinish = coverage >= MIN_COVERAGE_DEG && status !== "finishing";

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div className="relative aspect-video w-full">
          <video
            ref={videoRef}
            playsInline
            muted
            aria-label="Vista previa de la cámara para el panorama 360"
            className={`h-full w-full object-contain transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}
          />

          {!active && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/[0.02] px-6 text-center">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-16 left-1/2 h-44 w-44 -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
              />
              <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-black/40 text-primary">
                <Camera className="h-6 w-6" />
              </span>
              <div className="relative">
                <p className="text-sm font-semibold text-white">
                  {status === "requesting" ? "Abriendo la cámara…" : "Tu panorama empieza aquí"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-5 text-white/45">
                  {status === "requesting"
                    ? "Concede el permiso si el navegador lo solicita."
                    : "Gira sobre ti mientras la app une los fotogramas. Se detiene sola al completar los 360°."}
                </p>
              </div>
              {status === "requesting" && <Loader2 className="relative h-5 w-5 animate-spin text-primary" />}
            </div>
          )}

          {active && (
            <>
              <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 bg-gradient-to-b from-black/75 via-black/25 to-transparent p-3">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/85">
                  <Camera className="h-3 w-3 text-primary" />
                  360°
                </span>
                <span className="rounded-full border border-white/15 bg-black/70 px-2.5 py-1 text-[10px] font-semibold text-white/75">
                  {frames} {frames === 1 ? "captura" : "capturas"}
                </span>
              </div>

              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-px w-2/3 bg-white/20" />
                <div className="absolute h-7 w-px bg-white/25" />
              </div>

              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-4 pt-10">
                <div className="flex items-end justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[11.5px] leading-4 text-white/70">{hint}</p>
                  <p className="shrink-0 text-[11px] font-bold tabular-nums text-primary">
                    {coverage}° <span className="font-medium text-white/45">/ 360°</span>
                  </p>
                </div>
                <div
                  role="progressbar"
                  aria-label="Cobertura del barrido"
                  aria-valuemin={0}
                  aria-valuemax={360}
                  aria-valuenow={coverage}
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-amber-200 to-primary transition-[width] duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              {status === "paused" && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                  <span className="rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs font-semibold text-white/85">
                    Barrido en pausa
                  </span>
                </div>
              )}

              {status === "finishing" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="text-xs font-semibold text-white/85">Creando panorama…</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {lost && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-[12px] leading-5 text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          El seguimiento perdió el hilo y puede haber una zona vacía. Reinicia el barrido si quieres un 360° limpio.
        </p>
      )}

      {error && (
        <p className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] leading-5 text-red-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {status === "idle" && (
          <button
            type="button"
            onClick={() => void start()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-black transition hover:bg-primary/85 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            Activar cámara
          </button>
        )}

        {status === "live" && (
          <button
            type="button"
            onClick={pause}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2.5 text-xs font-semibold text-white/80 transition hover:border-primary/40 hover:text-white"
          >
            <Pause className="h-3.5 w-3.5" />
            Pausar
          </button>
        )}

        {status === "paused" && (
          <button
            type="button"
            onClick={resume}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2.5 text-xs font-semibold text-white/80 transition hover:border-primary/40 hover:text-white"
          >
            <Play className="h-3.5 w-3.5" />
            Reanudar
          </button>
        )}

        {(status === "live" || status === "paused") && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2.5 text-xs font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reiniciar
          </button>
        )}

        {(status === "live" || status === "paused") && (
          <button
            type="button"
            onClick={() => void finish()}
            disabled={!canFinish}
            title={
              canFinish
                ? "Une los fotogramas y crea el panorama"
                : `Gira al menos ${MIN_COVERAGE_DEG}° para crear el panorama`
            }
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-xs font-bold text-black transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Check className="h-3.5 w-3.5" />
            Crear panorama
          </button>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {[
          "Gira el teléfono en horizontal.",
          "Mantén el horizonte al centro.",
          "Muévete despacio y sin cambiar de altura.",
        ].map((tip) => (
          <p
            key={tip}
            className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[11px] leading-4 text-white/45"
          >
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary/60" />
            {tip}
          </p>
        ))}
      </div>

      <p className="text-[11px] leading-4 text-white/30">
        Mínimo {MIN_COVERAGE_DEG}° para crear el panorama. La captura se detiene automáticamente al llegar a 360°.
      </p>
    </div>
  );
}
