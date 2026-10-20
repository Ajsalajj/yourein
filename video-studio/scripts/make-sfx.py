"""Generates the bundled sound-effect library: original synthesis (numpy), no samples, no third-party audio.
Licence: CC0 1.0 - dedicated to the public domain by the project. Output: public/sfx/<id>.wav (44.1 kHz, 16-bit mono).
usage: ai-service/.venv/bin/python scripts/make-sfx.py"""
import numpy as np, wave, os, json
SR = 44100
rng = np.random.default_rng(7)  # fixed seed -> reproducible files
def t_(d): return np.arange(int(SR * d)) / SR
def env(n, a=0.005, r=0.1):
    e = np.ones(n); na, nr = max(1, int(a * SR)), max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] = np.minimum(e[-nr:], np.linspace(1, 0, nr)); return e
def lp(x, fc):  # one-pole low-pass
    a = np.exp(-2 * np.pi * fc / SR); y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s = (1 - a) * x[i] + a * s; y[i] = s
    return y
def lp_var(x, fcs):
    y = np.zeros_like(x); s = 0.0
    for i in range(len(x)):
        a = np.exp(-2 * np.pi * fcs[i] / SR); s = (1 - a) * x[i] + a * s; y[i] = s
    return y
def hp(x, fc): return x - lp(x, fc)
def noise(n): return rng.standard_normal(n)
def norm(x, peak=0.89): return x / max(1e-9, np.abs(x).max()) * peak

def whoosh(d, f0, f1, shape=2.0):
    n = int(SR * d); t = np.linspace(0, 1, n)
    fc = f0 + (f1 - f0) * t ** shape
    x = lp_var(noise(n), fc) * np.sin(np.pi * t) ** 1.2
    return norm(x * 8)
def impact(d=1.2):
    t = t_(d); f = 120 * np.exp(-t * 6) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    click = lp(noise(len(t)), 5000) * np.exp(-t * 60) * 0.7
    tail = lp(noise(len(t)), 600) * np.exp(-t * 5) * 0.25
    return norm(body + click + tail)
def pop(d=0.18):
    t = t_(d); f = 700 * np.exp(-t * 28) + 180
    return norm(np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30))
def click(d=0.08):
    t = t_(d); return norm(hp(noise(len(t)), 1800) * np.exp(-t * 90) + np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120) * 0.5)
def ding(d=1.6):
    t = t_(d); x = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t * k) for f, a, k in [(1320, 1, 3.2), (2640, .45, 4.5), (3960, .22, 6), (1760, .3, 3.5)])
    return norm(x * env(len(t), 0.002, 0.2))
def riser(d=2.0):
    n = int(SR * d); t = np.linspace(0, 1, n); fc = 300 + 7000 * t ** 2.2
    x = lp_var(noise(n), fc) * (0.15 + 0.85 * t ** 1.5)
    tone = np.sin(2 * np.pi * np.cumsum(200 + 900 * t ** 2) / SR) * 0.25 * t
    return norm((x * 6 + tone) * env(n, 0.05, 0.03))
def glitch(d=0.45):
    n = int(SR * d); x = np.zeros(n); i = 0
    while i < n:
        L = int(rng.uniform(0.01, 0.05) * SR); f = rng.choice([300, 700, 1800, 4200]); tt = np.arange(L) / SR
        seg = np.sign(np.sin(2 * np.pi * f * tt)) * 0.5 + noise(L) * 0.25
        x[i:i + L] += seg[: n - i] if i + L > n else seg
        i += L + int(rng.uniform(0, 0.025) * SR)
    return norm(x * env(n, 0.002, 0.05))
def tick(d=0.05):
    t = t_(d); return norm(np.sin(2 * np.pi * 1500 * t) * np.exp(-t * 140) + hp(noise(len(t)), 3000) * np.exp(-t * 200) * 0.4)
def shutter(d=0.32):
    n = int(SR * d); t = np.arange(n) / SR
    x = hp(noise(n), 1200) * (np.exp(-t * 70) + 0.8 * np.exp(-np.maximum(0, t - 0.11) * 90) * (t > 0.11))
    return norm(x)
def sparkle(d=1.0):
    n = int(SR * d); x = np.zeros(n)
    for k in range(14):
        s = int(rng.uniform(0, 0.7) * SR); f = rng.uniform(2500, 7000); L = int(0.22 * SR); tt = np.arange(L) / SR
        seg = np.sin(2 * np.pi * f * tt) * np.exp(-tt * 18) * rng.uniform(0.3, 1)
        e = min(n, s + L); x[s:e] += seg[: e - s]
    return norm(x * env(n, 0.002, 0.15))
def swell(d=1.4):
    n = int(SR * d); t = np.linspace(0, 1, n); x = lp(noise(n), 900) * np.sin(np.pi * t) ** 2
    return norm(x * 8)

LIB = [
 ("whoosh-soft", "Whoosh (soft)", "transition", whoosh(0.7, 400, 4200, 1.6), ["whoosh", "swipe", "slide", "transition"]),
 ("whoosh-fast", "Whoosh (fast)", "transition", whoosh(0.35, 900, 9000, 1.3), ["whip", "pan", "fast", "swish"]),
 ("whoosh-reverse", "Whoosh (reverse)", "transition", whoosh(0.8, 5000, 300, 0.6)[::-1].copy(), ["reverse", "zoom", "blur"]),
 ("swell", "Swell", "transition", swell(), ["fade", "cinematic", "soft"]),
 ("impact", "Impact hit", "emphasis", impact(), ["hit", "boom", "punch", "drop", "slam"]),
 ("pop", "Pop", "emphasis", pop(), ["pop", "bubble", "word", "appear"]),
 ("click", "Click", "ui", click(), ["click", "button", "ui", "tap"]),
 ("tick", "Typewriter tick", "ui", tick(), ["type", "typing", "keyboard", "text"]),
 ("ding", "Ding", "emphasis", ding(), ["ding", "bell", "success", "notification", "idea"]),
 ("riser", "Riser", "build", riser(), ["riser", "tension", "build", "rise", "reveal"]),
 ("glitch", "Glitch", "texture", glitch(), ["glitch", "digital", "error", "tech"]),
 ("shutter", "Camera shutter", "ui", shutter(), ["camera", "photo", "capture", "freeze"]),
 ("sparkle", "Sparkle", "texture", sparkle(), ["sparkle", "magic", "shine", "glow"]),
]
os.makedirs("public/sfx", exist_ok=True)
manifest = []
for id_, name, cat, x, tags in LIB:
    pcm = (np.clip(x, -1, 1) * 32767).astype("<i2")
    with wave.open(f"public/sfx/{id_}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    manifest.append({"id": id_, "name": name, "category": cat, "durationMs": round(len(x) * 1000 / SR), "tags": tags})
    print(id_, round(len(x) / SR, 2), "s", os.path.getsize(f"public/sfx/{id_}.wav") // 1024, "KB")
json.dump(manifest, open("public/sfx/manifest.json", "w"), indent=1)
