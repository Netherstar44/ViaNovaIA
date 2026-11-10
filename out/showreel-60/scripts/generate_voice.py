"""Genera la locución española del showreel con Kokoro.

Uso (Windows, venv aislado con torch >= 2.6):
  %TEMP%\\vianova-kokoro-venv\\Scripts\\python.exe out/showreel-60/scripts/generate_voice.py

Salida: out/showreel-60/audio/vo-01..08.wav (24 kHz, mono, 16-bit)
        out/showreel-60/audio/vo-durations.json
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import espeakng_loader
import numpy as np
import soundfile as sf

os.environ["PHONEMIZER_ESPEAK_LIBRARY"] = str(espeakng_loader.get_library_path())
os.environ["ESPEAK_DATA_PATH"] = str(espeakng_loader.get_data_path())

from kokoro import KPipeline  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / "audio"
AUDIO.mkdir(parents=True, exist_ok=True)

VOICE = "em_alex"
FALLBACK = "em_santa"
SR = 24_000

# Una línea por capítulo. La 7 y la 8 comparten el cierre.
# `tts` corrige la grafía de marca: espeak lee «VIANova» como «uve-i-a-nova»;
# «ViaNova» produce la pronunciación correcta «via-nova» sin cambiar lo que se ve.
LINES = [
    ("vo-01", "Colombia, en un solo lugar.", "Colombia, en un solo lugar."),
    ("vo-02", "La IA lo planifica.", "La IA lo planifica."),
    ("vo-03", "Míralo antes de ir.", "Míralo antes de ir."),
    ("vo-04", "Reserva y paga en un paso.", "Reserva y paga en un paso."),
    ("vo-05", "Muévete con locales.", "Muévete con locales."),
    ("vo-06", "Todo, bajo control.", "Todo, bajo control."),
    ("vo-07", "Tu viaje, sin fricción.", "Tu viaje, sin fricción."),
    ("vo-08", "Planifica tu viaje con VIANova.", "Planifica tu viaje con ViaNova."),
]


def trim_silence(samples: np.ndarray, threshold: float = 0.006, pad_ms: int = 35) -> np.ndarray:
    """Recorta silencio inicial/final sin comerse las consonantes."""
    if samples.size == 0:
        return samples
    frame = int(SR * 0.01)
    usable = (samples.size // frame) * frame
    if usable == 0:
        return samples
    frames = np.abs(samples[:usable]).reshape(-1, frame).max(axis=1)
    voiced = np.where(frames > threshold)[0]
    if voiced.size == 0:
        return samples
    pad = int(SR * pad_ms / 1000)
    start = max(0, voiced[0] * frame - pad)
    end = min(samples.size, (voiced[-1] + 1) * frame + pad)
    return samples[start:end]


def synth(pipeline: KPipeline, text: str, voice: str, speed: float = 0.97) -> np.ndarray:
    chunks: list[np.ndarray] = []
    for _, _, audio in pipeline(text, voice=voice, speed=speed):
        if audio is None:
            continue
        array = audio.detach().cpu().numpy() if hasattr(audio, "detach") else np.asarray(audio)
        chunks.append(array.astype(np.float32))
    if not chunks:
        raise RuntimeError(f"Kokoro no devolvió audio para: {text!r}")
    return normalize_peak(trim_silence(np.concatenate(chunks)))


def normalize_peak(samples: np.ndarray, peak: float = 0.70) -> np.ndarray:
    """Deja la voz a -3 dBFS de pico, sin comprimir ni colorear."""
    current = float(np.max(np.abs(samples))) if samples.size else 0.0
    if current == 0.0:
        return samples
    return (samples * (peak / current)).astype(np.float32)


def main() -> None:
    pipeline = KPipeline(lang_code="e")

    # Audición A/B de una sola frase para elegir timbre.
    audition_text = "Colombia, en un solo lugar."
    for voice in (VOICE, FALLBACK):
        audition = synth(pipeline, audition_text, voice)
        sf.write(AUDIO / f"_audition_{voice}.wav", audition, SR)
        print(f"audition {voice}: {audition.size / SR:.2f}s")

    durations: dict[str, float] = {}
    for line_id, text, tts_text in LINES:
        audio = synth(pipeline, tts_text, VOICE)
        path = AUDIO / f"{line_id}.wav"
        sf.write(path, audio, SR, subtype="PCM_16")
        durations[line_id] = round(audio.size / SR, 3)
        print(f"{line_id}: {durations[line_id]:.2f}s  {text}")

    total = sum(durations.values())
    (AUDIO / "vo-durations.json").write_text(
        json.dumps({"voice": VOICE, "sampleRate": SR, "lines": durations, "total": round(total, 3)}, indent=2),
        encoding="utf-8",
    )
    print(f"total voz: {total:.2f}s")


if __name__ == "__main__":
    main()
