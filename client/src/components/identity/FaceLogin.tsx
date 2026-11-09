import { useEffect, useRef, useState } from "react";
import { apiBase } from "@/lib/queryClient";
import { authHeaders } from "@/lib/secureStorage";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Camera, Loader2, ScanFace } from "lucide-react";

const actions: Record<string, string> = {
  center: "Mira de frente",
  left: "Gira la cabeza hacia tu derecha",
  right: "Gira la cabeza hacia tu izquierda",
};

type Step = { id: string; action: string; step: number };

type Props = {
  /** Usuario o correo ya escrito en el formulario de contraseña. */
  initialIdentifier?: string;
  /** La cuenta tiene 2FA activo: Login muestra el formulario de código. */
  onRequires2FA: (username: string, message: string) => void;
  onMessage: (message: string) => void;
};

async function postJson(path: string, body: unknown): Promise<any> {
  const res = await fetch(apiBase + path, {
    method: "POST",
    credentials: "include",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.message || "No pudimos iniciar sesión con tu rostro.");
    (error as any).status = res.status;
    throw error;
  }
  return data;
}

/**
 * Acceso facial 1:1 desde la pantalla de login. La cuenta se elige antes del
 * reto; el servidor compara cada fotograma con la plantilla guardada y solo
 * emite la sesión (o el reto 2FA) cuando el reto completo coincide.
 */
export function FaceLogin({ initialIdentifier = "", onRequires2FA, onMessage }: Props) {
  const { loginDirect } = useAuth();
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [step, setStep] = useState<Step | null>(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [status, setStatus] = useState("");
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (initialIdentifier) setIdentifier((current) => current || initialIdentifier);
  }, [initialIdentifier]);

  const stop = () => {
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    setCameraOpen(false);
    setStep(null);
  };

  useEffect(() => {
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      stream.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const openCamera = async () => {
    if (stream.current && video.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices) {
      throw new Error("Usa HTTPS o localhost para abrir la cámara.");
    }
    const media = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    if (cancelled.current) {
      media.getTracks().forEach((track) => track.stop());
      return;
    }
    stream.current = media;
    setCameraOpen(true);
    try {
      if (video.current) {
        video.current.srcObject = media;
        await video.current.play();
      }
    } catch (error) {
      stop();
      throw error;
    }
  };

  const captureJpeg = () => {
    if (!video.current?.videoWidth) throw new Error("Espera a que aparezca la cámara.");
    const node = video.current;
    const canvas = document.createElement("canvas");
    const ratio = Math.min(1, 640 / Math.max(node.videoWidth, node.videoHeight));
    canvas.width = Math.round(node.videoWidth * ratio);
    canvas.height = Math.round(node.videoHeight * ratio);
    canvas.getContext("2d")!.drawImage(node, 0, 0, canvas.width, canvas.height);
    const jpeg = canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    canvas.width = canvas.height = 1;
    return jpeg;
  };

  const fail = (error: unknown) => {
    const text = error instanceof Error ? error.message : "No pudimos iniciar sesión con tu rostro.";
    setStatus(
      error instanceof Error && error.name === "NotAllowedError"
        ? "Permite el acceso a la cámara desde el navegador para continuar."
        : text,
    );
  };

  const begin = async () => {
    const account = identifier.trim();
    if (!account) {
      setStatus("Escribe tu usuario o correo para asociar el rostro a tu cuenta.");
      return;
    }
    setBusy(true);
    setStatus("");
    onMessage("");
    try {
      await openCamera();
      if (cancelled.current) return;
      const challenge = await postJson("/api/identity/login/challenge", { identifier: account });
      setStep(challenge);
      setStatus(`Paso 1 de 5: ${actions[challenge.action] ?? "Sigue la indicación"}.`);
    } catch (error) {
      stop();
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  const capture = async () => {
    if (!step) return;
    setBusy(true);
    setStatus("");
    try {
      const next = await postJson("/api/identity/login/frame", {
        identifier: identifier.trim(),
        id: step.id,
        jpeg: captureJpeg(),
      });
      if (next.done) {
        stop();
        if (next.requires2FA && next.username) {
          onRequires2FA(String(next.username), String(next.message || "Ingresa el código enviado a tu correo."));
          return;
        }
        const user = next.user;
        if (!user?.username) throw new Error("La sesión no llegó completa. Intenta de nuevo.");
        loginDirect(
          user.username,
          user.role || "traveler",
          user.name,
          user.email,
          user.roleChangedAt ?? null,
          next.token ?? null,
        );
        return;
      }
      setStep(next);
      setStatus(`Paso ${next.step + 1} de 5: ${actions[next.action] ?? "Sigue la indicación"}.`);
    } catch (error) {
      stop();
      fail(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Elige tu cuenta y confirma cinco posiciones con la cámara. El rostro se compara en el servidor
        con la plantilla que guardaste; la sesión se emite solo al completar el reto.
      </p>

      <div className="space-y-2">
        <Label htmlFor="face-login-identifier" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Usuario o Correo
        </Label>
        <Input
          id="face-login-identifier"
          placeholder="usuario o correo@ejemplo.com"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          disabled={busy || !!step}
          className="bg-secondary/20 h-12 px-4 rounded-xl border-border/50 focus-visible:ring-primary focus-visible:border-primary transition-all"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-12 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-xl"
          disabled={busy || !!step}
          onClick={begin}
        >
          {busy && !step ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abriendo cámara...</>
          ) : (
            <><ScanFace className="mr-2 h-5 w-5" /> Entrar con mi rostro</>
          )}
        </Button>
        {cameraOpen && (
          <Button type="button" variant="outline" className="h-12 rounded-xl" disabled={busy} onClick={stop}>
            <Camera className="mr-2 h-4 w-4" /> Cerrar cámara
          </Button>
        )}
      </div>

      <video
        ref={video}
        muted
        autoPlay
        playsInline
        aria-label="Cámara para iniciar sesión con tu rostro"
        hidden={!cameraOpen}
        className="max-h-64 w-full rounded-xl bg-black object-contain"
      />

      {step && (
        <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-3">
          <p role="status" className="text-sm font-medium">
            Paso {step.step + 1} de 5: {actions[step.action] ?? "Sigue la indicación"}.
          </p>
          <p className="text-xs text-muted-foreground">Usa luz frontal y mantén el rostro dentro del encuadre.</p>
          <Button type="button" className="w-full h-11 rounded-xl" disabled={busy} onClick={capture}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Comprobando...</> : "Confirmar posición"}
          </Button>
        </div>
      )}

      <p role="status" aria-live="polite" className="min-h-5 text-sm break-words text-muted-foreground">
        {status}
      </p>
    </div>
  );
}
