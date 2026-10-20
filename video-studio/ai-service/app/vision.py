"""Real computer vision for the advanced effects.

* segment_video(): per-frame person matte with MediaPipe's Apache-2.0 selfie-segmentation network (TFLite, run via
  ai-edge-litert), lightly refined (temporal smoothing + edge sharpening). Output: RGBA PNGs whose alpha is the matte.
* track_region(): Lucas-Kanade sparse optical flow on a user-selected region; per-frame centre + scale.
No simulation: both read the actual video pixels.
"""
from __future__ import annotations

import subprocess
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

from . import config

Progress = Callable[[float, str], None]
MODEL = Path(__file__).resolve().parent.parent / "models" / "selfie_segmentation.tflite"


def _probe(path: Path) -> tuple[int, int, float]:
    import json
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,avg_frame_rate:stream_side_data=rotation", "-of", "json", str(path)], capture_output=True, text=True, check=True)
    s = json.loads(r.stdout)["streams"][0]
    w, h = int(s["width"]), int(s["height"])
    rot = abs(int((s.get("side_data_list") or [{}])[0].get("rotation", 0))) % 360
    if rot in (90, 270):
        w, h = h, w
    a, b = s["avg_frame_rate"].split("/")
    return w, h, float(a) / float(b)


def _frames(path: Path, fps: float, out_w: int, out_h: int):
    """Yield BGR frames at a fixed fps/size (ffmpeg applies rotation metadata)."""
    p = subprocess.Popen([config.FFMPEG, "-v", "error", "-i", str(path), "-vf", f"fps={fps},scale={out_w}:{out_h}", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    size = out_w * out_h * 3
    try:
        while True:
            b = p.stdout.read(size)
            if len(b) < size:
                return
            yield np.frombuffer(b, np.uint8).reshape(out_h, out_w, 3)
    finally:
        p.kill()


def _target_size(w: int, h: int, longest: int) -> tuple[int, int]:
    k = longest / max(w, h)
    return max(2, int(round(w * k / 2)) * 2), max(2, int(round(h * k / 2)) * 2)


class Segmenter:
    def __init__(self):
        if not MODEL.exists():
            raise RuntimeError("Segmentation model missing. Run: ai-service/.venv/bin/python scripts/fetch_models.py")
        from ai_edge_litert.interpreter import Interpreter
        self.it = Interpreter(model_path=str(MODEL))
        self.it.allocate_tensors()
        self.i = self.it.get_input_details()[0]["index"]
        self.o = self.it.get_output_details()[0]["index"]

    def matte(self, bgr: np.ndarray) -> np.ndarray:
        """float32 matte 0..1 at the frame's own size (letterboxed into the 256x256 network input)."""
        h, w = bgr.shape[:2]
        k = 256 / max(w, h)
        nw, nh = max(1, round(w * k)), max(1, round(h * k))
        small = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), (nw, nh), interpolation=cv2.INTER_AREA)
        canvas = np.zeros((256, 256, 3), np.uint8)
        x0, y0 = (256 - nw) // 2, (256 - nh) // 2
        canvas[y0:y0 + nh, x0:x0 + nw] = small
        self.it.set_tensor(self.i, canvas[None].astype(np.float32) / 255.0)
        self.it.invoke()
        m = self.it.get_tensor(self.o)[0, :, :, 0][y0:y0 + nh, x0:x0 + nw]
        return cv2.resize(m, (w, h), interpolation=cv2.INTER_CUBIC).clip(0, 1)


def segment_video(path: Path, out_dir: Path, fps: float, progress: Progress, longest: int = 480) -> dict:
    w, h, src_fps = _probe(path)
    ow, oh = _target_size(w, h, longest)
    out_dir.mkdir(parents=True, exist_ok=True)
    seg = Segmenter()
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout.strip() or 0)
    total = max(1, int(dur * fps))
    prev: Optional[np.ndarray] = None
    n = 0
    for frame in _frames(path, fps, ow, oh):
        m = seg.matte(frame)
        if prev is not None:
            m = 0.65 * m + 0.35 * prev               # temporal smoothing: calms flicker
        prev = m
        # sharpen the soft sigmoid edge, then feather by ~1px so cut-outs do not look jagged
        t = ((m - 0.35) / 0.3).clip(0, 1)
        a = cv2.GaussianBlur(t * t * (3 - 2 * t), (0, 0), 1.2)
        rgba = np.dstack([np.full_like(frame, 255), (a * 255).astype(np.uint8)])
        cv2.imwrite(str(out_dir / f"{n:06d}.png"), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 3])
        n += 1
        if n % 10 == 0:
            progress(min(0.98, n / total), f"segmenting frame {n}/{total}")
    if n == 0:
        raise RuntimeError("no frames could be decoded")
    return {"fps": fps, "width": ow, "height": oh, "frames": n, "method": "mediapipe-selfie-segmentation (TFLite, Apache-2.0)", "sourceWidth": w, "sourceHeight": h}


