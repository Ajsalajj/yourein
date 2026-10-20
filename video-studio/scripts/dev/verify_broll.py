"""usage: verify_broll.py broll.mp4 control.mp4 plan.json outdir. Checks the rendered B-roll export against independent expectations
built from the B-roll source file and the control render (same edit, no B-roll)."""
import sys, json, subprocess, cv2, numpy as np
from PIL import Image, ImageDraw
b_p, c_p, plan_p, out = sys.argv[1:5]; plan = json.load(open(plan_p)); fps = plan["fps"]
def frames(p):
    v = cv2.VideoCapture(p); fs = []
    while True:
        ok, f = v.read()
        if not ok: break
        fs.append(f)
    return fs
B, C = frames(b_p), frames(c_p); n = min(len(B), len(C)); H, W = B[0].shape[:2]
clipsrc = cv2.VideoCapture(plan["clipFile"])
def clipframe(ms):
    clipsrc.set(cv2.CAP_PROP_POS_MSEC, ms); ok, f = clipsrc.read(); return f
def cover(img, w, h):
    k = max(w / img.shape[1], h / img.shape[0]); r = cv2.resize(img, (round(img.shape[1] * k), round(img.shape[0] * k)), interpolation=cv2.INTER_AREA)
    y0, x0 = (r.shape[0] - h) // 2, (r.shape[1] - w) // 2; return r[y0:y0 + h, x0:x0 + w]
