"""Verify the core-30 validation MP4 from its pixels and audio. usage: verify_presets.py video.mp4 truth.json outdir"""
import json, subprocess, sys, os, math
import numpy as np
from PIL import Image, ImageDraw

video, truth_f, out = sys.argv[1:4]
truth = json.load(open(truth_f))
FPS = 30
W, H = 270, 480

# ---- decode all frames (gray, small) as a stream
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", video, "-vf", f"scale={W}:{H},format=gray", "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
frames = []
while True:
    b = p.stdout.read(W * H)
    if len(b) < W * H: break
    frames.append(np.frombuffer(b, np.uint8).astype(np.float32))
frames = np.stack(frames); n = len(frames)
bg = frames[int(0.1 * FPS)]                      # before any caption: pure static background
energy = np.abs(frames - bg).mean(axis=1)        # how much caption is on screen
motion = np.r_[0, np.abs(np.diff(frames, axis=0)).mean(axis=1)]  # frame-to-frame change
noise = float(np.percentile(energy[: int(0.35 * FPS)], 99))

def fi(ms): return int(round(ms * FPS / 1000))
res = []
sigs = []
for k, pr in enumerate(truth["presets"]):
    s, e = pr["startMs"], pr["endMs"]
    a, b = max(0, fi(s - 250)), min(n - 1, fi(e + 100))
    seg_e, seg_m = energy[a:b], motion[a:b]
    present = float(seg_e.max())
    # thresholds are relative: 3x the measured noise floor AND 15% of this preset's own peak (thin type is dim but real)
    thr = max(noise * 3, 0.15 * present)
    first = next((i for i in range(a, b) if energy[i] > thr), None)
    appear_ms = None if first is None else first * 1000 / FPS - s
    animated_frames = int((seg_m > 0.06).sum())
    sig = np.r_[np.interp(np.linspace(0, len(seg_e) - 1, 40), np.arange(len(seg_e)), seg_e / (seg_e.max() + 1e-6)),
                np.interp(np.linspace(0, len(seg_m) - 1, 40), np.arange(len(seg_m)), seg_m / (seg_m.max() + 1e-6))]
    sigs.append(sig)
    # captions must be gone again before the next preset starts
    nxt = truth["presets"][k + 1]["startMs"] if k + 1 < len(truth["presets"]) else None
    gone = None if nxt is None else float(energy[fi(nxt - 500): fi(nxt - 150)].max())
    res.append({"n": pr["n"], "label": pr["label"], "template": pr["templateId"], "present": round(present, 2), "presentVsNoise": round(present / max(noise, 1e-6), 1), "appearOffsetMs": None if appear_ms is None else round(appear_ms), "animatedFrames": animated_frames, "residualBeforeNext": None if gone is None else round(gone, 2)})

# ---- distinctness: pairwise distance between per-preset motion/energy signatures
sig = np.stack(sigs)
d = np.linalg.norm(sig[:, None] - sig[None], axis=2) + np.eye(len(sig)) * 1e9
pairs = sorted((float(d[i, j]), res[i]["label"], res[j]["label"]) for i in range(len(sig)) for j in range(i + 1, len(sig)))

