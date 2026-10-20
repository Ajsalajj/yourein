"""Synthetic composite with EXACT ground-truth alpha: the portrait photo (alpha derived once at full resolution) is moved, scaled and pasted over an animated
background, so the true matte of every frame is known by construction. Used to compare matte pipelines objectively."""
from pathlib import Path
import cv2, numpy as np

ROOT = Path(__file__).resolve().parents[2]
STILL = ROOT / "data" / "samples" / "person_still.png"


def person_alpha(img):
    from app.vision import Segmenter
    from app.matte import _smoothstep
    seg = Segmenter()
    raw = seg.raw(img)
    m = Segmenter.upsample(raw, img.shape[1], img.shape[0])
    m = cv2.ximgproc.guidedFilter(guide=img, src=m, radius=10, eps=(0.02 * 255) ** 2).clip(0, 1)
    return cv2.GaussianBlur(_smoothstep((m - 0.5) / 0.2 + 0.5), (0, 0), 1.0)


def build(frames=45, W=540, H=960):
    img = cv2.imread(str(STILL))
    alpha = person_alpha(img)
    out_frames, gt = [], []
    yy, xx = np.mgrid[0:H, 0:W]
    for i in range(frames):
        t = i / (frames - 1)
        # animated background: diagonal colour bars drifting, plus a checker
        bg = np.zeros((H, W, 3), np.uint8)
        ph = (xx + yy * 0.6 + i * 9) % 160
        bg[..., 0] = 60 + 120 * (ph / 160); bg[..., 1] = 140 - 80 * (ph / 160); bg[..., 2] = 90 + 80 * np.sin(ph / 25 + i / 6)
        bg = np.where(((xx // 40 + yy // 40) % 2)[..., None] == 0, bg, (bg * 0.7).astype(np.uint8))
        s = 0.62 + 0.06 * np.sin(t * 6.0)
        M = np.array([[s * 0.75, 0, W / 2 - 0.75 * s * 360 + 70 * np.sin(t * 5.0)], [0, s * 0.75, H / 2 - 0.75 * s * 640 + 25 * np.cos(t * 4.0)]], np.float32)
        warped = cv2.warpAffine(img, M, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT)
        a = cv2.warpAffine(alpha.astype(np.float32), M, (W, H), flags=cv2.INTER_AREA, borderMode=cv2.BORDER_CONSTANT)
        comp = (warped.astype(np.float32) * a[..., None] + bg.astype(np.float32) * (1 - a[..., None])).astype(np.uint8)
        out_frames.append(comp); gt.append(a)
    return out_frames, gt
