"""Geometry checks on the rendered motion-graphics stills (data/stills-graphics). usage: verify_graphics.py dir
 - circle: text pixels lie on an annulus of the requested radius (true per-glyph circular path)
 - arc: pixels stay inside the requested sweep
 - shatter: just after the break starts the shards still reconstruct the intact text (the triangle mesh tiles the text box), and later most pixels have left the box"""
import sys, json, cv2, numpy as np
from pathlib import Path
d = Path(sys.argv[1]); res = {}; ok = True
def white(p, thr=235):
    im = cv2.imread(str(p)); return (im.min(axis=2) >= thr)
# comp 1080x1920 rendered at 0.5 -> 540x960; short side 540 px; centre (0.5, 0.5)
W, H = 540, 960; cx, cy = W / 2, H / 2
m = white(d / "circle_40.png"); ys, xs = np.where(m)
r = np.hypot(xs - cx, ys - cy); R = 0.32 * 540
res["circle"] = {"text_px": int(m.sum()), "median_radius_px": round(float(np.median(r)), 1), "expected_radius_px": R, "share_within_glyph_height": round(float(((r > R - 22) & (r < R + 22)).mean()), 3)}
ok &= res["circle"]["share_within_glyph_height"] > 0.95
# arc: -70..+70 degrees about 12 o'clock, centre (0.5,0.6)
ys, xs = np.where((np.abs(cv2.imread(str(d / "circle-arc_30.png"))[..., 2].astype(int) - 255) < 40) & (cv2.imread(str(d / "circle-arc_30.png"))[..., 0] < 80))
yy, xx = ys - 0.6 * H, xs - cx; ang = np.degrees(np.arctan2(xx, -yy)); rr = np.hypot(xx, yy)
res["arc"] = {"text_px": int(len(xs)), "min_deg": round(float(ang.min()), 1) if len(xs) else None, "max_deg": round(float(ang.max()), 1) if len(xs) else None, "median_radius_px": round(float(np.median(rr)), 1) if len(xs) else None, "expected_radius_px": 0.34 * 540}
ok &= len(xs) > 500 and -90 < ang.min() and ang.max() < 90 and abs(float(np.median(rr)) - 0.34 * 540) < 30
# shatter
intact = white(d / "shatter-out_30.png"); early = white(d / "shatter-tile_61.png"); mid = white(d / "shatter-out_75.png")
ys, xs = np.where(intact); box = (xs.min() - 6, xs.max() + 6, ys.min() - 6, ys.max() + 6)
inside = lambda m: int(m[box[2]:box[3], box[0]:box[1]].sum())
k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
iou = (cv2.dilate(early.astype(np.uint8), k) & intact.astype(np.uint8)).sum() / max(1, intact.sum())
res["shatter"] = {"intact_px": int(intact.sum()), "coverage_of_intact_text_by_shards_with_tiny_spread": round(float(iou), 3), "share_of_text_px_still_in_box_mid_break": round(inside(mid) / max(1, intact.sum()), 3)}
ok &= iou > 0.9 and res["shatter"]["share_of_text_px_still_in_box_mid_break"] < 0.5
res["pass"] = bool(ok); json.dump(res, open(d / "graphics_report.json", "w"), indent=1); print(json.dumps(res, indent=1)); sys.exit(0 if ok else 1)
