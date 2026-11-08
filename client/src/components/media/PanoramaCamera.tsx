import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { angularDistance, captureTargets, wrapYaw, type Pose } from "@shared/sphere";
import { horizontalFovForFrame, verticalFov } from "@/lib/panoramaStitcher";
import { withGpano } from "@/lib/panoramaMetadata";
import { devicePose } from "@/lib/devicePose";
type Props = { onCapture: (file: File) => Promise<void> | void };
export function PanoramaCamera({ onCapture }: Props) {
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null), worker = useRef<Worker | null>(null);
  const origin = useRef<number | null>(null), lastPose = useRef<Pose | null>(null), mounted = useRef(true), working = useRef(false);
  const [active, setActive] = useState(false), [busy, setBusy] = useState(false), [manual, setManual] = useState(false);
  const [pose, setPose] = useState<Pose | null>(null), [targets, setTargets] = useState<Pose[]>([]);
  const [step, setStep] = useState(0), [coverage, setCoverage] = useState(0), [message, setMessage] = useState("");
  const [resolution, setResolution] = useState(4096), [hFov, setHFov] = useState(65), [vFov, setVFov] = useState(40);
  const cleanup = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; worker.current?.terminate(); worker.current = null; working.current = false; };
  useEffect(() => {
    mounted.current = true;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null || !stream.current) return;
      const next = devicePose(e.alpha, e.beta, e.gamma, screen.orientation?.angle ?? 0);
      if (origin.current === null) origin.current = next.yaw;
      next.yaw = wrapYaw(next.yaw - origin.current);
      lastPose.current = next; setPose(next);
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => { mounted.current = false; cleanup(); window.removeEventListener("deviceorientation", onOrientation); };
  }, []);
  const start = async () => {
    setBusy(true); setMessage(""); cleanup(); origin.current = null; lastPose.current = null; setPose(null);
    try {
      if (!window.isSecureContext || !navigator.mediaDevices) throw new Error("La cámara requiere HTTPS o localhost. Puedes importar una foto de cámara 360 desde la pantalla anterior.");
      const orientation = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> } | undefined;
      let sensors = !!orientation;
      if (orientation?.requestPermission) sensors = await orientation.requestPermission() === "granted";
      setManual(!sensors);
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      if (!mounted.current) { media.getTracks().forEach(t => t.stop()); return; }
      stream.current = media;
      if (!video.current) throw new Error("No se pudo preparar la cámara.");
      video.current.srcObject = media; await video.current.play();
      if (!video.current.videoWidth) await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("La cámara no entregó imagen. Reintenta.")), 5000);
        video.current!.addEventListener("loadedmetadata", () => { clearTimeout(timer); resolve(); }, { once: true });
      });
      const h = horizontalFovForFrame(video.current.videoWidth, video.current.videoHeight, hFov);
      const v = verticalFov(h, video.current.videoWidth, video.current.videoHeight);
      setHFov(h); setVFov(v); setTargets(captureTargets(h, v)); setStep(0); setCoverage(0);
      const w = new Worker(new URL("../../lib/sphere.worker.ts", import.meta.url), { type: "module" }); worker.current = w;
      w.onerror = () => { working.current = false; setBusy(false); setMessage("El ensamblador no pudo iniciar. Importa una imagen 360 o reintenta a 2048 px."); };
      w.onmessage = async event => {
        if (!mounted.current) return;
        const data = event.data;
        if (data.type === "progress") { setCoverage(data.coverage); setStep(s => s + 1); }
        if (data.type === "error") setMessage(data.message);
        if (data.type === "result") {
          try {
            const canvas = document.createElement("canvas"); canvas.width = data.width; canvas.height = data.height;
            canvas.getContext("2d")!.putImageData(new ImageData(data.pixels, data.width, data.height), 0, 0);
            const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
            canvas.width = canvas.height = 1;
            if (!blob) throw new Error("No se pudo exportar la esfera.");
            const tagged = withGpano(new Uint8Array(await blob.arrayBuffer()), data.width, data.height, data.coverage);
            await onCapture(new File([tagged], `esfera-${Date.now()}.jpg`, { type: "image/jpeg" }));
          } catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo exportar."); }
          finally { cleanup(); setActive(false); }
        }
        working.current = false; setBusy(false);
      };
      w.postMessage({ type: "init", width: resolution }); setActive(true);
      setTimeout(() => { if (mounted.current && !lastPose.current && stream.current) { setManual(true); setMessage("No llegan datos de orientación. Sigue los ángulos manualmente; la cobertura será estimada."); } }, 2500);
    } catch (e) { cleanup(); setMessage(e instanceof Error ? e.message : "No se pudo abrir la cámara. Revisa los permisos."); setBusy(false); }
  };
  const target = targets[step], aligned = !!target && !!pose && angularDistance(pose, target) < 8 && (Math.abs(target.pitch) > 75 || Math.abs(pose.roll) < 12);
  const capture = () => {
    if (working.current || !video.current?.videoWidth || !target || !worker.current) return;
    working.current = true; setBusy(true); setMessage("");
    const canvas = document.createElement("canvas"); canvas.width = video.current.videoWidth; canvas.height = video.current.videoHeight;
    const ctx = canvas.getContext("2d")!; ctx.drawImage(video.current, 0, 0);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    worker.current.postMessage({ type: "frame", frame, pose: manual ? target : lastPose.current, hFov, vFov }, [frame.data.buffer]);
    canvas.width = canvas.height = 1;
  };
  return <section className="space-y-3 rounded-xl bg-card p-4 text-foreground" aria-label="Captura esférica guiada">
    <p className="text-sm">Gira sobre el centro de la lente: anillos hacia arriba y abajo, luego cenit y nadir. Evita mover el teléfono de sitio. Las zonas no capturadas se muestran negras.</p>
    <video ref={video} playsInline muted autoPlay className="w-full max-h-72 rounded-xl bg-black object-contain" aria-label="Cámara trasera para la esfera" />
    {!active && <div className="flex flex-wrap items-center gap-3"><label>Resolución <select className="rounded border bg-background p-2" value={resolution} onChange={e => setResolution(Number(e.target.value))}><option value={4096}>4096 × 2048</option><option value={2048}>2048 × 1024 (menos memoria)</option></select></label><label>FOV horizontal estimado <input type="number" min={40} max={90} value={hFov} onChange={e => setHFov(Math.max(40, Math.min(90, Number(e.target.value))))} className="w-20 rounded border bg-background p-2" />°</label><Button disabled={busy} onClick={start}>Activar cámara y sensores</Button></div>}
    {active && <>
      <p role="status">Toma {Math.min(step + 1, targets.length)} / {targets.length} · Cobertura geométrica estimada {coverage.toFixed(1)}% de la esfera.</p>
      <progress aria-label="Cobertura esférica estimada" value={coverage} max={100} className="w-full" />
      <p>{target ? `Apunta a giro ${target.yaw.toFixed(0)}°, inclinación ${target.pitch.toFixed(0)}°${Math.abs(target.pitch) === 90 ? target.pitch > 0 ? ' (cenit)' : ' (nadir)' : ' (anillo)'}.` : "Recorrido terminado. Revisa la cobertura antes de guardar."}</p>
      <p className="text-sm text-muted-foreground">{pose && !manual ? `Sensor: giro ${pose.yaw.toFixed(0)}°, inclinación ${pose.pitch.toFixed(0)}°, balanceo ${pose.roll.toFixed(0)}°.` : "Sin giroscopio: alinea cada toma con la guía manual. No podemos comprobar la cobertura física."}</p>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={manual} onChange={e => setManual(e.target.checked)} className="h-5 w-5" />Usar alineación manual (orientación estimada)</label>
      <div className="flex flex-wrap gap-2"><Button disabled={busy || !target || (!manual && !aligned)} onClick={capture}>{busy ? "Proyectando…" : aligned || manual ? "Capturar posición" : "Alinea con el objetivo"}</Button>
        <Button variant="outline" disabled={busy || step < 1} onClick={() => { working.current = true; setBusy(true); worker.current?.postMessage({ type: "finish" }); }}>Guardar {coverage > 99.5 ? "esfera" : "cobertura parcial"}</Button>
        <Button variant="outline" disabled={busy} onClick={() => { cleanup(); setActive(false); }}>Cancelar captura</Button></div>
    </>}
    <p role="status" aria-live="polite" className="text-sm">{message}</p>
    <p className="text-xs text-muted-foreground">El FOV del teléfono se estima; sin calibración óptica ni corrección de paralaje no se garantizan costuras invisibles. Una cámara 360 dedicada ofrece mayor precisión.</p>
  </section>;
}
