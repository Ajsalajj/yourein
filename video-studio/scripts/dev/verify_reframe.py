"""usage: verify_reframe.py outdir truth.json. Detects the face again in the RENDERED 9:16 frames of face.mp4 / centre.mp4 and measures framing."""
import sys, json
from pathlib import Path
import cv2, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ai-service"))
from app import faces as F  # noqa: E402
out = Path(sys.argv[1]); truth = json.load(open(sys.argv[2])); det = F.FaceDetector()
def analyse(p):
    v = cv2.VideoCapture(str(p)); rows = []; frames = {}; i = 0
    while True:
        ok, f = v.read()
        if not ok: break
        if i % 3 == 0:
            fs = det.scan(cv2.resize(f, (540, 960)))
            best = max(fs, key=lambda q: q["w"] * q["h"] * q["score"]) if fs else None
            rows.append((i, best)); frames[i] = f
        i += 1
    return rows, frames, i
res = {}; ok = True
for name in ("face", "centre"):
    rows, frames, n = analyse(out / f"{name}.mp4")
    present = [i for i, _ in rows if truth[min(i, len(truth) - 1)]["present"]]
    seen = [(i, b) for i, b in rows if b is not None and truth[min(i, len(truth) - 1)]["present"]]
    inside = [(i, b) for i, b in seen if b["x"] > 0.01 and b["x"] + b["w"] < 0.99 and b["y"] > 0.01 and b["y"] + b["h"] < 0.99]
    cxs = np.array([b["x"] + b["w"] / 2 for _, b in seen]); hs = np.array([b["h"] for _, b in seen])
    r = {"samples_with_face_in_source": len(present), "face_detected_in_output": len(seen), "face_fully_inside_frame": len(inside), "visible_share": round(len(seen) / max(1, len(present)), 3), "fully_inside_share": round(len(inside) / max(1, len(present)), 3)}
    if len(cxs):
        r.update({"median_abs_x_offset_from_centre": round(float(np.median(np.abs(cxs - 0.5))), 3), "max_abs_x_offset": round(float(np.abs(cxs - 0.5).max()), 3), "median_face_height_of_frame": round(float(np.median(hs)), 3)})
        idx = [i for i, _ in seen]; d = [abs(cxs[k + 1] - cxs[k]) / max(1, (idx[k + 1] - idx[k])) * 3 for k in range(len(cxs) - 1) if idx[k + 1] - idx[k] <= 6]
        r["max_x_change_per_3_frames"] = round(float(max(d)) if d else 0, 4)
    res[name] = r
    if name == "face":
        # contact sheet: 6 moments incl. just after the detection gap
        picks = [30, 120, 210, 300, 390, 480]; tw, th = 180, 320; sh = Image.new("RGB", (tw * len(picks), th), (10, 10, 10)); dr = ImageDraw.Draw(sh)
        for k, fi in enumerate(picks):
            fr = frames[min(frames, key=lambda q: abs(q - fi))]
            sh.paste(Image.fromarray(cv2.cvtColor(cv2.resize(fr, (tw, th)), cv2.COLOR_BGR2RGB)), (k * tw, 0)); dr.text((k * tw + 3, 2), f"t={fi / 30:.1f}s", fill=(255, 255, 0))
        sh.save(out / "reframe_face_sheet.png")
    else:
        picks = [30, 120, 210, 300, 390, 480]; tw, th = 180, 320; sh = Image.new("RGB", (tw * len(picks), th), (10, 10, 10)); dr = ImageDraw.Draw(sh)
        for k, fi in enumerate(picks):
            fr = frames[min(frames, key=lambda q: abs(q - fi))]
            sh.paste(Image.fromarray(cv2.cvtColor(cv2.resize(fr, (tw, th)), cv2.COLOR_BGR2RGB)), (k * tw, 0)); dr.text((k * tw + 3, 2), f"t={fi / 30:.1f}s", fill=(255, 255, 0))
        sh.save(out / "reframe_centre_sheet.png")
f, c = res["face"], res["centre"]
checks = {"face_visible_almost_always": f["visible_share"] >= 0.9, "face_cam_keeps_face_inside_frame": f["fully_inside_share"] >= 0.85, "centre_crop_loses_the_face": c["visible_share"] < 0.6,
          "face_cam_beats_centre": f["visible_share"] - c["visible_share"] > 0.3, "face_kept_near_centre": f.get("median_abs_x_offset_from_centre", 1) < 0.15,
          "no_jumps": f.get("max_x_change_per_3_frames", 1) < 0.04, "zoomed_towards_target_tightness": 0.15 < f.get("median_face_height_of_frame", 0) < 0.45}
res["checks"] = checks; res["pass"] = all(checks.values())
json.dump(res, open(out / "reframe_report.json", "w"), indent=1); print(json.dumps(res, indent=1)); sys.exit(0 if res["pass"] else 1)
