"""Pixel verification of behind-subject text, motion tracking and perspective.
usage: verify_advanced.py advanced.mp4 control.mp4 source.mp4 truth.json outdir"""
import json, os, subprocess, sys
import numpy as np, cv2

adv, ctl, src, truth_f, out = sys.argv[1:6]
truth = json.load(open(truth_f))

def frame(path, t, scale=None):
    f = os.path.join(out, "_t.png")
    vf = ["-vf", f"scale={scale}"] if scale else []
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.3f}", "-i", path, *vf, "-frames:v", "1", f], check=True)
    return cv2.imread(f)

T = 3.0
A, C = frame(adv, T), frame(ctl, T)                        # 1080x1920
S = frame(src, T, "1080:1920")                               # the untouched source frame
H, W = A.shape[:2]

# --- 1. behind-the-subject: where the person is, the exported pixel must equal the SOURCE pixel (title hidden);
#        in the control (title in front) the same pixels are overwritten by the title.
# the title sits at y=0.34; use the person matte-free evidence: compare against the source in a box over her face/hair
face = (int(0.32 * W), int(0.30 * H), int(0.72 * W), int(0.42 * H))   # x0,y0,x1,y1 across the headline row
def box(im, b): return im[b[1]:b[3], b[0]:b[2]].astype(float)
d_adv = np.abs(box(A, face) - box(S, face)).mean(axis=2)
d_ctl = np.abs(box(C, face) - box(S, face)).mean(axis=2)
# title letters are white; pixels where control differs strongly from source = where the title is drawn
title_px = d_ctl > 60
overlap_hidden = float((d_adv[title_px] < 40).mean()) if title_px.sum() else 0.0   # fraction of title pixels (in the face row) hidden by the person in the advanced render
# at the same time the title must still be visible somewhere not covered by the person (e.g. beside the head)
side = (int(0.0 * W), int(0.30 * H), int(0.20 * W), int(0.42 * H))
side_vis = float((np.abs(box(A, side) - box(S, side)).mean(axis=2) > 60).mean())

# --- 2. perspective: gold floor title must be a trapezoid (wider at the bottom than at the top)
gold = lambda im: ((im[:, :, 2] > 190) & (im[:, :, 1] > 150) & (im[:, :, 1] < 215) & (im[:, :, 0] < 140))
g = gold(A[int(0.72 * H):int(0.97 * H)])
rows = np.where(g.sum(axis=1) > 5)[0]
if len(rows) > 10:
    top, bot = rows[: max(4, len(rows) // 5)], rows[-max(4, len(rows) // 5):]
    def span(rs):
        xs = np.where(g[rs].any(axis=0))[0]; return int(xs.max() - xs.min()) if len(xs) else 0
    persp = {"topSpanPx": span(top), "bottomSpanPx": span(bot), "rows": int(len(rows))}
else:
    persp = {"topSpanPx": 0, "bottomSpanPx": 0, "rows": int(len(rows))}

# --- 3. tracking: independent measurement of the real patch with template matching, vs the tracked callout in the export
f0 = frame(src, 0.05, "1080:1920")
r = truth["patchRoi"]; x0, y0, x1, y1 = int(r["x"] * W), int(r["y"] * H), int((r["x"] + r["w"]) * W), int((r["y"] + r["h"]) * H)
tpl = f0[y0:y1, x0:x1]
yellow = lambda im: (np.abs(im[:, :, 2].astype(int) - 255) < 25) & (np.abs(im[:, :, 1].astype(int) - 214) < 30) & (im[:, :, 0] < 60)
rows_out = []
for t in (1.2, 2.2, 3.2, 4.2, 5.2, 6.2, 7.0):
    s = frame(src, t, "1080:1920")
    res = cv2.matchTemplate(s, tpl, cv2.TM_CCOEFF_NORMED)
    _, mv, _, loc = cv2.minMaxLoc(res)
    patch_c = (loc[0] + tpl.shape[1] / 2, loc[1] + tpl.shape[0] / 2)
    e = frame(adv, t)
    ys, xs = np.where(yellow(e))
    if len(xs) < 200: rows_out.append({"t": t, "found": False, "match": round(float(mv), 2)}); continue
    lab_c = (float(np.median(xs)), float(np.median(ys)))
    rows_out.append({"t": t, "found": True, "match": round(float(mv), 2), "patch": [round(patch_c[0]), round(patch_c[1])], "label": [round(lab_c[0]), round(lab_c[1])], "offset": [round(lab_c[0] - patch_c[0]), round(lab_c[1] - patch_c[1])]})
found = [x for x in rows_out if x["found"] and x["match"] > 0.5]
offs = np.array([x["offset"] for x in found]) if found else np.zeros((0, 2))
motion = float(np.ptp(np.array([x["patch"] for x in found]), axis=0).max()) if found else 0.0
track_report = {"samples": rows_out, "offsetStdPx": None if len(offs) < 2 else [round(float(offs[:, 0].std()), 1), round(float(offs[:, 1].std()), 1)], "patchTravelPx": round(motion, 1)}

# contact sheet
tiles = []
for t in (0.8, 2.0, 3.0, 4.5, 6.0, 7.2):
    tiles.append(cv2.resize(frame(adv, t), (360, 640)))
cv2.imwrite(os.path.join(out, "advanced_sheet.png"), np.hstack(tiles))
cv2.imwrite(os.path.join(out, "behind_vs_front.png"), np.hstack([cv2.resize(C, (540, 960)), cv2.resize(A, (540, 960))]))

summary = {
    "behindTitlePixelsHiddenByPerson": round(overlap_hidden, 3),
    "titleVisibleBesideHead": round(side_vis, 3),
    "perspective": persp,
    "tracking": track_report,
}
json.dump(summary, open(os.path.join(out, "advanced-report.json"), "w"), indent=1)
print(json.dumps(summary, indent=1))
