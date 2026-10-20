"""Foreground matte refinement for text-behind-subject.

Pipeline per frame (all real image processing, no learned post-processing):
  raw network matte (256x256 MediaPipe selfie segmentation, letterboxed)
    -> bicubic upsample to the working resolution
    -> guided-filter edge refinement against the VIDEO FRAME (edges snap to real image edges; recovers detail the 256 px net cannot represent)
    -> motion-compensated temporal consistency (Farneback flow warps the previous matte onto this frame; blended where the warp is photometrically reliable)
    -> contrast curve (sharpen the soft sigmoid edge) + grow/shrink (morphology) + feather (Gaussian)
`legacy=True` reproduces the earlier pipeline (EMA + sharpen + 1.2 px blur) so improvements can be measured against it.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional

import cv2
import numpy as np


@dataclass
class MatteOpts:
    #: guided-filter edge refinement against the frame
    guided: bool = True
    #: 0..0.9 weight of the motion-compensated previous matte
    temporal: float = 0.7
    #: Gaussian feather in px at the working resolution (edge softness)
    feather: float = 1.0
    #: grow (+) / shrink (-) the matte by this many px at the working resolution
    grow: float = 0.0
    #: reproduce the pre-phase-3 pipeline
    legacy: bool = False

    def clean(self) -> "MatteOpts":
        return MatteOpts(bool(self.guided), float(np.clip(self.temporal, 0, 0.9)), float(np.clip(self.feather, 0, 12)), float(np.clip(self.grow, -8, 8)), bool(self.legacy))

    def dict(self) -> dict:
        return asdict(self.clean())


def _smoothstep(x: np.ndarray) -> np.ndarray:
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


class MatteRefiner:
    def __init__(self, opts: Optional[MatteOpts] = None):
        self.o = (opts or MatteOpts()).clean()
        self.prev_a: Optional[np.ndarray] = None
        self.prev_gray: Optional[np.ndarray] = None

    def step(self, bgr: np.ndarray, raw: np.ndarray) -> np.ndarray:
        """bgr uint8 HxWx3, raw float32 HxW (0..1) already at the frame size. Returns the final alpha float32 0..1."""
        o = self.o
        if o.legacy:
            m = raw if self.prev_a is None else 0.65 * raw + 0.35 * self.prev_a
            self.prev_a = m
            t = ((m - 0.35) / 0.3).clip(0, 1)
            return cv2.GaussianBlur(t * t * (3 - 2 * t), (0, 0), 1.2)

        h, w = raw.shape
        m = raw.astype(np.float32)
        if o.guided:
            r = max(3, int(round(max(h, w) * 0.012)))
            m = cv2.ximgproc.guidedFilter(guide=bgr, src=m, radius=r, eps=(0.03 * 255) ** 2).clip(0, 1)
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        if o.temporal > 0 and self.prev_a is not None and self.prev_gray is not None:
            # flow from the current frame back to the previous one, used to pull the previous matte onto the current pixels
            flow = cv2.calcOpticalFlowFarneback(gray, self.prev_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
            gx, gy = np.meshgrid(np.arange(w, dtype=np.float32), np.arange(h, dtype=np.float32))
            mapx, mapy = gx + flow[..., 0], gy + flow[..., 1]
            warped = cv2.remap(self.prev_a, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            wgray = cv2.remap(self.prev_gray, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            # trust the warp only where it explains the frame (photometric consistency); elsewhere use the new matte
            err = cv2.GaussianBlur(np.abs(gray.astype(np.float32) - wgray.astype(np.float32)), (0, 0), 1.5)
            trust = np.exp(-err / 10.0)
            wt = o.temporal * trust
            m = wt * warped + (1 - wt) * m
        self.prev_gray = gray
        self.prev_a = m.copy()  # keep the soft matte (before the contrast curve) as the temporal state

        a = _smoothstep((m - 0.5) / 0.28 + 0.5)  # sharpen the sigmoid edge around 0.5
        if o.grow != 0:
            k = int(round(abs(o.grow)))
            if k >= 1:
                ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * k + 1, 2 * k + 1))
                a = cv2.dilate(a, ker) if o.grow > 0 else cv2.erode(a, ker)
        if o.feather > 0:
            a = cv2.GaussianBlur(a, (0, 0), o.feather)
        return a.clip(0, 1)
