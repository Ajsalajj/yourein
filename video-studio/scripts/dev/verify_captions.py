"""Pixel evidence that captions are rendered and animated.
usage: verify_captions.py with.mp4 without.mp4 meta.json outdir  -> last stdout line is JSON
Frames are decoded with ffmpeg; no third-party video libs needed (Pillow only for PNG output)."""
import json, subprocess, sys, os
from PIL import Image, ImageChops, ImageStat

with_f, without_f, meta_f, out = sys.argv[1:5]
meta = json.load(open(meta_f))
segs = meta["segments"]

def src_to_out(t):
    for s in segs:
        if s["srcStartMs"] <= t <= s["srcEndMs"]:
            return s["outStartMs"] + (t - s["srcStartMs"])
    return None

def frame(path, t_ms, name):
    f = os.path.join(out, name)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t_ms/1000:.3f}", "-i", path, "-frames:v", "1", f], check=True)
    return Image.open(f).convert("RGB")

def region(im):
    w, h = im.size
    return im.crop((0, int(h * 0.55), w, int(h * 0.88)))  # where captions sit by default

# choose the caption group with the longest on-screen time
best = max(meta["captions"], key=lambda c: c["e"] - c["s"])
o0 = src_to_out(best["s"]); o1 = src_to_out(best["e"] - 50)
if o0 is None or o1 is None: raise SystemExit("no usable caption")
times = [o0 + (o1 - o0) * k / 5 for k in range(6)]
diffs_ctrl, animated = [], []
layers = []  # caption-only layer = (with captions) - (control without captions), per sampled time
for i, t in enumerate(times):
    a = frame(with_f, t, f"cap_{i}.png"); b = frame(without_f, t, f"ctl_{i}.png")
    d = ImageStat.Stat(ImageChops.difference(region(a), region(b))).mean
    diffs_ctrl.append(sum(d) / 3)
    layers.append(ImageChops.difference(region(a), region(b)))
for x, y in zip(layers, layers[1:]):
    # how much the CAPTION pixels themselves changed between samples (background video motion cancels out)
    animated.append(sum(ImageStat.Stat(ImageChops.difference(x, y)).mean) / 3)
# control noise: two renders of the same frame with captions off vs. the "top" strip (never has captions)
a = frame(with_f, times[2], "top_a.png"); b = frame(without_f, times[2], "top_b.png")
w, h = a.size
top = lambda im: im.crop((0, int(h * 0.12), w, int(h * 0.3)))
noise = sum(ImageStat.Stat(ImageChops.difference(top(a), top(b))).mean) / 3
print(json.dumps({"captionVsControl": max(diffs_ctrl), "controlNoise": noise, "animated": max(animated), "group": best["t"], "times": times}))
