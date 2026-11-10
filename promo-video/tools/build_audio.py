"""Build the 60 s score, SFX, VO track and final mix for the VIANova film."""
import os, json, subprocess, math
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio")
os.makedirs(OUT, exist_ok=True)
SR = 48000
DUR = 60.0
N = int(SR * DUR)
rng = np.random.default_rng(20261027)

# ---------------------------------------------------------------- utilities
def t_axis(n):
    return np.arange(n, dtype=np.float32) / SR

def env_ar(n, a, r, curve=2.0):
    e = np.ones(n, dtype=np.float32)
    na = min(n, max(1, int(a * SR)))
    nr = min(n, max(1, int(r * SR)))
    e[:na] = np.linspace(0, 1, na, dtype=np.float32) ** (1 / max(curve, 1e-3))
    e[-nr:] *= np.linspace(1, 0, nr, dtype=np.float32) ** curve
    return e

def lowpass(x, fc, order=2):
    fc = min(fc, SR * 0.45)
    sos = butter(order, fc / (SR / 2), btype="low", output="sos")
    return sosfilt(sos, x).astype(np.float32)

def highpass(x, fc, order=2):
    sos = butter(order, fc / (SR / 2), btype="high", output="sos")
    return sosfilt(sos, x).astype(np.float32)

def bandpass(x, lo, hi, order=2):
    sos = butter(order, [lo / (SR / 2), min(hi, SR * 0.45) / (SR / 2)], btype="band", output="sos")
    return sosfilt(sos, x).astype(np.float32)

def add(buf, sig, t, gain=1.0, pan=0.0):
    if t >= DUR or t < -0.1:
        return
    i = int(round(t * SR))
    if i < 0:
        sig = sig[-i:]
        i = 0
    n = min(len(sig), N - i)
    if n <= 0:
        return
    gl = gain * math.sqrt((1 - pan) / 2) * math.sqrt(2)
    gr = gain * math.sqrt((1 + pan) / 2) * math.sqrt(2)
    buf[0, i:i + n] += sig[:n] * gl
    buf[1, i:i + n] += sig[:n] * gr

def soft_clip(x, drive=1.0):
    return np.tanh(x * drive) / np.tanh(drive)

# ---------------------------------------------------------------- instruments
def piano(freq, dur=2.6, vel=0.5, bright=1.0):
    n = int(dur * SR)
    t = t_axis(n)
    f = float(freq)
    # slight detune double string
    sig = np.zeros(n, dtype=np.float32)
    for det, amp in ((0.9993, 0.55), (1.0007, 0.45)):
        ph = 2 * np.pi * f * det * t
        for k, hk in enumerate((1.0, 0.46, 0.22, 0.12, 0.07, 0.035), start=1):
            dec = 1.35 * (1 + 0.45 * (k - 1)) * (1 + 0.35 * (f / 440 - 1))
            sig += (hk * bright ** (k - 1) * amp) * np.sin(ph * k) * np.exp(-t * dec)
    # felt thump
    th = rng.normal(0, 1, n).astype(np.float32)
    th = lowpass(th, 900)
    sig += th * np.exp(-t * 55) * 0.045
    # body resonance
    sig += 0.10 * np.sin(2 * np.pi * f * 0.5 * t) * np.exp(-t * 1.7)
    return sig * vel * 0.20

def strings(freq, dur=3.0, vel=0.4):
    n = int(dur * SR)
    t = t_axis(n)
    f = float(freq)
    e = env_ar(n, 0.55, 0.75, 1.6)
    sig = np.zeros(n, dtype=np.float32)
    for det in (0.9975, 1.0, 1.0025):
        vib = 1 + 0.0016 * np.sin(2 * np.pi * 4.4 * t + det * 3)
        ph = 2 * np.pi * f * det * t * vib
        for k in range(1, 9):
            sig += (1.0 / k) * np.sin(ph * k + k * 0.7) * np.exp(-t * 0.16 * k)
    sig = lowpass(sig, 2600)
    return sig * e * vel * 0.055

def pad(freq, dur=4.0, vel=0.3):
    n = int(dur * SR)
    t = t_axis(n)
    f = float(freq)
    e = env_ar(n, 0.9, 1.5, 1.4)
    sig = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 2 * t) + 0.16 * np.sin(2 * np.pi * f * 3 * t + 1)
    sig += 0.20 * np.sin(2 * np.pi * f * 1.001 * t)
    return lowpass(sig.astype(np.float32), 1800) * e * vel * 0.035

