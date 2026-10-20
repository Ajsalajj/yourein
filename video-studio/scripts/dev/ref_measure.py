"""Pixel measurements on a reference video (analysis only - frames are never redistributed).

  ref_measure.py timeline <video> <out.json>            per-frame stats of 'text-like' colour classes + largest blob
  ref_measure.py track    <video> <class> <t0> <t1>     per-frame bbox/centroid/area of the largest blob of a colour class
  ref_measure.py colors   <video> <class> <t0> <t1>     dominant colours (hex) of the pixels of a class in a window
Classes: white (min(R,G,B)>=238), yellow, green (neon), cyan, purple, orange, red.
All measurements are at the video's native resolution; fractions are of the frame."""
import json, subprocess, sys
import numpy as np, cv2

def frames(path, t0=0, t1=None, step=1):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS); n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    i0 = int(t0 * fps); i1 = n if t1 is None else min(n, int(t1 * fps) + 1)
    cap.set(cv2.CAP_PROP_POS_FRAMES, i0)
    for i in range(i0, i1):
        ok, f = cap.read()
        if not ok: break
        if (i - i0) % step == 0: yield i, i / fps, f
    cap.release()

def mask_of(frame, cls):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV); h, s, v = hsv[..., 0].astype(int) * 2, hsv[..., 1].astype(int), hsv[..., 2].astype(int)
    b, g, r = frame[..., 0].astype(int), frame[..., 1].astype(int), frame[..., 2].astype(int)
    if cls == "white":  m = (np.minimum(np.minimum(r, g), b) >= 238)
    elif cls == "yellow": m = (h >= 42) & (h <= 62) & (s >= 150) & (v >= 200)
    elif cls == "green":  m = (h >= 90) & (h <= 150) & (s >= 170) & (v >= 150)
    elif cls == "cyan":   m = (h >= 175) & (h <= 200) & (s >= 120) & (v >= 190)
    elif cls == "purple": m = (h >= 245) & (h <= 285) & (s >= 140) & (v >= 140)
    elif cls == "orange": m = (h >= 12) & (h <= 38) & (s >= 170) & (v >= 220)
    elif cls == "red":    m = ((h <= 8) | (h >= 345)) & (s >= 180) & (v >= 190)
    else: raise SystemExit("unknown class")
    return m.astype(np.uint8)

def blob(mask, min_area=300):
    m = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, lab, st, cen = cv2.connectedComponentsWithStats(m, connectivity=8)
    if n <= 1: return None
    # merge all components that are big enough: a word is several letters
    keep = [i for i in range(1, n) if st[i, cv2.CC_STAT_AREA] >= min_area]
    if not keep: return None
    x0 = min(st[i, 0] for i in keep); y0 = min(st[i, 1] for i in keep)
    x1 = max(st[i, 0] + st[i, 2] for i in keep); y1 = max(st[i, 1] + st[i, 3] for i in keep)
    area = int(sum(st[i, cv2.CC_STAT_AREA] for i in keep))
    return dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0), cx=float((x0 + x1) / 2), cy=float((y0 + y1) / 2), area=area)

if __name__ == "__main__":
    cmd, video = sys.argv[1], sys.argv[2]
    if cmd == "timeline":
        out = {}
        for i, t, f in frames(video):
            H, W = f.shape[:2]
            row = {}
            for c in ("white", "yellow", "green", "cyan", "purple", "orange"):
                m = mask_of(f, c); row[c] = round(float(m.mean()) * 100, 3)
            out[i] = dict(t=round(t, 3), **row)
        json.dump(dict(fps=cv2.VideoCapture(video).get(cv2.CAP_PROP_FPS), frames=out), open(sys.argv[3], "w"))
        print("frames:", len(out))
    elif cmd == "track":
        cls, t0, t1 = sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
        H = None
        for i, t, f in frames(video, t0, t1):
            H, W = f.shape[:2]
            b = blob(mask_of(f, cls))
            print(f"{t:6.3f}s f{i:4d} " + ("none" if not b else f"bbox=({b['x']},{b['y']},{b['w']}x{b['h']}) centre=({b['cx']/W:.3f},{b['cy']/H:.3f}) h/H={b['h']/H:.3f} w/W={b['w']/W:.3f} area={b['area']}"))
    elif cmd == "colors":
        cls, t0, t1 = sys.argv[3], float(sys.argv[4]), float(sys.argv[5])
        px = []
        for i, t, f in frames(video, t0, t1, step=3):
            m = mask_of(f, cls).astype(bool)
            px.append(f[m][:, ::-1])
        px = np.concatenate(px) if px else np.zeros((0, 3))
        if len(px) == 0: print("no pixels"); sys.exit()
        q = (px // 16) * 16 + 8
        vals, cnt = np.unique(q, axis=0, return_counts=True)
        top = np.argsort(-cnt)[:6]
        print(f"{len(px)} px; top colours:", ", ".join("#%02x%02x%02x (%.0f%%)" % (*vals[k], 100 * cnt[k] / cnt.sum()) for k in top))
        print("median colour: #%02x%02x%02x" % tuple(int(x) for x in np.median(px, axis=0)))
