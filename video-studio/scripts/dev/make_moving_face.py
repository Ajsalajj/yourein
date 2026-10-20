"""Synthetic 16:9 footage with a KNOWN moving face for reframing tests: the portrait sample is pasted on a checkerboard and sweeps left->right
(with a vertical sway); the face is absent from 5.0-6.5 s (a detection gap). Writes data/samples/moving-face.mp4 and moving-face.truth.json."""
import json, subprocess, sys
from pathlib import Path
import cv2, numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ai-service"))
from app import faces  # noqa: E402

root = Path(__file__).resolve().parents[2]
img = cv2.imread(str(root / "data/samples/person_still.png"))
d = faces.FaceDetector(); f = d.scan(img)[0]
W, H, FPS, DUR = 1280, 720, 30, 12
scale = 0.6
p = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA); ph, pw = p.shape[:2]
fc = ((f["x"] + f["w"] / 2) * pw, (f["y"] + f["h"] / 2) * ph, f["w"] * pw, f["h"] * ph)
yy, xx = np.mgrid[0:H, 0:W]; bg = np.where(((xx // 80 + yy // 80) % 2)[..., None] == 0, np.array([70, 60, 55]), np.array([105, 92, 85])).astype(np.uint8)
out = root / "data/samples/moving-face.mp4"
wr = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "14", str(out)], stdin=subprocess.PIPE)
truth = []
for i in range(FPS * DUR):
    t = i / FPS
    cx = 260 + (W - 520) * (t / DUR)            # face centre x in px
    cy = 330 + 25 * np.sin(t * 1.3)
    c = bg.copy(); gap = 5.0 <= t < 6.5
    x0, y0 = int(cx - fc[0]), int(cy - fc[1])
    if not gap:
        xs, ys, xe, ye = max(0, x0), max(0, y0), min(W, x0 + pw), min(H, y0 + ph)
        c[ys:ye, xs:xe] = p[ys - y0:ye - y0, xs - x0:xe - x0]
    truth.append({"t": round(t, 3), "cx": cx / W, "cy": cy / H, "h": fc[3] / H, "present": not gap})
    wr.stdin.write(c.tobytes())
wr.stdin.close(); wr.wait()
(root / "data/samples/moving-face.truth.json").write_text(json.dumps(truth))
print("wrote", out)
