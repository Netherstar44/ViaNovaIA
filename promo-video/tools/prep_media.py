"""Prepare graded stills, paper texture and trimmed clips for the VIANova film."""
import os, subprocess, sys, math
import numpy as np
from PIL import Image, ImageFilter
import requests

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets", "src")
IMG = os.path.join(ROOT, "assets", "img")
TEX = os.path.join(ROOT, "assets", "tex")
CLIPS = os.path.join(ROOT, "assets", "clips")
for d in (SRC, IMG, TEX, CLIPS):
    os.makedirs(d, exist_ok=True)

CLIENT = os.path.abspath(os.path.join(ROOT, "..", "client", "public", "images", "colombia"))

DOWNLOADS = {
    "rivera.jpg": "https://thumb.wikimedia.org/wikipedia/commons/thumb/e/ed/Rivera%2C_Huila%2C_Colombia_-_panoramio.jpg/3840px-Rivera%2C_Huila%2C_Colombia_-_panoramio.jpg",
    "tatacoa_hi.jpg": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6b/Desierto_de_La_Tatacoa_%28Tatacoa_Desert%29.jpg/3840px-Desierto_de_La_Tatacoa_%28Tatacoa_Desert%29.jpg",
}

def fetch():
    for name, url in DOWNLOADS.items():
        path = os.path.join(SRC, name)
        if os.path.exists(path) and os.path.getsize(path) > 100000:
            print("have", name)
            continue
        r = requests.get(url, timeout=60, headers={"User-Agent": "ViaNovaPromo/1.0"})
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
        print("downloaded", name, len(r.content))

def cover(im, w, h):
    sw, sh = im.size
    s = max(w / sw, h / sh)
    nw, nh = int(round(sw * s)), int(round(sh * s))
    im = im.resize((nw, nh), Image.LANCZOS)
    x = (nw - w) // 2
    y = (nh - h) // 2
    return im.crop((x, y, x + w, y + h))

def grade(im, grain=0.014, vig=0.94, warm=1.0):
    a = np.asarray(im.convert("RGB"), dtype=np.float32) / 255.0
    # contrast around 0.46
    a = np.clip((a - 0.46) * 1.065 + 0.455, 0, 1)
    # saturation
    lum = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    a = np.clip(lum[..., None] + (a - lum[..., None]) * 0.92, 0, 1)
    # warm highlights / cool lifted shadows
    l = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    hi = np.clip((l - 0.45) / 0.55, 0, 1)
    sh = np.clip((0.42 - l) / 0.42, 0, 1)
    a[..., 0] = np.clip(a[..., 0] + warm * (0.045 * hi + 0.006 * sh), 0, 1)
    a[..., 1] = np.clip(a[..., 1] + warm * (0.012 * hi), 0, 1)
    a[..., 2] = np.clip(a[..., 2] + warm * (0.024 * sh - 0.028 * hi), 0, 1)
    # lift the toe slightly
    a = np.clip(a * 0.982 + 0.012, 0, 1)
    # vignette
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w / 2) / (w / 2)
    ny = (yy - h / 2) / (h / 2)
    r2 = np.clip((nx * nx + ny * ny) / 2.0, 0, 1)
    v = 1.0 - (1.0 - vig) * (r2 ** 1.35)
    a *= v[..., None]
    # grain
    rng = np.random.default_rng(7)
    g = rng.normal(0, grain, (h, w, 1)).astype(np.float32)
    a = np.clip(a + g, 0, 1)
    return Image.fromarray((a * 255).round().astype(np.uint8), "RGB")

def save_still(src, dst, w=2400, h=1350, **kw):
    im = Image.open(src)
    im = cover(im, w, h)
    im = grade(im, **kw)
    im.save(dst, optimize=True)
    print("still", os.path.basename(dst), im.size)

def sharpness(src):
    im = Image.open(src).convert("L")
    im.thumbnail((1000, 1000))
    a = np.asarray(im, dtype=np.float32)
    gy, gx = np.gradient(a)
    return float(np.var(gx) + np.var(gy))