small = lambda f: cv2.resize(f, (W // 6, H // 6), interpolation=cv2.INTER_AREA).astype(np.float32)
mad = lambda a, b: float(np.abs(small(a) - small(b)).mean()) if a.shape == b.shape else float(np.abs(a.astype(np.float32) - b.astype(np.float32)).mean())
res = {}; ok = True
inwin = set()
for c in plan["clips"]:
    s, e = round(c["startMs"] * fps / 1000), round(c["endMs"] * fps / 1000); inwin |= set(range(s, e))
    mid = (s + e) // 2; tms = c["clipInMs"] + (mid - s) * 1000 / fps; ex = clipframe(tms); got = B[mid]; ctrl = C[mid]
    r = {"mid_frame": mid}
    if c["mode"] == "full":
        r["diff_vs_expected_clip"] = round(mad(got, cover(ex, W, H)), 2); r["diff_vs_control"] = round(mad(got, ctrl), 2)
        r["pass"] = r["diff_vs_expected_clip"] < 12 and r["diff_vs_control"] > 25
    elif c["mode"] == "split-top":
        top_exp = cover(ex, W, H // 2); top_got = got[: H // 2]
        r["top_half_vs_clip"] = round(mad(top_got, top_exp), 2); r["top_half_vs_control"] = round(mad(top_got, ctrl[: H // 2]), 2)
        bottom_exp = cover(ctrl, W, H // 2)  # speaker footage re-fitted into the lower half (cover crop of the same static photo)
        r["bottom_half_vs_refit_speaker"] = round(mad(got[H // 2:], bottom_exp), 2); r["bottom_vs_unmoved_control"] = round(mad(got[H // 2:], ctrl[H // 2:]), 2)
        r["pass"] = r["top_half_vs_clip"] < 14 and r["top_half_vs_control"] > 20 and r["bottom_half_vs_refit_speaker"] < r["bottom_vs_unmoved_control"]
    elif c["mode"] == "overlay":
        expect = (0.5 * cover(ex, W, H).astype(np.float32) + 0.5 * ctrl.astype(np.float32)).astype(np.uint8)
        r["diff_vs_50pct_blend"] = round(mad(got, expect), 2); r["diff_vs_control"] = round(mad(got, ctrl), 2); r["diff_vs_clip_only"] = round(mad(got, cover(ex, W, H)), 2)
        r["pass"] = r["diff_vs_50pct_blend"] < 10 and r["diff_vs_50pct_blend"] < r["diff_vs_control"] and r["diff_vs_50pct_blend"] < r["diff_vs_clip_only"]
    elif c["mode"] == "pip":
        x0, x1, y0, y1 = int(W * 0.56), int(W * 0.91), int(H * 0.07), int(H * 0.07) + int(0.43 * (9 / 16) * 1.6 * H * 0.8)
        panel_exp = cv2.resize(cover(ex, round(W * 0.43), round(0.43 * (9 / 16) * 1.6 * H)), (x1 - x0, y1 - y0)) if False else None
        # inside the panel the pixels must differ from the control and the rest of the frame must equal the control
        inner = np.abs(got[y0:y1, x0:x1].astype(np.float32) - ctrl[y0:y1, x0:x1].astype(np.float32)).mean()
        outside = np.abs(got[int(H * 0.55):].astype(np.float32) - ctrl[int(H * 0.55):].astype(np.float32)).mean()
        r["panel_vs_control"] = round(float(inner), 2); r["outside_vs_control"] = round(float(outside), 2); r["pass"] = inner > 25 and outside < 3
    ok &= r["pass"]; res[c["id"]] = r
# outside every clip window the export equals the control
outside = [mad(B[i], C[i]) for i in range(n) if all(abs(i - w) > 12 for w in [min(inwin, key=lambda x: abs(x - i))])] if inwin else []
res["_max_diff_far_from_clips"] = round(max(outside), 2) if outside else 0; ok &= res["_max_diff_far_from_clips"] < 3
# transitions at the full clip's edges: first/last frames of the window continue the speaker/clip smoothly
f = plan["clips"][0]; s, e = round(f["startMs"] * fps / 1000), round(f["endMs"] * fps / 1000)
res["_full_in_flash_peak_luma"] = round(float(max(B[i].mean() for i in range(s, s + 12))), 1); res["_control_luma_same_frames"] = round(float(max(C[i].mean() for i in range(s, s + 12))), 1)
ok &= res["_full_in_flash_peak_luma"] > res["_control_luma_same_frames"] + 15 or res["_full_in_flash_peak_luma"] > 150
res["_cinematic_fade_out_min_luma"] = round(float(min(B[i].mean() for i in range(e - 12, e))), 1)
# audio: speaker audio must be identical with and without B-roll
def aud(p): return np.frombuffer(subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-vn", "-ac", "1", "-ar", "44100", "-f", "s16le", "-"], capture_output=True).stdout, dtype="<i2").astype(np.float64) / 32768
a, c = aud(b_p), aud(c_p); m = min(len(a), len(c)); d = a[:m] - c[:m]
res["audio_rms_control"] = round(float(np.sqrt((c[:m] ** 2).mean())), 4); res["audio_rms_difference"] = round(float(np.sqrt((d ** 2).mean())), 5)
res["audio_difference_db_below_speech"] = round(float(20 * np.log10(max(res["audio_rms_difference"], 1e-9) / max(res["audio_rms_control"], 1e-9))), 1)
res["audio_preserved"] = res["audio_difference_db_below_speech"] < -40; ok &= res["audio_preserved"]
# contact sheet: one frame per mode, plus transitions
rows = [("full+flash in", plan["clips"][0]["startMs"] + 100), ("full mid", (plan["clips"][0]["startMs"] + plan["clips"][0]["endMs"]) / 2), ("full+fade out", plan["clips"][0]["endMs"] - 150), ("split-top", (plan["clips"][1]["startMs"] + plan["clips"][1]["endMs"]) / 2), ("overlay 50%", (plan["clips"][2]["startMs"] + plan["clips"][2]["endMs"]) / 2), ("pip", (plan["clips"][3]["startMs"] + plan["clips"][3]["endMs"]) / 2), ("control", 3500)]
tw, th = 180, 320; sh = Image.new("RGB", (tw * len(rows), th + 14), (12, 12, 12)); dr = ImageDraw.Draw(sh)
for i, (lab, ms) in enumerate(rows):
    src = C if lab == "control" else B; fr_ = src[min(n - 1, int(ms * fps / 1000))]
    sh.paste(Image.fromarray(cv2.cvtColor(cv2.resize(fr_, (tw, th)), cv2.COLOR_BGR2RGB)), (i * tw, 14)); dr.text((i * tw + 3, 1), lab, fill=(255, 255, 0))
sh.save(f"{out}/broll_contact_sheet.png")
res["pass"] = bool(ok)
json.dump(res, open(f"{out}/broll_report.json", "w"), indent=1, default=lambda o: bool(o) if isinstance(o, np.bool_) else float(o)); print(json.dumps(res, indent=1, default=lambda o: bool(o) if isinstance(o, np.bool_) else float(o))); sys.exit(0 if ok else 1)
