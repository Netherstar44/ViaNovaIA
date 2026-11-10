"""
Cama de sonido y efectos para el showreel de 60 s.
Síntesis determinista con numpy/scipy; sin samples externos.
Salida: motion/public/audio/sfx-bed.wav (48 kHz, estéreo, 16 bit).
"""

from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48_000
DURATION = 60.0
N = int(SR * DURATION)
rng = np.random.default_rng(20261106)

bed = np.zeros((N, 2), dtype=np.float64)


def place(signal_mono: np.ndarray, at: float, gain: float = 1.0, pan: float = 0.0) -> None:
    start = int(at * SR)
    end = min(N, start + len(signal_mono))
    if start >= N:
        return
    chunk = signal_mono[: end - start] * gain
    left = np.cos((pan + 1) * np.pi / 4)
    right = np.sin((pan + 1) * np.pi / 4)
    bed[start:end, 0] += chunk * left
    bed[start:end, 1] += chunk * right


def fade(signal_mono: np.ndarray, attack: float, release: float) -> np.ndarray:
    n = len(signal_mono)
    a = min(n, int(attack * SR))
    r = min(n, int(release * SR))
    env = np.ones(n)
    if a:
        env[:a] = np.linspace(0, 1, a) ** 1.5
    if r:
        env[-r:] *= np.linspace(1, 0, r) ** 1.5
    return signal_mono * env


def whoosh(length: float = 0.85, low: float = 380, high: float = 2600, pan_from: float = 0.6, pan_to: float = -0.5) -> np.ndarray:
    n = int(length * SR)
    noise = rng.normal(0, 1, n)
    sos = signal.butter(2, [low, high], btype="band", fs=SR, output="sos")
    filtered = signal.sosfilt(sos, noise)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    tone = np.sin(2 * np.pi * np.linspace(170, 90, n) * np.arange(n) / SR) * 0.22
    return (filtered * env + tone * env) * 0.9


def pop(freq: float = 420, length: float = 0.13) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 42)
    body = np.sin(2 * np.pi * freq * t) * 0.65
    click = rng.normal(0, 1, n) * np.exp(-t * 240) * 0.25
    return (body + click) * env


def tick(freq: float = 2400, length: float = 0.06) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 90)
    return (np.sin(2 * np.pi * freq * t) * 0.5 + rng.normal(0, 1, n) * 0.15) * env


def ding(freq: float = 880, length: float = 1.1) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 4.2)
    return (np.sin(2 * np.pi * freq * t) + 0.45 * np.sin(2 * np.pi * freq * 1.5 * t) + 0.2 * np.sin(2 * np.pi * freq * 2.02 * t)) * env * 0.5


def success() -> np.ndarray:
    first = ding(660, 0.42)
    second = ding(990, 0.78)
    out = np.zeros(int(1.2 * SR))
    out[: len(first)] += first
    offset = int(0.24 * SR)
    out[offset : offset + len(second)] += second * 0.9
    return out


def impact() -> np.ndarray:
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 2.6)
    sub = np.sin(2 * np.pi * 46 * t) * env
    noise = signal.sosfilt(signal.butter(2, 220, btype="low", fs=SR, output="sos"), rng.normal(0, 1, n)) * env * 0.35
    return (sub + noise) * 0.7


def shimmer(length: float = 2.4) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    tones = (
        np.sin(2 * np.pi * 1760 * t)
        + 0.6 * np.sin(2 * np.pi * 2637 * t)
        + 0.4 * np.sin(2 * np.pi * 3520 * t)
    )
    return tones * env * 0.09


def motor(length: float = 8.0) -> np.ndarray:
    n = int(length * SR)
    t = np.arange(n) / SR
    noise = rng.normal(0, 1, n)
    sos = signal.butter(2, [55, 170], btype="band", fs=SR, output="sos")
    rumble = signal.sosfilt(sos, noise)
    hum = np.sin(2 * np.pi * 72 * t) * 0.35 + np.sin(2 * np.pi * 144 * t) * 0.12
    lfo = 0.6 + 0.4 * np.sin(2 * np.pi * 0.22 * t)
    env = fade(np.ones(n), 0.8, 1.2)
    return (rumble * 0.8 + hum) * lfo * env * 0.11


def click() -> np.ndarray:
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 120)
    return (rng.normal(0, 1, n) * 0.5 + np.sin(2 * np.pi * 1500 * t) * 0.3) * env


# ---------------------------------------------------------------- ambiente
# Pad armónico muy tenue, 4 s por acorde.
chords = [
    [174.61, 220.00, 261.63, 329.63],  # Fmaj7
    [130.81, 164.81, 196.00, 246.94],  # Cmaj7
    [196.00, 246.94, 293.66, 392.00],  # G
    [220.00, 261.63, 329.63, 392.00],  # Am7
]
chord_len = 4.0
for index in range(int(DURATION / chord_len)):
    chord = chords[index % len(chords)]
    start = index * chord_len
    n = int(chord_len * SR)
    t = np.arange(n) / SR
    pad = np.zeros(n)
    for freq in chord:
        pad += np.sin(2 * np.pi * freq * t + rng.uniform(0, 0.4))
        pad += 0.35 * np.sin(2 * np.pi * freq * 1.003 * t)
    pad *= 0.010
    pad = fade(pad, 0.9, 1.3)
    place(pad, start, 1.0, pan=0.0)

