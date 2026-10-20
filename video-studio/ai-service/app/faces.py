"""Face detection + subject tracking for face-aware reframing.

Detector: MediaPipe BlazeFace short-range (Apache-2.0 TFLite, from the mediapipe 0.10.14 wheel via scripts/fetch_models.py), run with ai-edge-litert.
The SSD decoding (anchors, box regression, sigmoid scores, weighted NMS) is implemented here following the published MediaPipe graph config.
Tracking: a primary face is followed across the sampled frames by gated nearest-centre association; detection gaps are reported as None.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Callable, Optional

import cv2
import numpy as np

from . import vision

MODEL = Path(__file__).resolve().parent.parent / "models" / "face_detection_short_range.tflite"
Progress = Callable[[float, str], None]


def _anchors() -> np.ndarray:
    """896 anchors for the 128x128 short-range model: stride 8 (2 per cell) then three stride-16 layers merged (6 per cell). Fixed anchor size => w=h=1."""
    out = []
    for fm, per in ((16, 2), (8, 6)):
        for y in range(fm):
            for x in range(fm):
                out.extend([((x + 0.5) / fm, (y + 0.5) / fm)] * per)
    a = np.array(out, np.float32)
    assert a.shape[0] == 896
    return a


ANCHORS = _anchors()


def _iou(a: np.ndarray, b: np.ndarray) -> float:
    x0, y0 = max(a[0], b[0]), max(a[1], b[1]); x1, y1 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    return float(inter / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter + 1e-9))


class FaceDetector:
    def __init__(self, threshold: float = 0.55):
        if not MODEL.exists():
            raise RuntimeError("Face model missing. Run: ai-service/.venv/bin/python scripts/fetch_models.py")
        from ai_edge_litert.interpreter import Interpreter
        self.it = Interpreter(model_path=str(MODEL))
        self.it.allocate_tensors()
        self.inp = self.it.get_input_details()[0]["index"]
        outs = {tuple(o["shape"]): o["index"] for o in self.it.get_output_details()}
        self.reg = next(i for s, i in outs.items() if s[-1] == 16)
        self.cls = next(i for s, i in outs.items() if s[-1] == 1)
        self.threshold = threshold

    def detect(self, bgr: np.ndarray) -> list[dict]:
        """Faces as normalised boxes {x,y,w,h,score} (x,y = top-left) in the frame's own coordinates."""
        h, w = bgr.shape[:2]
        k = 128 / max(w, h)
        nw, nh = max(1, round(w * k)), max(1, round(h * k))
        small = cv2.resize(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB), (nw, nh), interpolation=cv2.INTER_AREA)
        canvas = np.zeros((128, 128, 3), np.uint8)
        x0, y0 = (128 - nw) // 2, (128 - nh) // 2
        canvas[y0:y0 + nh, x0:x0 + nw] = small
        self.it.set_tensor(self.inp, (canvas[None].astype(np.float32) - 127.5) / 127.5)
        self.it.invoke()
        raw = self.it.get_tensor(self.reg)[0]
        score = 1.0 / (1.0 + np.exp(-np.clip(self.it.get_tensor(self.cls)[0, :, 0], -30, 30)))
        keep = np.where(score >= self.threshold)[0]
        cand = []
        for i in keep:
            r, a = raw[i], ANCHORS[i]
            xc, yc = r[0] / 128 + a[0], r[1] / 128 + a[1]
            bw, bh = r[2] / 128, r[3] / 128
            cand.append((np.array([xc - bw / 2, yc - bh / 2, xc + bw / 2, yc + bh / 2], np.float32), float(score[i])))
        # weighted NMS (MediaPipe: min suppression threshold 0.3)
        cand.sort(key=lambda c: -c[1])
        out = []
        while cand:
            best = cand.pop(0)
            group, rest = [best], []
            for c in cand:
                (group if _iou(best[0], c[0]) > 0.3 else rest).append(c)
            cand = rest
            ws = np.array([g[1] for g in group], np.float32)
            box = (np.stack([g[0] for g in group]) * ws[:, None]).sum(0) / ws.sum()
            # back from the letterboxed 128 canvas to normalised frame coordinates
            bx0, by0 = (box[0] * 128 - x0) / nw, (box[1] * 128 - y0) / nh
            bx1, by1 = (box[2] * 128 - x0) / nw, (box[3] * 128 - y0) / nh
            bx0, by0, bx1, by1 = [float(np.clip(v, 0, 1)) for v in (bx0, by0, bx1, by1)]
            if bx1 - bx0 > 0.01 and by1 - by0 > 0.01:
                out.append({"x": bx0, "y": by0, "w": bx1 - bx0, "h": by1 - by0, "score": best[1]})
        return out

    # ── windows: the 128x128 network sees small faces poorly, so faces are searched at several scales ──
    def detect_window(self, bgr: np.ndarray, cx: float, cy: float, side: float) -> list[dict]:
        """Detect inside a square window (centre/side in pixels, clipped to the frame); boxes returned in whole-frame normalised coordinates."""
        h, w = bgr.shape[:2]
        side = float(min(max(side, 32), max(w, h)))
        x0 = int(round(min(max(cx - side / 2, 0), max(0, w - side)))); y0 = int(round(min(max(cy - side / 2, 0), max(0, h - side))))
        x1, y1 = min(w, int(round(x0 + side))), min(h, int(round(y0 + side)))
        crop = bgr[y0:y1, x0:x1]
        if crop.size == 0:
            return []
        out = []
        for f in self.detect(crop):
            out.append({"x": (x0 + f["x"] * (x1 - x0)) / w, "y": (y0 + f["y"] * (y1 - y0)) / h, "w": f["w"] * (x1 - x0) / w, "h": f["h"] * (y1 - y0) / h, "score": f["score"]})
        return out

    def scan(self, bgr: np.ndarray) -> list[dict]:
        """Multi-scale sliding windows (square windows of 1.0, 0.7 and 0.5 of the short side, stride = half a window) merged with NMS."""
        h, w = bgr.shape[:2]
        found = list(self.detect(bgr))
        short = min(w, h)
        for k in (1.0, 0.7, 0.5):
            side = short * k
            xs = np.unique(np.linspace(side / 2, max(side / 2, w - side / 2), max(1, int(np.ceil((w - side) / (side / 2))) + 1)))
            ys = np.unique(np.linspace(side / 2, max(side / 2, h - side / 2), max(1, int(np.ceil((h - side) / (side / 2))) + 1)))
            for cy in ys:
                for cx in xs:
                    found.extend(self.detect_window(bgr, float(cx), float(cy), side))
        return _nms(found)


