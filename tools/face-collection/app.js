const $ = (id) => document.getElementById(id);
let token = "";
let meta = null;
let participant = null;
let session = null;
let stream = null;

function setStatus(id, text, error = false) {
  const element = $(id);
  element.textContent = text;
  element.style.color = error ? "var(--danger)" : "";
}

function headers() {
  return { "content-type": "application/json", "x-collection-token": token };
}

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Error HTTP ${response.status}`);
  return body;
}

async function loadMeta() {
  meta = await (await fetch("/api/meta")).json();
  $("consent-text").textContent = meta.consentText;
  $("condition").replaceChildren(...meta.conditions.map((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    return option;
  }));
  if (!meta.captureEnabled) {
    setStatus("capture-status", "Captura deshabilitada. El operador debe reiniciar con --authorize-capture.", true);
  }
}

async function loadState() {
  if (!token) throw new Error("Pega el token de la terminal.");
  const state = await api("/api/state");
  $("state").textContent = JSON.stringify(state, null, 2);
  setStatus("connection", "Conectado. Token válido.");
}

$("load").addEventListener("click", async () => {
  token = $("token").value.trim();
  try { await loadState(); } catch (error) { setStatus("connection", error.message, true); }
});

$("refresh").addEventListener("click", async () => {
  try { await loadState(); } catch (error) { setStatus("connection", error.message, true); }
});

$("register").addEventListener("click", async () => {
  try {
    token = $("token").value.trim() || token;
    if (!meta) await loadMeta();
    const created = await api("/api/participant", {
      method: "POST",
      body: JSON.stringify({
        id: $("participant").value.trim(),
        split: $("split").value,
        accepted: $("accepted").checked,
        version: meta.consentVersion,
      }),
    });
    participant = created;
    setStatus("participant-status", `Consentimiento registrado para ${created.id} en ${created.split}.`);
    await loadState();
  } catch (error) { setStatus("participant-status", error.message, true); }
});

$("new-session").addEventListener("click", async () => {
  try {
    if (!participant) throw new Error("Registra primero el consentimiento del participante.");
    session = await api("/api/session", {
      method: "POST",
      body: JSON.stringify({ participantId: participant.id, condition: $("condition").value }),
    });
    setStatus("session-status", `Sesión ${session.id} (${session.condition}).`);
    $("instruction").textContent = "Enciende la cámara y captura centro, izquierda y derecha.";
    if (stream) document.querySelectorAll("[data-pose]").forEach((button) => { button.disabled = false; });
    await loadState();
  } catch (error) { setStatus("session-status", error.message, true); }
});

$("camera").addEventListener("click", async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    $("video").srcObject = stream;
    await $("video").play();
    setStatus("capture-status", "Cámara encendida. Mantén un solo rostro visible.");
    document.querySelectorAll("[data-pose]").forEach((button) => { button.disabled = !session; });
  } catch (error) { setStatus("capture-status", `No se pudo abrir la cámara: ${error.message}`, true); }
});

$("stop").addEventListener("click", () => {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  $("video").srcObject = null;
  document.querySelectorAll("[data-pose]").forEach((button) => { button.disabled = true; });
  setStatus("capture-status", "Cámara apagada.");
});

document.querySelectorAll("[data-pose]").forEach((button) => {
  button.addEventListener("click", async () => {
    try {
      if (!stream || !session || !participant) throw new Error("Enciende la cámara y crea una sesión primero.");
      const video = $("video");
      const canvas = $("canvas");
      canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL("image/jpeg", 0.78);
      if (image.length > 400_000) throw new Error("La captura es demasiado grande; acerca la cámara o reduce la resolución.");
      const frame = await api("/api/frame", {
        method: "POST",
        body: JSON.stringify({ participantId: participant.id, sessionId: session.id, pose: button.dataset.pose, image }),
      });
      setStatus("capture-status", `Guardado ${frame.pose} (${frame.width}×${frame.height}, ${frame.bytes} bytes).`);
      await loadState();
    } catch (error) { setStatus("capture-status", error.message, true); }
  });
});

loadMeta().catch((error) => setStatus("capture-status", error.message, true));