def bass(freq, dur=1.5, vel=0.6):
    n = int(dur * SR)
    t = t_axis(n)
    f = float(freq)
    sig = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * f * 2 * t) + 0.08 * np.sin(2 * np.pi * f * 3 * t)
    e = np.exp(-t * 1.7)
    e[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return (sig * e * vel * 0.22).astype(np.float32)

def kick(vel=0.5):
    n = int(0.5 * SR)
    t = t_axis(n)
    f = 52 * np.exp(-t * 7) + 38
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 7.5) * vel * 0.55).astype(np.float32)

def heartbeat(vel=0.35):
    n = int(0.42 * SR)
    t = t_axis(n)
    f = 46 + 30 * np.exp(-t * 22)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 11) * vel * 0.45).astype(np.float32)

def shaker(vel=0.2):
    n = int(0.09 * SR)
    t = t_axis(n)
    x = rng.normal(0, 1, n).astype(np.float32)
    x = bandpass(x, 4200, 11000)
    return (x * np.exp(-t * 55) * vel * 0.11).astype(np.float32)

def tick(vel=0.3, f=1500):
    n = int(0.05 * SR)
    t = t_axis(n)
    x = np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * f * 2.2 * t)
    return (x * np.exp(-t * 110) * vel * 0.16).astype(np.float32)

def whoosh(dur=0.7, vel=0.5, f0=300, f1=3000):
    n = int(dur * SR)
    t = t_axis(n)
    x = rng.normal(0, 1, n).astype(np.float32)
    # sweep a bandpass by crossfading a few static bands
    bands = []
    for k in range(5):
        f = f0 * (f1 / f0) ** (k / 4)
        bands.append(bandpass(x, f * 0.55, f * 1.5))
    idx = np.clip((t / dur) * 4, 0, 3.999)
    i0 = np.floor(idx).astype(int)
    frac = (idx - i0).astype(np.float32)
    y = np.zeros(n, dtype=np.float32)
    for k in range(4):
        m = i0 == k
        y[m] = bands[k][m] * (1 - frac[m]) + bands[k + 1][m] * frac[m]
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.8
    return (y * env * vel * 0.20).astype(np.float32)

def impact(vel=0.8):
    n = int(1.6 * SR)
    t = t_axis(n)
    f = 70 * np.exp(-t * 2.2) + 34
    ph = 2 * np.pi * np.cumsum(f) / SR
    low = np.sin(ph) * np.exp(-t * 2.4)
    noise = lowpass(rng.normal(0, 1, n).astype(np.float32), 1400) * np.exp(-t * 9) * 0.35
    return ((low + noise) * vel * 0.55).astype(np.float32)

def riser(dur=1.8, vel=0.45):
    n = int(dur * SR)
    t = t_axis(n)
    x = rng.normal(0, 1, n).astype(np.float32)
    # filter opening
    y = np.zeros(n, dtype=np.float32)
    chunks = 8
    for k in range(chunks):
        a = int(n * k / chunks); b = int(n * (k + 1) / chunks)
        fc = 500 * (9000 / 500) ** (k / (chunks - 1))
        y[a:b] = bandpass(x, fc * 0.5, fc * 1.7)[a:b]
    env = (t / dur) ** 2.2
    return (y * env * vel * 0.16).astype(np.float32)

def paper(vel=0.4):
    n = int(0.28 * SR)
    t = t_axis(n)
    x = rng.normal(0, 1, n).astype(np.float32)
    x = highpass(x, 1800)
    x = lowpass(x, 9000)
    env = np.exp(-t * 28) * (1 + 0.4 * np.sin(2 * np.pi * 55 * t))
    return (x * env * vel * 0.10).astype(np.float32)

def bell(freq=880, dur=3.0, vel=0.4):
    n = int(dur * SR)
    t = t_axis(n)
    sig = np.zeros(n, dtype=np.float32)
    for k, a in ((1, 1.0), (2.01, 0.35), (3.02, 0.16), (4.9, 0.08)):
        sig += a * np.sin(2 * np.pi * freq * k * t) * np.exp(-t * (1.1 + 0.5 * k))
    return sig * vel * 0.10