# Aire filtrado, casi inaudible, para que el silencio no sea digital.
air = signal.sosfilt(signal.butter(2, [900, 5200], btype="band", fs=SR, output="sos"), rng.normal(0, 1, N))
air *= 0.0035
bed[:, 0] += air
bed[:, 1] += np.roll(air, 311) * 0.9

# Pulso suave cada compás (2 s), desde 0.4 s.
for at in np.arange(0.4, 58.0, 2.0):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    env = np.exp(-t * 7.0)
    pulse = np.sin(2 * np.pi * 58 * t) * env * 0.055
    place(pulse, at, 1.0, pan=0.0)

# ---------------------------------------------------------------- cues
place(whoosh(0.9, 300, 1800, 0.2, 0.0), 0.18, 0.10)
place(impact() * 0.35, 0.4, 0.30)
place(tick(3200), 1.6, 0.12, pan=0.2)

# Cap. 2 — marketplace
place(whoosh(0.75, 500, 3000, 0.7, -0.4), 4.0, 0.16)
for at, freq in [(6.0, 440), (6.5, 520), (7.0, 610)]:
    place(pop(freq), at, 0.13, pan=(at - 6.5) * 0.3)
place(click(), 9.0, 0.16, pan=0.25)
place(whoosh(0.9, 300, 2400, -0.2, -0.7), 11.3, 0.10)

# Cap. 3 — IA
place(whoosh(0.7, 600, 3400, -0.6, 0.3), 12.0, 0.12)
for at in [13.0, 13.25, 13.5, 13.75, 14.0]:
    place(tick(2800 + rng.uniform(-200, 200), 0.045), at, 0.055, pan=0.25)
place(tick(3600, 0.08), 14.7, 0.11, pan=0.3)  # enviar
place(ding(1046, 0.8), 15.1, 0.10, pan=-0.1)
for at in [15.7, 16.2, 16.7]:
    place(pop(500), at, 0.10, pan=-0.2)
place(whoosh(1.1, 240, 1600, 0.4, -0.6), 19.1, 0.10)

# Cap. 4 — descubrimiento
place(whoosh(1.0, 260, 2400, 0.5, -0.3), 20.0, 0.13)
for at in [21.4, 22.4]:
    place(pop(330, 0.18), at, 0.075, pan=0.4)  # latido del badge
place(click(), 25.0, 0.15, pan=0.1)
place(whoosh(1.0, 280, 2000, -0.2, 0.5), 27.0, 0.12)

# Cap. 5 — ruta y pago
place(whoosh(0.8, 400, 2600, -0.6, 0.2), 28.0, 0.11)
place(whoosh(0.55, 500, 3000, 0.2, 0.6), 30.0, 0.12)
place(click(), 32.35, 0.18, pan=0.35)
place(success(), 33.0, 0.14, pan=0.2)
place(shimmer(1.0) * 0.6, 34.2, 0.08)
place(whoosh(0.7, 300, 1800, 0.6, -0.2), 35.2, 0.09)

# Cap. 6 — taxi
place(motor(8.0), 36.0, 0.70, pan=-0.1)
place(click(), 36.9, 0.15, pan=0.55)
place(whoosh(0.6, 700, 3200, -0.4, 0.3), 37.4, 0.08)
place(ding(1318, 1.0), 41.0, 0.12, pan=0.2)
place(whoosh(0.7, 300, 2400, 0.2, 0.7), 43.0, 0.07)

# Cap. 7 — panel
for at in [44.1, 44.35, 44.6, 44.85]:
    place(tick(2200, 0.05), at, 0.07, pan=(at - 44.5) * 0.4)
place(whoosh(1.2, 600, 4200, -0.5, 0.4), 46.0, 0.09)
place(ding(1568, 1.3), 47.2, 0.07, pan=-0.2)
place(impact() * 0.3, 49.2, 0.22)

# Cap. 8 — cierre
place(impact() * 0.45, 50.0, 0.28)
place(shimmer(2.2) * 0.8, 52.0, 0.10)
place(shimmer(2.6), 54.6, 0.11)
place(ding(880, 1.6) * 0.4, 56.0, 0.05)

# ---------------------------------------------------------------- master
# Filtro suave de graves y un leve high-shelf negativo para que no fatigue.
sos_low = signal.butter(2, 38, btype="high", fs=SR, output="sos")
bed = signal.sosfilt(sos_low, bed, axis=0)

# Fade de entrada y salida de la cama.
fade_in = int(0.05 * SR)
fade_out = int(2.0 * SR)
bed[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
bed[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 1.2

peak = np.max(np.abs(bed))
bed = bed / peak * 0.50  # deja cabeza para la voz
stereo = np.clip(bed, -1, 1)
pcm = (stereo * 32767).astype(np.int16)

out_path = Path(__file__).resolve().parents[3] / "motion" / "public" / "audio" / "sfx-bed.wav"
out_path.parent.mkdir(parents=True, exist_ok=True)
wavfile.write(out_path, SR, pcm)
print(f"written {out_path} ({len(pcm) / SR:.2f} s, peak {np.max(np.abs(stereo)):.2f})")
