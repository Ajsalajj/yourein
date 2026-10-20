"""Analyse the transition exports in <dir> against control.mp4 (same edit, no transition). Window = frames 12..35 (join at 24).
Every check is computed on rendered pixels."""
import sys, os, json, cv2, numpy as np
from PIL import Image, ImageDraw
d = sys.argv[1]; J, W2 = 24, 12; F0, F1 = J - W2, J + W2
def load(p):
    v = cv2.VideoCapture(p); fs = []
    while True:
        ok, f = v.read()
        if not ok: break
        fs.append(cv2.resize(f, (270, 480), interpolation=cv2.INTER_AREA))
    return np.array(fs).astype(np.float32)
C = load(f"{d}/control.mp4")
mad = lambda a, b: float(np.abs(a - b).mean())
gray = lambda f: cv2.cvtColor(f.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)
def aniso(f):  # horizontal vs vertical gradient energy
    g = gray(f); gx = cv2.Sobel(g, cv2.CV_32F, 1, 0); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1); return float((gx ** 2).mean() / ((gy ** 2).mean() + 1e-6))
def radial_ratio(f):  # radial vs tangential gradient energy about the centre
    g = gray(f); gx = cv2.Sobel(g, cv2.CV_32F, 1, 0); gy = cv2.Sobel(g, cv2.CV_32F, 0, 1)
    h, w = g.shape; yy, xx = np.mgrid[0:h, 0:w]; rx, ry = xx - w / 2, yy - h / 2; n = np.hypot(rx, ry) + 1e-6; rx, ry = rx / n, ry / n
    er = (gx * rx + gy * ry) ** 2; et = (-gx * ry + gy * rx) ** 2; m = n > 40
    return float(er[m].mean() / (et[m].mean() + 1e-6))
types = [t for t in ["smooth-zoom", "radial-zoom-blur", "directional-blur", "whip-pan", "motion-blur", "camera-push", "flash", "mask-reveal", "slide", "cinematic-fade"] if os.path.exists(f"{d}/{t}.mp4")]
V = {t: load(f"{d}/{t}.mp4") for t in types}
report = {}; ok = True
for t in types:
    X = V[t]; n = min(len(X), len(C)); r = {}
    outside = [mad(X[i], C[i]) for i in list(range(0, F0)) + list(range(F1, n))]
    r["max_diff_outside_window"] = round(max(outside), 2)
    win = [mad(X[i], C[i]) for i in range(F0, F1)]
    r["window_diff_peak"] = round(max(win), 1); r["edge_diff_first"] = round(win[0], 1); r["edge_diff_last"] = round(win[-1], 1)
    mid = J
    checks = {"untouched_outside_window": r["max_diff_outside_window"] < 3.0,
              "edges_blend_into_clips": win[0] < 0.4 * max(win) and win[-1] < 0.4 * max(win),
              "mid_differs_from_control": win[len(win) // 2] > 8}
    A, B = C[F0 - 1], C[F1]  # untouched last frame of A / first frame of B
    lum = [float(X[i].mean()) for i in range(F0, F1)]
    if t == "flash": checks["white_flash"] = max(lum) > 215 and max(float(C[i].mean()) for i in range(F0, F1)) < 150
    if t == "cinematic-fade": checks["dips_to_black"] = min(lum) < 0.15 * min(float(A.mean()), float(B.mean()))
    if t in ("directional-blur", "whip-pan", "motion-blur"):
        base = min(aniso(C[i]) for i in range(F0 + 4, F1 - 3)); got = min(aniso(X[i]) for i in range(F0 + 4, F1 - 3))
        r["horizontal_gradient_energy_ratio_vs_control"] = round(got / base, 3); checks["blurs_along_x_only"] = got / base < (0.6 if t != "motion-blur" else 0.9)
    if t == "radial-zoom-blur":
        base = np.median([radial_ratio(C[i]) for i in range(F0 + 4, F1 - 3)]); got = min(radial_ratio(X[i]) for i in range(F0 + 4, F1 - 3))
        r["radial_to_tangential_gradient_ratio_vs_control"] = round(float(got / base), 3); checks["radial_streaks"] = got / base < 0.7
    if t == "slide":
        # at mid-window the two scenes sit side by side: left half is still the OUTGOING scene (testsrc2), right half already the INCOMING (mandelbrot)
        x = X[mid]; h = 135
        checks["two_clips_visible_side_by_side"] = mad(x[:, :h], A[:, h:]) < mad(x[:, :h], B[:, h:]) and mad(x[:, h:], B[:, :h]) < mad(x[:, h:], A[:, :h])
    if t == "mask-reveal":
        x = X[mid]; ch, cw = slice(200, 280), slice(100, 170); co = (slice(0, 60), slice(0, 60))
        checks["centre_is_incoming"] = mad(x[ch, cw], B[ch, cw]) < mad(x[ch, cw], A[ch, cw]); checks["corner_is_outgoing"] = mad(x[co], A[co]) < mad(x[co], B[co])
    checks = {k: bool(v) for k, v in checks.items()}; r["checks"] = checks; r["pass"] = all(checks.values()); ok &= r["pass"]; report[t] = r
# the ten looks must be pairwise distinct at mid-window
dist = {}
for i, a in enumerate(types):
    for b in types[i + 1:]: dist[f"{a}|{b}"] = round(mad(V[a][J], V[b][J]), 1)
report["_pairwise_min_mid_frame_diff"] = min(dist.values()) if dist else None
report["_all_distinct"] = (min(dist.values()) > 6) if dist else True; ok &= report["_all_distinct"]
# contact sheet
cols = [F0, F0 + 4, F0 + 8, J, F0 + 16, F0 + 20, F1 - 1]; tw, th = 135, 240
sh = Image.new("RGB", (tw * len(cols), th * len(types) + 14), (12, 12, 12)); dr = ImageDraw.Draw(sh)
for c, f in enumerate(cols): dr.text((c * tw + 4, 1), f"frame {f}", fill=(255, 255, 255))
for r_, t in enumerate(types):
    for c, f in enumerate(cols): sh.paste(Image.fromarray(cv2.cvtColor(cv2.resize(V[t][f], (tw, th)).astype(np.uint8), cv2.COLOR_BGR2RGB)), (c * tw, 14 + r_ * th))
    dr.text((4, 18 + r_ * th), t, fill=(255, 255, 0))
sh.save(f"{d}/transitions_contact_sheet.png")
report["pass"] = bool(ok)
json.dump(report, open(f"{d}/transition_report.json", "w"), indent=1); print(json.dumps(report, indent=1)); sys.exit(0 if ok else 1)
