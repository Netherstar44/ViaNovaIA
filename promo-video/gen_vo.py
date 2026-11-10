import asyncio, os, subprocess, json
import edge_tts

VOICE = "es-CO-GonzaloNeural"
RATE = "-18%"
PITCH = "-2Hz"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "assets", "vo")
os.makedirs(OUT, exist_ok=True)

LINES = [
    ("l01", "Colombia no cabe en una lista de diez lugares."),
    ("l02", "Cabe en un plan que conoce el Huila."),
    ("l03", "Esto es VIANova IA."),
    ("l04", "Tu viaje, diseñado con inteligencia artificial."),
    ("l05", "Cuéntale tus fechas, tu presupuesto, tu ritmo."),
    ("l06", "La IA arma el itinerario con lugares y proveedores reales."),
    ("l07", "Hoteles, restaurantes, experiencias y taxi local."),
    ("l08", "Todo en un solo plan, con reseñas y presupuesto estimado."),
    ("l09", "Dos días. Cuatro. Siete. Tú decides."),
    ("l10", "Y si algo no encaja, lo cambias en el chat."),
    ("l11", "Tatacoa al atardecer. Rivera al amanecer."),
    ("l12", "Una ruta que se siente tuya."),
    ("l13", "La IA arma el plan. Los locales lo hacen real."),
    ("l14", "VIANova IA. Colombia, planificada con inteligencia."),
    ("l14b", "VIANova IA. Crea tu plan gratis."),
]


async def synth(key, text):
    mp3 = os.path.join(OUT, key + ".mp3")
    wav = os.path.join(OUT, key + ".wav")
    if not (os.path.exists(wav) and os.path.getsize(wav) > 10000):
        if not (os.path.exists(mp3) and os.path.getsize(mp3) > 5000):
            await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(mp3)
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", mp3,
            "-af", "silenceremove=start_periods=1:start_duration=0.02:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_duration=0.04:start_threshold=-50dB,areverse",
            "-ar", "48000", "-ac", "1", wav,
        ]
        subprocess.run(cmd, check=True)
    dur = float(subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", wav
    ]).decode().strip())
    return dur


async def main():
    rows = []
    for key, text in LINES:
        dur = await synth(key, text)
        rows.append({"key": key, "text": text, "duration": round(dur, 3), "words": len(text.split())})
        print(f"{key} {dur:6.3f}s {len(text.split()):2d}w  {text}", flush=True)
    with open(os.path.join(OUT, "durations.json"), "w", encoding="utf8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)
    total = sum(r["duration"] for r in rows if not r["key"].endswith("b"))
    print(f"TOTAL SPEECH {total:.2f}s / 60s")


asyncio.run(main())