def paper():
    w, h = 1920, 1080
    base = np.array([242, 239, 230], dtype=np.float32) / 255.0
    rng = np.random.default_rng(11)
    a = np.ones((h, w, 3), dtype=np.float32) * base
    # large soft mottling + fine fibre
    coarse = rng.normal(0, 1, (h // 8, w // 8)).astype(np.float32)
    rng_ptp = float(np.ptp(coarse)) + 1e-6
    coarse = np.array(Image.fromarray(((coarse - coarse.min()) / rng_ptp * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC), dtype=np.float32) / 255.0
    a += (coarse[..., None] - 0.5) * 0.018
    a += rng.normal(0, 0.006, (h, w, 1)).astype(np.float32)
    # edge falloff
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w / 2) / (w / 2); ny = (yy - h / 2) / (h / 2)
    r2 = np.clip((nx * nx + ny * ny) / 2, 0, 1)
    a *= (1 - 0.035 * r2)[..., None]
    Image.fromarray((np.clip(a, 0, 1) * 255).round().astype(np.uint8), "RGB").save(os.path.join(TEX, "paper.png"), optimize=True)
    print("paper")

def ink():
    w, h = 1920, 1080
    rng = np.random.default_rng(5)
    a = np.ones((h, w, 3), dtype=np.float32) * np.array([20, 19, 15], dtype=np.float32) / 255.0
    a += rng.normal(0, 0.0035, (h, w, 1)).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w / 2) / (w / 2); ny = (yy - h / 2) / (h / 2)
    r2 = np.clip((nx * nx + ny * ny) / 2, 0, 1)
    a *= (1 - 0.10 * r2)[..., None]
    Image.fromarray((np.clip(a, 0, 1) * 255).round().astype(np.uint8), "RGB").save(os.path.join(TEX, "ink.png"), optimize=True)
    print("ink")

def clip(src, dst, seconds, start=0.0, w=1920, h=1080, crf=17):
    vf = (
        f"trim=start={start}:duration={seconds},setpts=PTS-STARTPTS,"
        f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps=30,"
        "eq=contrast=1.055:saturation=0.93:brightness=0.008,"
        "colorbalance=rs=-0.008:bs=0.012:rh=0.032:bh=-0.022,"
        "noise=alls=5:allf=t+u,vignette=PI/5.2,format=yuv420p"
    )
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", src,
           "-t", str(seconds), "-vf", vf, "-an", "-c:v", "libx264", "-preset", "slow",
           "-crf", str(crf), "-movflags", "+faststart", dst]
    subprocess.run(cmd, check=True)
    print("clip", os.path.basename(dst), seconds, "s")

def main():
    fetch()
    for name in ("tatacoa.jpg", "tatacoa_hi.jpg"):
        p = os.path.join(SRC, name)
        if os.path.exists(p):
            print("sharp", name, round(sharpness(p), 1))
    save_still(os.path.join(CLIENT, "tatacoa.webp"), os.path.join(IMG, "tatacoa.png"))
    save_still(os.path.join(CLIENT, "cocora-hero.webp"), os.path.join(IMG, "cocora.png"))
    save_still(os.path.join(CLIENT, "cartagena.webp"), os.path.join(IMG, "cartagena.png"))
    save_still(os.path.join(SRC, "rivera.jpg"), os.path.join(IMG, "rivera.png"))
    save_still(os.path.join(CLIENT, "hotel-huila.webp"), os.path.join(IMG, "hotel.png"))
    save_still(os.path.join(CLIENT, "restaurante-colombia.webp"), os.path.join(IMG, "restaurante.png"))
    save_still(os.path.join(CLIENT, "neiva-jardin.webp"), os.path.join(IMG, "neiva.png"))
    paper(); ink()
    clip(os.path.join(ROOT, "assets", "stock", "desert_aerial.mp4"), os.path.join(CLIPS, "desert.mp4"), 6.0)
    clip(os.path.join(ROOT, "assets", "stock", "man_wind.mp4"), os.path.join(CLIPS, "wind.mp4"), 4.0, start=7.0)

if __name__ == "__main__":
    main()
