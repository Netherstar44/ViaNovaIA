"""QA numérico de stills: sin visión, solo estadísticas de píxel."""
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / "stills"


def load(frame: int) -> np.ndarray:
    return np.asarray(Image.open(ROOT / f"f{frame:04d}.png").convert("RGB"), dtype=np.float32)


def stats(frame: int) -> None:
    a = load(frame)
    lum = a.mean(axis=2)
    print(
        f"f{frame:04d} mean={lum.mean():6.2f} p99={np.percentile(lum, 99):6.2f} "
        f"max={lum.max():6.1f} frac>40={(lum > 40).mean():.4f} frac>120={(lum > 120).mean():.4f}"
    )


def diff(a_f: int, b_f: int) -> None:
    a, b = load(a_f), load(b_f)
    d = np.abs(a - b).mean(axis=2)
    center = d[200:880, 200:1720]
    edges = np.concatenate([d[:120].ravel(), d[-120:].ravel(), d[:, :120].ravel(), d[:, -120:].ravel()])
    print(
        f"diff {a_f}->{b_f}: mean={d.mean():6.3f} center={center.mean():6.3f} "
        f"edges={edges.mean():6.3f} p99={np.percentile(d, 99):7.2f} frac>25={(d > 25).mean():.4f}"
    )


def region(frame: int, name: str, x: int, y: int, w: int, h: int) -> None:
    a = load(frame)[y : y + h, x : x + w]
    lum = a.mean(axis=2)
    bright = (lum > 180).mean()
    print(f"f{frame:04d} {name:14s} mean={lum.mean():6.2f} max={lum.max():6.1f} frac>180={bright:.4f}")


def bbox(frame: int, name: str, x: int, y: int, w: int, h: int, threshold: int = 180) -> None:
    a = load(frame)[y : y + h, x : x + w]
    lum = a.mean(axis=2)
    ys, xs = np.where(lum > threshold)
    if len(xs) == 0:
        print(f"f{frame:04d} {name:14s} bbox=none")
        return
    print(
        f"f{frame:04d} {name:14s} bbox=({x + xs.min()},{y + ys.min()})-"
        f"({x + xs.max()},{y + ys.max()}) n={len(xs)}"
    )


print("== transición Ch3 -> Ch4 ==")
for f in (900, 1180, 1190, 1196, 1199, 1200, 1206):
    stats(f)

print("\n== iris Ch4 -> Ch5 ==")
for f in (1670, 1679, 1680):
    stats(f)

print("\n== Ch2 -> Ch3 ==")
diff(719, 720)
for f in (719, 720):
    stats(f)

print("\n== Ch5 cursor ==")
for f in (1686, 1710, 1900):
    region(f, "cursor-zone", 1010, 700, 90, 100)

print("\n== captions / UI viva ==")
for f in (900, 1180, 1199, 1900):
    region(f, "caption-left", 120, 880, 900, 90)

print("\n== Ch7 flip / match cut ==")
for f in (2640, 2646, 2664, 2700, 2940, 2960, 2980, 2999, 3000, 3001, 3100):
    stats(f)
for pair in ((2940, 2960), (2960, 2980), (2980, 2999), (2999, 3000), (3000, 3001), (3001, 3100)):
    diff(*pair)

print("\n== tarjeta cierre (zona 690,410,720,280) ==")
for f in (2940, 2960, 2980, 2999, 3000, 3001, 3100, 3250, 3400, 3580):
    region(f, "card-zone", 690, 410, 720, 280)
    bbox(f, "gold-logo", 690, 410, 720, 280, 120)