def track_region(path: Path, roi: dict, start_ms: int, fps: float, progress: Progress, max_ms: Optional[int] = None, longest: int = 640) -> dict:
    """Lucas-Kanade tracker. roi = normalized {x,y,w,h} (top-left) on the frame at start_ms.
    Returns per-frame centre (normalized) and scale relative to the first tracked frame."""
    w, h, _ = _probe(path)
    ow, oh = _target_size(w, h, longest)
    start_f = int(round(start_ms * fps / 1000))
    end_f = None if max_ms is None else int(round(max_ms * fps / 1000))
    lk = dict(winSize=(21, 21), maxLevel=3, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 30, 0.01))
    rx, ry, rw, rh = roi["x"] * ow, roi["y"] * oh, roi["w"] * ow, roi["h"] * oh
    cx, cy, scale = rx + rw / 2, ry + rh / 2, 1.0
    pts = None
    prev_gray = None
    track = []
    base_w = rw
    i = 0
    lost = 0
    for frame in _frames(path, fps, ow, oh):
        if end_f is not None and i > end_f:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if i == start_f:
            mask = np.zeros_like(gray); cv2.rectangle(mask, (int(rx), int(ry)), (int(rx + rw), int(ry + rh)), 255, -1)
            pts = cv2.goodFeaturesToTrack(gray, maxCorners=80, qualityLevel=0.01, minDistance=5, mask=mask)
            if pts is None or len(pts) < 6:
                raise RuntimeError("The selected region has too little texture to track - choose a region with edges or detail.")
            prev_gray = gray
        elif i > start_f and pts is not None:
            nxt, st, _ = cv2.calcOpticalFlowPyrLK(prev_gray, gray, pts, None, **lk)
            good = st.ravel() == 1
            if good.sum() >= 4:
                a, b = pts[good].reshape(-1, 2), nxt[good].reshape(-1, 2)
                d = b - a
                med = np.median(d, axis=0)
                keep = np.linalg.norm(d - med, axis=1) < max(3.0, 3 * np.median(np.linalg.norm(d - med, axis=1)) + 1e-3)  # reject outlier flows
                a, b = a[keep], b[keep]
                if len(a) >= 4:
                    cx += float(np.median(b[:, 0] - a[:, 0])); cy += float(np.median(b[:, 1] - a[:, 1]))
                    if len(a) >= 6:
                        da = np.linalg.norm(a[:, None] - a[None], axis=2); db = np.linalg.norm(b[:, None] - b[None], axis=2)
                        sel = da > 8
                        if sel.sum() > 10:
                            scale *= float(np.median(db[sel] / da[sel])) ** 1.0
                    pts = b.reshape(-1, 1, 2).astype(np.float32); lost = 0
                else:
                    lost += 1
            else:
                lost += 1
            # replenish features around the current estimate when too few survive
            if pts is None or len(pts) < 25 or lost:
                mask = np.zeros_like(gray); half_w, half_h = rw * scale / 2, rh * scale / 2
                cv2.rectangle(mask, (int(max(0, cx - half_w)), int(max(0, cy - half_h))), (int(min(ow - 1, cx + half_w)), int(min(oh - 1, cy + half_h))), 255, -1)
                fresh = cv2.goodFeaturesToTrack(gray, maxCorners=80, qualityLevel=0.01, minDistance=5, mask=mask)
                if fresh is not None and len(fresh) >= 6:
                    pts = fresh; lost = 0
            prev_gray = gray
        if i >= start_f:
            track.append([round(cx / ow, 5), round(cy / oh, 5), round(scale, 5)])
        if i % 15 == 0:
            progress(min(0.97, 0.05 + 0.9 * (i / max(1, (end_f or i + 30)))) if end_f else 0.5, f"tracking frame {i}")
        i += 1
    if not track:
        raise RuntimeError("start time is beyond the end of the video")
    return {"fps": fps, "startFrame": start_f, "points": track, "method": "Lucas-Kanade sparse optical flow (OpenCV)", "roi": roi}
