import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BIOMETRIC_CONSENT, CONSENT_VERSION, type PublicIdentity } from "@shared/identity";
import { Button } from "@/components/ui/button";
import { IdentityBadge } from "./IdentityBadge";
const actions: Record<string, string> = { center: "Mira de frente", left: "Gira la cabeza hacia tu derecha", right: "Gira la cabeza hacia tu izquierda" };
type Step = { id: string; action: string; step: number };
type Status = { identity: PublicIdentity; consent: boolean; enrolled: boolean; pendingApproval: boolean; manualRequested: boolean; faceReady?: boolean; manualReady?: boolean };
export function IdentityVerification() {
  const qc = useQueryClient();
  const { data, refetch, isLoading, isError, isFetching } = useQuery<Status>({ queryKey: ["/api/identity/me"], refetchInterval: 15_000 });
  const available = !!data && !isLoading && !isError;
  const faceReady = available && data.faceReady === true;
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step | null>(null), [message, setMessage] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const video = useRef<HTMLVideoElement>(null), stream = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);
  const [guide, setGuide] = useState("");
  useEffect(() => {
    if (!step) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const detect = async () => {
      try {
        const base = `${import.meta.env.BASE_URL}face-models/1.7.15`;
        const face = await import(/* @vite-ignore */ `${base}/face-api.esm.js`);
        if (!face.nets.tinyFaceDetector.isLoaded) await face.nets.tinyFaceDetector.loadFromUri(base);
        const loop = async () => {
          if (stopped) return;
          if (video.current?.readyState === 4) {
            const faces = await face.detectAllFaces(video.current, new face.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.6 }));
            if (!stopped) setGuide(faces.length === 1 ? "Rostro localizado. La calidad y la identidad las decide el servidor." : "Muestra un solo rostro completo con luz frontal.");
          }
          if (!stopped) timer = setTimeout(loop, 600);
        };
        await loop();
      } catch { if (!stopped) setGuide("Guía automática no disponible. Puedes continuar; el servidor comprobará la calidad."); }
    };
    void detect();
    return () => { stopped = true; clearTimeout(timer); };
    // A single lightweight local detector per camera session. No client descriptors.
  }, [!!step]);
  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setStep(null); setCameraOpen(false); };
  useEffect(() => { if (isError && step) stop(); }, [isError, step]);
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  const run = async (fn: () => Promise<void>, sync = true) => {
    setBusy(true); setMessage("");
    try { await fn(); if (sync) { await refetch(); await qc.invalidateQueries({ queryKey: ["taxi"] }); } }
    catch (e) {
      let text = e instanceof Error ? e.message : "No se pudo completar la verificación.";
      try { text = JSON.parse(text.replace(/^\d+:\s*/, '')).message || text; } catch { /* Camera/browser messages are already plain text. */ }
      setMessage(e instanceof Error && e.name === "NotAllowedError" ? "Permite el acceso a la cámara desde el navegador para continuar." : text);
    }
    finally { setBusy(false); }
  };
  const openCamera = async () => {
    if (stream.current && video.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices) throw new Error("Usa HTTPS o localhost para abrir la cámara.");
    const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    if (cancelled.current) { media.getTracks().forEach(t => t.stop()); return; }
    stream.current = media;
    setCameraOpen(true);
    try { if (video.current) { video.current.srcObject = media; await video.current.play(); } }
    catch (error) { stop(); throw error; }
  };
  const preview = () => run(async () => { await openCamera(); }, false);
  const begin = () => run(async () => {
    try {
      await openCamera();
      if (cancelled.current) return;
      setStep(await (await apiRequest("POST", "/api/identity/challenge", { purpose: data?.enrolled ? "verify" : "enroll" })).json());
    } catch (e) { stop(); throw e; }
  });
  const capture = () => run(async () => {
    if (!video.current?.videoWidth || !step) throw new Error("Espera a que aparezca la cámara.");
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 640 / Math.max(video.current.videoWidth, video.current.videoHeight));
    canvas.width = Math.round(video.current.videoWidth * ratio); canvas.height = Math.round(video.current.videoHeight * ratio);
    canvas.getContext("2d")!.drawImage(video.current, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.8).split(",")[1]; canvas.width = canvas.height = 1;
    try {
      const next = await (await apiRequest("POST", "/api/identity/frame", { id: step.id, jpeg })).json();
      if (next.done) { stop(); setMessage(next.pendingApproval ? "Enrolamiento recibido. Un administrador debe cotejar el documento y aprobar tu nombre." : "Identidad verificada. Ya puedes iniciar el turno."); }
      else setStep(next);
    } catch (e) { stop(); throw e; }
  });
  return <section id="verificacion-facial" className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-labelledby="verificacion-facial-titulo">
    <h2 id="verificacion-facial-titulo" className="text-lg font-semibold">Verificación facial</h2>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy || cameraOpen} onClick={preview}>Abrir cámara de vista previa</Button>
      <Button disabled={!faceReady || !data?.consent || data.pendingApproval || busy || !!step} onClick={begin}>{data?.enrolled ? "Verificar con cámara" : "Añadir mi rostro"}</Button>
      {available && data.manualReady && <Button variant="outline" disabled={busy} onClick={() => run(async () => { stop(); await apiRequest("POST", "/api/identity/manual"); setMessage("Revisión manual solicitada. Contacta al administrador para cotejar el documento."); })}>Solicitar revisión manual</Button>}
    </div>
    {isLoading && <p role="status" className="text-sm text-muted-foreground">Consultando tu verificación…</p>}
    {isError && <div role="alert" className="space-y-2 rounded-xl border border-border bg-secondary p-3 text-sm">
      <p>La verificación facial no está disponible en este momento. Contacta al administrador o vuelve a intentarlo.</p>
      <Button variant="outline" disabled={isFetching} onClick={() => refetch()}>Reintentar conexión</Button>
    </div>}
    {available && <IdentityBadge identity={data?.identity} />}
    {available && !faceReady && <p role="status" className="text-sm text-muted-foreground">El registro facial está pendiente de habilitación. Puedes abrir la vista previa de cámara; para registrar el rostro, contacta al administrador.</p>}
    <p className="text-sm text-muted-foreground">Un administrador aprueba el nombre al revisar tu documento. Puedes elegir revisión manual sin usar el rostro.</p>
    {faceReady && !data?.consent && <><p className="text-sm text-muted-foreground">Para activar «Añadir mi rostro», revisa y guarda primero esta autorización específica.</p><details className="text-sm"><summary className="cursor-pointer py-2">Consentimiento biométrico (borrador: revisar con abogado)</summary><p className="py-2">{BIOMETRIC_CONSENT}</p></details>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 h-5 w-5" />Autorizo específicamente el tratamiento facial descrito en el borrador.</label>
      <Button disabled={!accepted || busy} onClick={() => run(async () => { await apiRequest("POST", "/api/identity/consent", { version: CONSENT_VERSION, accepted: true }); })}>Guardar autorización</Button></>}
    <div className="flex flex-wrap gap-2">
      {available && data?.consent && <Button variant="outline" disabled={busy} onClick={() => run(async () => { stop(); await apiRequest("DELETE", "/api/identity/consent"); setAccepted(false); setMessage("Autorización revocada y plantilla eliminada."); })}>Revocar y eliminar plantilla</Button>}
    </div>
    {data?.pendingApproval && <p className="text-sm">Pendiente de aprobación documental.</p>}
    <video ref={video} muted autoPlay playsInline aria-label="Cámara para verificar tu rostro" hidden={!cameraOpen} className="max-h-64 w-full rounded-xl bg-black object-contain" />
    {cameraOpen && !step && <div className="space-y-2"><p className="text-sm text-muted-foreground">Esta vista previa permanece en tu dispositivo. El registro del rostro solo empieza después de guardar tu autorización y cuando el servicio esté disponible.</p><Button variant="outline" disabled={busy} onClick={stop}>Cerrar cámara</Button></div>}
    {step && <div className="space-y-2"><p role="status">Paso {step.step + 1} de 5: {actions[step.action]}. Usa luz frontal y mantén el teléfono derecho.</p><p className="text-sm">{guide}</p><Button disabled={busy} onClick={capture}>Confirmar posición</Button><Button variant="outline" disabled={busy} onClick={stop}>Cerrar cámara</Button></div>}
    <p role="status" aria-live="polite" className="text-sm break-words">{busy ? "Procesando en el servidor…" : message}</p>
  </section>;
}