# ---------------------------------------------------------------- score
music = np.zeros((2, N), dtype=np.float32)

CH = {
    "Am": dict(v=[220.00, 261.63, 329.63], r=55.00),
    "F": dict(v=[174.61, 220.00, 261.63], r=43.65),
    "C": dict(v=[261.63, 329.63, 392.00], r=65.41),
    "G": dict(v=[196.00, 246.94, 293.66], r=49.00),
    "Cend": dict(v=[261.63, 329.63, 392.00, 523.25], r=65.41),
}
BARS = [
    (0.000, "Am"), (2.667, "Am"), (5.333, "F"),
    (8.000, "F"), (10.667, "C"),
    (13.333, "C"), (16.000, "G"), (18.667, "Am"),
    (21.333, "Am"), (24.000, "F"), (26.667, "C"), (29.333, "G"),
    (32.000, "Am"), (34.667, "F"), (37.333, "C"), (40.000, "G"),
    (42.667, "F"), (45.333, "C"), (48.000, "G"),
    (50.667, "Am"), (53.333, "Cend"), (56.000, "Cend"), (58.667, "Cend"),
]

# pad + strings bed
for i, (t0, name) in enumerate(BARS):
    t1 = BARS[i + 1][0] if i + 1 < len(BARS) else DUR
    seg = t1 - t0
    c = CH[name]
    for j, f in enumerate(c["v"]):
        pan = (-0.5, 0.5, -0.15, 0.35)[j % 4]
        add(music, pad(f, seg + 1.4, vel=0.34), t0, 1.0, pan)
    if 30.667 <= t0 < 49.3:
        for j, f in enumerate(c["v"]):
            add(music, strings(f, seg + 1.1, vel=0.42), t0, 1.0, (-0.6, 0.6, 0)[j % 3])
    if 40.0 <= t0 < 49.3:
        # melody line in the strings, one long note per bar
        mel = {40.0: 392.0, 42.667: 349.23, 45.333: 329.63, 48.0: 293.66}[t0]
        add(music, strings(mel, seg + 1.2, vel=0.55), t0, 1.0, 0.15)

# low drone / bass roots
for t0, name in BARS:
    if t0 < 7.33:
        add(music, bass(CH[name]["r"] * 2, 2.9, vel=0.28), t0, 0.8, 0)
    elif 21.333 <= t0 < 49.3:
        add(music, bass(CH[name]["r"] * 2, 1.35, vel=0.48), t0, 1.0, 0)
        add(music, bass(CH[name]["r"], 1.7, vel=0.32), t0, 1.0, 0)
    elif t0 >= 49.3:
        add(music, bass(CH[name]["r"] * 2, 2.6, vel=0.30), t0, 1.0, 0)

# heartbeat intro
for ht in (0.0, 0.30, 2.667, 2.967, 5.333, 5.633):
    add(music, heartbeat(0.30), ht, 1.0, 0.0)

# intro piano
for t0, note, vel in [
    (0.05, 220.00, 0.50), (1.35, 329.63, 0.28), (2.72, 261.63, 0.40),
    (4.10, 220.00, 0.30), (5.40, 349.23, 0.34), (6.38, 440.00, 0.24),
]:
    add(music, piano(note, 3.8, vel=vel), t0, 1.0, -0.10)

# brand chord (7.333) and reveal
for f, v in ((174.61, 0.42), (261.63, 0.30), (349.23, 0.22)):
    add(music, piano(f, 4.4, vel=v), 7.36, 1.0, 0.0)

# paper arpeggios 12.667-21.333
arp_bars = [(t0, n) for t0, n in BARS if 12.667 <= t0 < 21.333]
for t0, name in arp_bars:
    v = CH[name]["v"]
    seq = [v[0], v[2], v[1] * 2, v[2], v[0] * 2, v[1], v[2], v[1]]
    for k, f in enumerate(seq):
        tt = t0 + k * 0.3333 + (rng.normal(0, 0.008) if k else 0)
        add(music, piano(f, 1.9, vel=0.24 + 0.05 * (k % 3 == 0)), tt, 0.9, -0.15)

# groove 21.333-49.333
step = 1.3333
tt = 21.3333
k = 0
while tt < 49.333:
    add(music, kick(0.34 if k % 2 == 0 else 0.24), tt, 1.0, 0)
    tt += step
    k += 1