# ---- audio sync: onset of each spoken word in the EXPORTED audio vs ground truth
aud = subprocess.run(["ffmpeg", "-v", "error", "-i", video, "-vn", "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
a16 = np.frombuffer(aud, np.int16).astype(np.float32) / 32768
step = 160  # 10 ms
rms = np.sqrt(np.convolve(a16 ** 2, np.ones(step) / step, "same"))[::step]
deltas = []
for w in truth["words"]:
    i0, i1 = int((w["startMs"] - 120) / 10), int((w["startMs"] + 200) / 10)
    seg = rms[max(0, i0):i1]
    if seg.max() < 0.01: continue
    peak = rms[int(w["startMs"] / 10): int(w["endMs"] / 10)].max()
    on = next((i for i in range(max(0, i0), i1) if rms[i] > 0.25 * peak), None)
    if on is not None: deltas.append(on * 10 - w["startMs"])
deltas = np.array(deltas)

# ---- global audio sync of the export: cross-correlate the exported audio with the SOURCE speech.wav
src = subprocess.run(["ffmpeg", "-v", "error", "-i", os.path.join(os.path.dirname(truth_f), "speech.wav"), "-ac", "1", "-ar", "16000", "-f", "s16le", "-"], capture_output=True).stdout
s16 = np.frombuffer(src, np.int16).astype(np.float32) / 32768
m = min(len(s16), len(a16))
env = lambda x: np.convolve(np.abs(x), np.ones(80) / 80, "same")[::16]       # 1 ms-resolution envelopes
e1, e2 = env(s16[:m]), env(a16[:m])
lags = range(-120, 121)
corr = [float(np.dot(e1[max(0, -l): len(e1) - max(0, l)], e2[max(0, l): len(e2) - max(0, -l)][: len(e1) - abs(l)])) for l in lags]
global_lag_ms = int(list(lags)[int(np.argmax(corr))])

# ---- video sync for a word-by-word preset (Spring word pop = #3): first motion after each word start
pop = next((p for p in truth["presets"] if p["templateId"] == "word-pop"), None)
pw = [w for w in truth["words"] if pop and w["preset"] == truth["presets"].index(pop)]
vid_delta = []
aud_delta = []
for w in pw:
    a, b = fi(w["startMs"] - 150), fi(w["startMs"] + 350)
    m = motion[a:b]
    base = np.median(motion[fi(pop["startMs"] - 300):fi(pop["startMs"] - 50)]) if pop else 0
    onset = next((a + i for i, v in enumerate(m) if v > max(0.15 * m.max(), base + 0.05)), None)
    if onset is not None: vid_delta.append(onset * 1000 / FPS - w["startMs"])
    ai0, ai1 = int((w["startMs"] - 120) / 10), int((w["startMs"] + 250) / 10)
    pk = rms[int(w["startMs"] / 10): int(w["endMs"] / 10)].max()
    aon = next((i for i in range(max(0, ai0), ai1) if rms[i] > 0.25 * pk), None)
    if onset is not None and aon is not None: aud_delta.append(aon * 10 - w["startMs"])

# ---- contact sheets: 6 frames per preset, cropped around the caption
def grab(ms):
    f = os.path.join(out, "_f.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{ms/1000:.3f}", "-i", video, "-frames:v", "1", "-vf", "scale=360:640", f], check=True)
    return Image.open(f).convert("RGB")
cw, ch = 240, 190
per_sheet = 10
for sheet in ([] if os.environ.get('SKIP_SHEETS') else range(math.ceil(len(truth["presets"]) / per_sheet))):
    rows = truth["presets"][sheet * per_sheet:(sheet + 1) * per_sheet]
    img = Image.new("RGB", (cw * 6, ch * len(rows)), (10, 10, 14)); dr = ImageDraw.Draw(img)
    for r, pr in enumerate(rows):
        for c in range(6):
            t = pr["startMs"] + (pr["endMs"] - pr["startMs"]) * (0.04 + 0.9 * c / 5)
            f = grab(t)
            crop_h = int(360 * ch / cw)                          # keep the cell's aspect ratio
            cy = int(640 * pr.get("posY", 0.72))                 # centre the crop on where this template puts its caption
            y0 = max(0, min(640 - crop_h, cy - crop_h // 2))
            img.paste(f.crop((0, y0, 360, y0 + crop_h)).resize((cw, ch)), (c * cw, r * ch))
        dr.rectangle((0, r * ch, 150, r * ch + 12), fill=(0, 0, 0)); dr.text((3, r * ch + 1), f"{pr['n']}. {pr['label']}", fill=(255, 255, 255))
    img.save(os.path.join(out, f"sheet_{sheet + 1}.png"))

summary = {
    "frames": n, "noiseFloor": round(noise, 3),
    "allPresent": all(r["present"] > 3 * noise for r in res),
    "minPresenceVsNoiseFloor": min(r["presentVsNoise"] for r in res),
    "allAnimated": all(r["animatedFrames"] >= 8 for r in res),
    "minAnimatedFrames": min(r["animatedFrames"] for r in res),
    "allExit": all((r["residualBeforeNext"] or 0) < 1.0 for r in res),
    "maxResidual": max((r["residualBeforeNext"] or 0) for r in res),
    "appearOffsetMs": {"median": float(np.median([r["appearOffsetMs"] for r in res if r["appearOffsetMs"] is not None])), "max": max(r["appearOffsetMs"] for r in res if r["appearOffsetMs"] is not None), "min": min(r["appearOffsetMs"] for r in res if r["appearOffsetMs"] is not None)},
    "closestPairs": [{"dist": round(x, 3), "a": a, "b": b} for x, a, b in pairs[:4]],
    "audioOnsetErrorMs": {"n": int(len(deltas)), "mean": round(float(deltas.mean()), 1), "maxAbs": float(np.abs(deltas).max())},
    "exportedAudioVsSourceLagMs": global_lag_ms,
    "wordPopVisualMinusAudioOnsetMs": None if not vid_delta or not aud_delta else {"n": min(len(vid_delta), len(aud_delta)), "mean": round(float(np.mean(vid_delta[:len(aud_delta)]) - np.mean(aud_delta[:len(vid_delta)])), 1)},
    "wordPopVideoOnsetMs": {"n": len(vid_delta), "mean": round(float(np.mean(vid_delta)), 1) if vid_delta else None, "min": min(vid_delta) if vid_delta else None, "max": max(vid_delta) if vid_delta else None},
}
json.dump({"summary": summary, "presets": res}, open(os.path.join(out, "validation-report.json"), "w"), indent=1)
for r in res: print(f"{r['n']:>2} {r['label']:<30} present={r['present']:>6} appear={str(r['appearOffsetMs']):>5}ms animatedFrames={r['animatedFrames']:>3} residual={r['residualBeforeNext']}")
print(json.dumps(summary))