def _nms(faces: list[dict], thr: float = 0.35) -> list[dict]:
    """IoU NMS, then drop any box that CONTAINS another confident box: one face never contains a second face, so the larger box is
    the head+shoulders/helmet false positive that big search windows produce around a small real face."""
    faces = sorted(faces, key=lambda f: -f["score"])
    keep: list[dict] = []
    for f in faces:
        b = np.array([f["x"], f["y"], f["x"] + f["w"], f["y"] + f["h"]])
        if all(_iou(b, np.array([k["x"], k["y"], k["x"] + k["w"], k["y"] + k["h"]])) <= thr for k in keep):
            keep.append(f)

    def inside(small: dict, big: dict) -> float:
        x0, y0 = max(small["x"], big["x"]), max(small["y"], big["y"])
        x1, y1 = min(small["x"] + small["w"], big["x"] + big["w"]), min(small["y"] + small["h"], big["y"] + big["h"])
        return max(0.0, x1 - x0) * max(0.0, y1 - y0) / (small["w"] * small["h"] + 1e-9)

    out = []
    for f in keep:
        contains = any(o is not f and o["w"] * o["h"] < 0.6 * f["w"] * f["h"] and inside(o, f) > 0.8 and o["score"] >= 0.55 * f["score"] for o in keep)
        if not contains:
            out.append(f)
    return out


def _associate(prev: Optional[dict], faces: list[dict], gate: float) -> Optional[dict]:
    """Primary subject: continue the previous face if one is near enough, otherwise the largest confident face."""
    if not faces:
        return None
    if prev is not None:
        pc = np.array([prev["x"] + prev["w"] / 2, prev["y"] + prev["h"] / 2])
        best, bd = None, 1e9
        for f in faces:
            d = float(np.hypot(*(np.array([f["x"] + f["w"] / 2, f["y"] + f["h"] / 2]) - pc)))
            if d < bd:
                best, bd = f, d
        if best is not None and bd <= gate:
            return best
    return max(faces, key=lambda f: f["score"] ** 3 * (f["w"] * f["h"]) ** 0.5)  # confidence first, size as tie-break


def analyse_faces(path: Path, progress: Progress, sample_fps: float = 10.0, longest: int = 960, max_ms: Optional[int] = None) -> dict:
    """Sample the video at `sample_fps`; follow the primary face by re-detecting inside a window around it (cheap), with a full multi-scale
    scan when there is no face to follow and every ~1.5 s to notice a new/larger subject."""
    w, h, _ = vision._probe(path)
    tw, th = vision._target_size(w, h, longest)
    det = FaceDetector()
    samples: list[dict] = []
    prev: Optional[dict] = None
    missed = 0
    for i, frame in enumerate(vision._frames(path, sample_fps, tw, th)):
        t_ms = int(round(i * 1000 / sample_fps))
        if max_ms is not None and t_ms > max_ms:
            break
        faces: list[dict] = []
        if prev is not None:
            side = max(0.35 * min(tw, th), 3.4 * max(prev["w"] * tw, prev["h"] * th))
            faces = det.detect_window(frame, (prev["x"] + prev["w"] / 2) * tw, (prev["y"] + prev["h"] / 2) * th, side)
        if not faces or i % int(max(1, sample_fps * 1.5)) == 0:
            faces = _nms(faces + det.scan(frame))
        prim = _associate(prev, faces, gate=0.22 if missed < sample_fps * 1.5 else 9.0)
        missed = 0 if prim else missed + 1
        if prim:
            prev = prim
        r4 = lambda f: {k: round(float(v), 4) for k, v in f.items()}
        samples.append({"t": t_ms, "faces": [r4(f) for f in faces[:6]], "primary": None if prim is None else r4(prim)})
        if i % 5 == 0:
            progress(min(0.95, 0.02 + i / max(1, (max_ms or 600_000) / 1000 * sample_fps)), "detecting faces")
    detected = sum(1 for s in samples if s["primary"])
    return {"fps": sample_fps, "width": w, "height": h, "method": "mediapipe-blazeface-short-range", "samples": samples, "detected": detected, "total": len(samples)}