# shaker 16ths
tt = 17.0
k = 0
while tt < 49.333:
    if tt >= 21.333:
        add(music, shaker(0.10 if k % 4 == 2 else 0.055), tt, 1.0, 0.25)
    tt += 0.16667
    k += 1
# provider stabs
for t0, name in BARS:
    if 21.333 <= t0 < 30.667:
        v = CH[name]["v"]
        for f in (v[0], v[1], v[2]):
            add(music, piano(f, 1.4, vel=0.22), t0 + 0.02, 0.9, 0.0)

# build 30.667-40 arpeggio 8ths, wider
for t0, name in [(t0, n) for t0, n in BARS if 30.667 <= t0 < 40.0]:
    v = CH[name]["v"]
    seq = [v[0], v[2], v[1] * 2, v[2], v[0] * 2, v[2], v[1] * 2, v[2]]
    for k, f in enumerate(seq):
        add(music, piano(f, 2.2, vel=0.22 + 0.06 * (k == 0)), t0 + k * 0.3333, 0.95, (-1) ** k * 0.2)

# places theme 40-49.333
THEME = {
    40.000: [(392.00, 0.0, 0.36), (493.88, 0.667, 0.28), (392.00, 1.333, 0.24), (440.00, 2.0, 0.22)],
    42.667: [(349.23, 0.0, 0.36), (440.00, 0.667, 0.28), (349.23, 1.333, 0.24), (392.00, 2.0, 0.22)],
    45.333: [(329.63, 0.0, 0.38), (392.00, 0.667, 0.28), (523.25, 1.333, 0.30), (440.00, 2.0, 0.22)],
    48.000: [(392.00, 0.0, 0.34), (493.88, 0.667, 0.26), (392.00, 1.333, 0.24), (329.63, 2.0, 0.24)],
}
for t0, notes in THEME.items():
    for f, dt, vel in notes:
        add(music, piano(f, 2.8, vel=vel), t0 + dt, 1.0, 0.05)
    v = CH[[n for (b, n) in BARS if b == t0][0]]["v"]
    add(music, piano(v[0] / 2, 2.6, vel=0.18), t0, 1.0, -0.2)

# claim 49.333-53.35: sparse, intimate
for t0, f, vel in [(49.4, 440.00, 0.26), (50.7, 329.63, 0.22), (52.0, 392.00, 0.20)]:
    add(music, piano(f, 3.2, vel=vel), t0, 1.0, 0.0)
# final resolve lands with the end card at 53.35
for f, v in ((261.63, 0.34), (329.63, 0.26), (392.00, 0.24), (523.25, 0.20)):
    add(music, piano(f, 5.4, vel=v), 53.40, 1.0, 0.0)
add(music, piano(1046.50, 4.4, vel=0.12), 53.52, 1.0, -0.2)

# global fades
fade = np.ones(N, dtype=np.float32)
fade[: int(0.8 * SR)] *= np.linspace(0, 1, int(0.8 * SR))
fade[-int(2.6 * SR):] *= np.linspace(1, 0, int(2.6 * SR)) ** 1.4
music *= fade[None, :]

# light reverb on music
ir_n = int(0.85 * SR)
ir_t = t_axis(ir_n)
ir = rng.normal(0, 1, ir_n).astype(np.float32) * np.exp(-ir_t * 5.2)
ir = lowpass(ir, 4200)
ir[: int(0.012 * SR)] = 0
ir /= np.sqrt(np.sum(ir ** 2)) + 1e-9
wet = np.stack([fftconvolve(music[c], ir)[:N] for c in range(2)]).astype(np.float32)
music = music * 0.88 + wet * 0.16

music = np.stack([highpass(music[c], 28) for c in range(2)])
music = soft_clip(music * 0.9, 1.0) * 0.9

# ---------------------------------------------------------------- sfx
sfx = np.zeros((2, N), dtype=np.float32)

