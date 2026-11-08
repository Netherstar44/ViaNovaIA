import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { BIOMETRIC_CONSENT, CONSENT_VERSION, type PublicIdentity } from "@shared/identity";
import { Button } from "@/components/ui/button";
import { IdentityBadge } from "./IdentityBadge";
const actions: Record<string, string> = { center: "Mira de frente", left: "Gira la cabeza hacia tu derecha", right: "Gira la cabeza hacia tu izquierda" };
type Step = { id: string; action: string; step: number };
type Status = { identity: PublicIdentity; consent: boolean; enrolled: boolean; pendingApproval: boolean; manualRequested: boolean };
export function IdentityVerification() {
  const qc = useQueryClient();
  const { data, refetch } = useQuery<Status>({ queryKey: ["/api/identity/me"], refetchInterval: 15_000 });
  const [accepted, setAccepted] = useState(false), [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step | null>(null), [message, setMessage] = useState("");
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
  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; setStep(null); };
  useEffect(() => { cancelled.current = false; return () => { cancelled.current = true; stream.current?.getTracks().forEach(t => t.stop()); }; }, []);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await fn(); await refetch(); await qc.invalidateQueries({ queryKey: ["taxi"] }); }
    catch (e) { setMessage(e instanceof Error ? e.message : "No se pudo completar la verificación."); }
    finally { setBusy(false); }
  };
  const begin = () => run(async () => {
    stop();
    if (!window.isSecureContext || !navigator.mediaDevices) throw new Error("Usa HTTPS o localhost para abrir la cámara.");
    const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    if (cancelled.current) { media.getTracks().forEach(t => t.stop()); return; }
    stream.current = media;
    try {
      setStep(await (await apiRequest("POST", "/api/identity/challenge", { purpose: data?.enrolled ? "verify" : "enroll" })).json());
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
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
  return <section className="rounded-2xl border border-border bg-card p-4 space-y-3" aria-label="Verificación de identidad">
    <h2 className="text-lg font-semibold">Verifica tu identidad</h2><IdentityBadge identity={data?.identity} />
    <p className="text-sm text-muted-foreground">Un administrador aprueba el nombre al revisar tu documento. Puedes elegir revisión manual sin usar el rostro.</p>
    {!data?.consent && <><details className="text-sm"><summary className="cursor-pointer py-2">Consentimiento biométrico (borrador: revisar con abogado)</summary><p className="py-2">{BIOMETRIC_CONSENT}</p></details>
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} className="mt-1 h-5 w-5" />Autorizo específicamente el tratamiento facial descrito en el borrador.</label>
      <Button disabled={!accepted || busy} onClick={() => run(async () => { await apiRequest("POST", "/api/identity/consent", { version: CONSENT_VERSION, accepted: true }); })}>Guardar autorización</Button></>}
    <div className="flex flex-wrap gap-2">
      {data?.consent && !data.pendingApproval && <Button disabled={busy || !!step} onClick={begin}>{data.enrolled ? "Verificar con cámara" : "Enrolar rostro"}</Button>}
      <Button variant="outline" disabled={busy} onClick={() => run(async () => { stop(); await apiRequest("POST", "/api/identity/manual"); setMessage("Revisión manual solicitada. Contacta al administrador para cotejar el documento."); })}>Solicitar revisión manual</Button>
      {data?.consent && <Button variant="outline" disabled={busy} onClick={() => run(async () => { stop(); await apiRequest("DELETE", "/api/identity/consent"); setAccepted(false); setMessage("Autorización revocada y plantilla eliminada."); })}>Revocar y eliminar plantilla</Button>}
    </div>
    {data?.pendingApproval && <p className="text-sm">Pendiente de aprobación documental.</p>}
    <video ref={video} muted autoPlay playsInline aria-label="Cámara para verificar tu rostro" hidden={!step} className="max-h-64 w-full rounded-xl bg-black object-contain" />
    {step && <div className="space-y-2"><p role="status">Paso {step.step + 1} de 5: {actions[step.action]}. Usa luz frontal y mantén el teléfono derecho.</p><p className="text-sm">{guide}</p><Button disabled={busy} onClick={capture}>Confirmar posición</Button><Button variant="outline" disabled={busy} onClick={stop}>Cerrar cámara</Button></div>}
    <p role="status" aria-live="polite" className="text-sm break-words">{busy ? "Procesando en el servidor…" : message}</p>
  </section>;
}
