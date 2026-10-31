// generate-audio-taxi.mjs — ElevenLabs TTS para video-taxi
// Voz: Eric (cjVigY5qzO86Huf0OWal) — español colombiano, tono cálido y confiado
import fs from "fs";
import path from "path";

const API_KEY = "sk_275b0d64d78248fc5357b5abbb2a3d3c2059229cdc6405e6";
const VOICE_ID = "cjVigY5qzO86Huf0OWal"; // Eric — Smooth, Reliable, Trustworthy
const MODEL = "eleven_multilingual_v2";
const OUT_DIR = "video-taxi/assets/audio";

const VOICE_SETTINGS = {
  stability: 0.60,
  similarity_boost: 0.82,
  style: 0.08,
  use_speaker_boost: true,
};

const CLIPS = [
  {
    id: "taxi-vo-01",
    text: "¿Cuántas horas llevas rodando vacío, buscando carreras que nunca llegan? Con ViaNovaIA, eso se acabó.",
  },
  {
    id: "taxi-vo-02",
    text: "Activas tu disponibilidad y al instante recibes solicitudes reales de turistas que ya están en tu ciudad, con tarifa fija y sin intermediarios.",
  },
  {
    id: "taxi-vo-03",
    text: "La ruta está lista, el destino confirmado. Sin vueltas innecesarias, sin confusión — tú mandas.",
  },
  {
    id: "taxi-vo-04",
    text: "Cada carrera suma directo a tu bolsillo. Sin esperas de semanas ni descuentos arbitrarios. Tú decides cuándo retirar.",
  },
  {
    id: "taxi-vo-05",
    text: "Tu buena actitud construye tu reputación digital. Los turistas te buscan a ti — no a la plataforma.",
  },
  {
    id: "taxi-vo-06",
    text: "Únete al gremio de conductores de ViaNovaIA. Regístrate gratis en via-nova-ia.vercel.app y empieza a ganar desde hoy.",
  },
];

const MASTER_TEXT = CLIPS.map((c) => c.text).join(" ");

async function generateClip(id, text) {
  console.log(`\n🎙️  Generando: ${id}`);
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        voice_settings: VOICE_SETTINGS,
      }),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs error [${res.status}]: ${err}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const outPath = path.join(OUT_DIR, `${id}.mp3`);
  fs.writeFileSync(outPath, buf);
  console.log(`   ✓ Guardado: ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  return outPath;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const clip of CLIPS) {
    await generateClip(clip.id, clip.text);
    await sleep(650); // rate-limit safety
  }

  console.log("\n🎙️  Generando: master voiceover");
  await generateClip("voiceover", MASTER_TEXT);

  console.log("\n✅ Todos los clips de audio generados en:", OUT_DIR);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});