def hit(t, kind, **kw):
    if kind == "whoosh":
        add(sfx, whoosh(kw.get("dur", 0.65), kw.get("vel", 0.45)), t, 1.0, kw.get("pan", 0.0))
    elif kind == "impact":
        add(sfx, impact(kw.get("vel", 0.7)), t, 1.0, 0.0)
    elif kind == "riser":
        add(sfx, riser(kw.get("dur", 1.8), kw.get("vel", 0.40)), t, 1.0, 0.0)
    elif kind == "tick":
        add(sfx, tick(kw.get("vel", 0.25), kw.get("f", 1500)), t, 1.0, kw.get("pan", 0.0))
    elif kind == "paper":
        add(sfx, paper(kw.get("vel", 0.35)), t, 1.0, kw.get("pan", 0.0))
    elif kind == "bell":
        add(sfx, bell(kw.get("f", 880), kw.get("dur", 2.4), kw.get("vel", 0.25)), t, 1.0, kw.get("pan", 0.0))

hit(2.925, "whoosh", dur=0.55, vel=0.30, pan=0.2)
hit(4.325, "whoosh", dur=0.55, vel=0.28, pan=-0.2)
hit(5.175, "whoosh", dur=0.85, vel=0.20, pan=0.1)
hit(5.85, "riser", dur=1.50, vel=0.36)
hit(7.333, "impact", vel=0.72)
hit(9.95, "whoosh", dur=1.55, vel=0.30, pan=-0.1)
hit(12.55, "paper", vel=0.38)
hit(13.30, "tick", f=1250, vel=0.16, pan=-0.3)
hit(13.47, "tick", f=1400, vel=0.15, pan=-0.3)
hit(13.64, "tick", f=1550, vel=0.14, pan=-0.3)
hit(15.12, "paper", vel=0.28, pan=-0.2)
hit(15.95, "whoosh", dur=0.75, vel=0.22, pan=0.0)
for k in range(4):
    hit(16.34 + k * 0.25, "tick", f=1150 + k * 90, vel=0.13, pan=0.2)
hit(21.333, "impact", vel=0.55)
hit(21.058, "whoosh", dur=0.55, vel=0.22, pan=0.2)
hit(23.40, "tick", f=900, vel=0.16, pan=0.15)
hit(25.15, "whoosh", dur=0.45, vel=0.20, pan=-0.1)
hit(27.15, "paper", vel=0.30, pan=0.1)
for k in range(4):
    hit(27.45 + k * 0.16, "tick", f=1000 + k * 70, vel=0.10, pan=-0.2)
hit(29.267, "riser", dur=1.4, vel=0.20)
hit(30.667, "impact", vel=0.42)
hit(31.15, "tick", f=720, vel=0.18, pan=-0.2)
hit(31.85, "whoosh", dur=1.35, vel=0.16, pan=0.1)
hit(33.30, "tick", f=1350, vel=0.13, pan=0.2)
hit(33.46, "tick", f=1450, vel=0.12, pan=0.2)
hit(37.18, "paper", vel=0.34, pan=-0.1)
hit(40.00, "impact", vel=0.60)
hit(42.55, "whoosh", dur=0.5, vel=0.26, pan=0.2)
hit(45.05, "whoosh", dur=0.5, vel=0.24, pan=-0.2)
hit(49.333, "impact", vel=0.30)
hit(52.15, "whoosh", dur=0.7, vel=0.18, pan=0.0)
hit(52.90, "whoosh", dur=0.9, vel=0.22, pan=0.0)
hit(54.667, "impact", vel=0.55)

# ---------------------------------------------------------------- VO track
def read_wav_mono(path):
    import wave
    with wave.open(path, "rb") as w:
        assert w.getsampwidth() == 2
        n = w.getnframes()
        data = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(axis=1)
    return data

durs = {r["key"]: r["duration"] for r in json.load(open(os.path.join(ROOT, "assets", "vo", "durations.json"), encoding="utf8"))}
STARTS = {
    "l01": 0.55, "l02": 3.35, "l03": 7.55, "l04": 9.20,
    "l05": 13.30, "l06": 17.05, "l07": 21.85, "l08": 26.55,
    "l09": 31.20, "l10": 37.20, "l11": 40.55, "l12": 44.85,
    "l13": 48.65, "l14": 53.30,
}
vo = np.zeros(N, dtype=np.float32)
cues = []
for key, start in STARTS.items():
    x = read_wav_mono(os.path.join(ROOT, "assets", "vo", key + ".wav"))
    # trim edges again and fade
    n = len(x)
    nf = int(0.012 * SR)
    if n > 2 * nf:
        x[:nf] *= np.linspace(0, 1, nf)
        x[-nf:] *= np.linspace(1, 0, nf)
    rms = np.sqrt(np.mean(x ** 2)) + 1e-9
    target = 10 ** (-20 / 20)
    g = min(target / rms, 10 ** (6 / 20))
    x = x * g
    peak = np.max(np.abs(x)) + 1e-9
    if peak > 10 ** (-2 / 20):
        x *= 10 ** (-2 / 20) / peak
    i = int(start * SR)
    m = min(len(x), N - i)
    vo[i:i + m] += x[:m]
    cues.append({"key": key, "start": round(start, 3), "end": round(start + len(x) / SR, 3)})

