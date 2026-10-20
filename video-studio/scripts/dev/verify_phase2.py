"""Pixel verification of the phase-2 comparison export. usage: verify_phase2.py captioned.mp4 control.mp4 plan.json outdir
Ink = pixels that differ between the captioned export and the identical no-caption control render."""
import sys, json, os
import cv2, numpy as np
from PIL import Image, ImageDraw

cap_p, ctl_p, plan_p, out = sys.argv[1:5]
plan = json.load(open(plan_p))
def frames(p):
    v = cv2.VideoCapture(p); fps = v.get(cv2.CAP_PROP_FPS); fs = []
    while True:
        ok, f = v.read()
        if not ok: break
        fs.append(f)
    return fs, fps
A, fps = frames(cap_p); B, _ = frames(ctl_p)
n = min(len(A), len(B)); H, W = A[0].shape[:2]
ink = []; boxes = []
for i in range(n):
    d = np.abs(A[i].astype(np.int16) - B[i].astype(np.int16)).max(axis=2) > 36
    d = cv2.morphologyEx(d.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
    ink.append(int(d.sum()))
    ys, xs = np.where(d)
    boxes.append((int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max())) if len(xs) > 40 else None)
fr = lambda ms: min(n - 1, max(0, round(ms * fps / 1000)))
report = {"fps": fps, "frames": n, "size": [W, H], "captions": []}
sheet_rows = []
fail = 0
for k, c in enumerate(plan["plan"]):
    s, e = fr(c["start"]), fr(c["end"])
    before = ink[max(0, s - 1)]
    win = ink[s:e]
    first = next((i for i, v in enumerate(win) if v > 0.15 * max(win)), None)
    peak_i = s + int(np.argmax(win[: max(3, int(0.7 * fps))]))
    settled_i = s + int(0.8 * (e - s)); exit_i = min(n - 1, e + 3)
    lw = fr(plan["captions"][k][-1]["startMs"])  # frame where the LAST word begins: area growth before that is words arriving
    settled = float(np.median(ink[s + int(0.75 * (e - s)): e - 1]))
    ov = ink[lw: lw + max(3, int(0.45 * fps))]
    present = max(win) > 400
    bb = [b for b in boxes[s + int(0.75 * (e - s)):e] if b]  # clipping is judged once settled (entries may deliberately start huge)
    # unclipped: ink never touches the outer 1% of the frame
    mx, my = int(W * 0.01), int(H * 0.01)
    clipped = any(b[0] <= mx or b[1] <= my or b[2] >= W - 1 - mx or b[3] >= H - 1 - my for b in bb)
    row = {"key": c["key"], "template": c["template"], "ink_before": before, "ink_peak": max(win), "ink_settled": settled,
           "first_ink_after_start_ms": None if first is None else round(first * 1000 / fps), "peak_frame_offset_ms": round((peak_i - s) * 1000 / fps),
           "overshoot_ratio_after_last_word": round(max(ov) / settled, 2) if settled else None,
           "ink_after_exit": ink[exit_i], "present": present, "clipped": clipped, "motion_present": (max(win) - min(win[: max(3, int(0.5 * fps))])) > 0.05 * max(win)}
    report["captions"].append(row)
    if not present or clipped: fail += 1
    # sheet row: before / entry / peak / settled / exit
    idx = [max(0, s - 2), min(e - 1, s + max(1, (first or 0) + 1)), peak_i, settled_i, exit_i]
    sheet_rows.append((c["key"], idx))
# per-word independence: red (#ff2d55) pixels only in the styled word of caption 1
def red(f):
    t = np.array([0x55, 0x2d, 0xff], np.int16)  # BGR of #ff2d55
    return int((np.abs(f.astype(np.int16) - t).max(axis=2) < 40).sum())
reds = [red(A[i]) for i in range(n)]
c1 = [reds[i] for i in range(fr(100), fr(1300))]
rest = [reds[i] for i in range(fr(1600), n)]
report["per_word_style"] = {"red_px_in_styled_caption_max": max(c1), "red_px_elsewhere_max": max(rest) if rest else 0, "pass": max(c1) > 800 and (max(rest) if rest else 0) < 0.25 * max(c1)}
if not report["per_word_style"]["pass"]: fail += 1
# contact sheet
tw = 216; th = round(H * tw / W)
sh = Image.new("RGB", (tw * 5, th * len(sheet_rows) + 18), (16, 16, 16)); dr = ImageDraw.Draw(sh)
for c, lab in enumerate(["before", "entry", "peak", "settled", "exit"]): dr.text((c * tw + 6, 3), lab, fill=(255, 255, 255))
for r, (key, idx) in enumerate(sheet_rows):
    for c, i in enumerate(idx):
        im = Image.fromarray(cv2.cvtColor(A[i], cv2.COLOR_BGR2RGB)).resize((tw, th)); sh.paste(im, (c * tw, 18 + r * th))
    dr.text((4, 22 + r * th), key, fill=(255, 255, 0))
    for c, i in enumerate(idx): Image.fromarray(cv2.cvtColor(A[i], cv2.COLOR_BGR2RGB)).save(f"{out}/{key}_{['before','entry','peak','settled','exit'][c]}.png")
sh.save(f"{out}/contact_sheet.png")
report["pass"] = fail == 0
json.dump(report, open(f"{out}/report.json", "w"), indent=1)
print(json.dumps(report, indent=1))
sys.exit(0 if fail == 0 else 1)
