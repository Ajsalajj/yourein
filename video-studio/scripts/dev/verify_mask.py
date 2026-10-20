"""Alignment of text occlusion with the matte, measured on the rendered MP4s. usage: verify_mask.py dir
none.mp4 = no title, front.mp4 = title over everything, behind_*.mp4 = title behind the subject (different matte refinements)."""
import sys, json, cv2, numpy as np
from pathlib import Path
d = Path(sys.argv[1]); meta = json.load(open(d / "meta.json")); frames = meta["frames"]
def read(name, idx):
    v = cv2.VideoCapture(str(d / name)); v.set(cv2.CAP_PROP_POS_FRAMES, idx); ok, f = v.read(); return f
res = {}; ok = True
for name in meta["meta"]:
    rows = []
    for fi in frames:
        N, F, B = read("none.mp4", fi), read("front.mp4", fi), read(f"{name}.mp4", fi)
        H, W = N.shape[:2]
        m = cv2.imread(str(d / f"{name}_matte_{fi}.png"), cv2.IMREAD_UNCHANGED)[..., 3].astype(np.float32) / 255
        a = cv2.resize(m, (W, H), interpolation=cv2.INTER_CUBIC)
        diff = lambda x, y: np.abs(x.astype(np.int16) - y.astype(np.int16)).max(axis=2)
        text = diff(F, N) > 60                                  # where the title is drawn when nothing hides it
        vis = diff(B, N) > 60                                   # where the title is visible in the behind-render
        core, free = a > 0.97, a < 0.03
        band = (a >= 0.03) & (a <= 0.97)
        t_core, t_free, t_band = (text & core).sum(), (text & free).sum(), (text & band).sum()
        rows.append({"frame": fi, "text_px": int(text.sum()), "text_px_over_subject_core": int(t_core), "hidden_in_core": round(float(1 - (vis & text & core).sum() / max(1, t_core)), 4),
                     "visible_outside_subject": round(float((vis & text & free).sum() / max(1, t_free)), 4), "text_px_in_edge_band": int(t_band),
                     "edge_band_visible_share": round(float((vis & text & band).sum() / max(1, t_band)), 3), "subject_area_px": int((a > 0.5).sum())})
    res[name] = rows
    r0 = rows[1]
    ok &= r0["text_px_over_subject_core"] > 500 and r0["hidden_in_core"] > 0.97 and r0["visible_outside_subject"] > 0.97
# controls: soft feather widens the edge band share of partially visible text; grow enlarges the subject
bs = lambda n: np.mean([r["edge_band_visible_share"] for r in res[n]])
area = lambda n: np.mean([r["subject_area_px"] for r in res[n]])
res["_edge_band_partial_visibility_hard_vs_soft"] = [round(float(bs("behind_hard")), 3), round(float(bs("behind_soft")), 3)]
res["_subject_area_default_vs_grown"] = [int(area("behind_default")), int(area("behind_grown"))]
res["_grow_enlarges_subject"] = bool(area("behind_grown") > area("behind_default") * 1.01)
ok &= res["_grow_enlarges_subject"]
# contact sheet: front / behind default / hard / soft / grown at frame 120
from PIL import Image, ImageDraw
names = ["front", "behind_default", "behind_hard", "behind_soft", "behind_grown"]; tw, th = 216, 384
sh = Image.new("RGB", (tw * len(names), th), (10, 10, 10)); dr = ImageDraw.Draw(sh)
for i, n in enumerate(names):
    sh.paste(Image.fromarray(cv2.cvtColor(cv2.resize(read(f"{n}.mp4", 120), (tw, th)), cv2.COLOR_BGR2RGB)), (i * tw, 0)); dr.text((i * tw + 3, 2), n, fill=(255, 255, 0))
sh.save(d / "mask_contact_sheet.png")
# crop of the hair/edge region at 1:1 for the soft vs hard comparison
crop = lambda n: read(f"{n}.mp4", 120)[330:560, 300:780]
Image.fromarray(cv2.cvtColor(np.hstack([crop("behind_hard"), crop("behind_soft")]), cv2.COLOR_BGR2RGB)).save(d / "mask_edge_hard_vs_soft.png")
res["pass"] = bool(ok)
json.dump(res, open(d / "mask_report.json", "w"), indent=1); print(json.dumps(res, indent=1)); sys.exit(0 if ok else 1)