# ---------------------------------------------------------------- mix
def write_wav(path, data):
    import wave
    d = np.clip(data, -1, 1).T
    pcm = (d * 32767).astype(np.int16)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())

def rms(x):
    return np.sqrt(np.mean(x ** 2) + 1e-12)

# normalize music and sfx to sensible stems
music *= 0.55 / (np.max(np.abs(music)) + 1e-9)
sfx *= 0.50 / (np.max(np.abs(sfx)) + 1e-9)
# the score is denser where the VO carries the most information: pull it back
music *= 0.86
mseg = np.ones(N, dtype=np.float32)
def gain_ramp(t0, t1, a, b):
    i0, i1 = int(t0 * SR), int(t1 * SR)
    mseg[i0:i1] = np.linspace(a, b, i1 - i0, dtype=np.float32)
gain_ramp(21.3, 22.2, 1.0, 0.62)
mseg[int(22.2 * SR):int(30.6 * SR)] = 0.62
gain_ramp(30.6, 31.4, 0.62, 0.52)
mseg[int(31.4 * SR):int(49.0 * SR)] = 0.52
gain_ramp(49.0, 50.0, 0.52, 0.86)
mseg[int(50.0 * SR):] = 0.86
music *= mseg[None, :]

# VO envelope for ducking
env = np.abs(vo)
win = int(0.05 * SR)
kernel = np.ones(win, dtype=np.float32) / win
env = np.convolve(env, kernel, mode="same")
env = np.clip(env / 0.035, 0, 1)
# smooth attack/release
a_att = math.exp(-1 / (0.06 * SR)); a_rel = math.exp(-1 / (0.40 * SR))
duck = np.zeros(N, dtype=np.float32)
g = 1.0
for i in range(N):
    target = 1.0 - 0.70 * env[i]
    coeff = a_att if target < g else a_rel
    g = coeff * g + (1 - coeff) * target
    duck[i] = g

bed = (music * 1.0 + sfx * 0.9) * duck[None, :]
# intro/outro space: keep bed up when VO is silent, natural
mix = bed + vo[None, :] * 0.92
mix = np.stack([highpass(mix[c], 26) for c in range(2)])

# soft limiter
peak = np.max(np.abs(mix)) + 1e-9
mix = mix / peak * 1.25
mix = np.tanh(mix) * 0.92
mix *= 10 ** (-1.2 / 20) / (np.max(np.abs(mix)) + 1e-9)

write_wav(os.path.join(OUT, "music.wav"), music)
write_wav(os.path.join(OUT, "sfx.wav"), sfx)
write_wav(os.path.join(OUT, "vo.wav"), np.stack([vo, vo]))
write_wav(os.path.join(OUT, "mix_raw.wav"), mix)

subprocess.run([
    "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
    "-i", os.path.join(OUT, "mix_raw.wav"),
    "-af", "loudnorm=I=-15:TP=-1:LRA=9",
    "-ar", "48000", os.path.join(OUT, "mix.wav"),
], check=True)

# measure
def measure(path):
    out = subprocess.check_output(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], stderr=subprocess.STDOUT).decode("utf8", "replace")
    lines = [l for l in out.splitlines() if "I:" in l or "Peak:" in l]
    return lines[-4:]

json.dump({"cues": cues, "speech": round(sum(durs[k] for k in STARTS), 2)}, open(os.path.join(OUT, "vo_cues.json"), "w", encoding="utf8"), ensure_ascii=False, indent=2)
print("wrote stems; VO ends", max(c["end"] for c in cues))
print("\n".join(measure(os.path.join(OUT, "mix_raw.wav"))))
