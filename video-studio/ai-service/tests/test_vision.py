"""Segmentation and tracking against ground truth. Models: scripts/fetch_models.py must have been run."""
import subprocess
from pathlib import Path

import cv2
import numpy as np
import pytest

from app import vision

W, H, FPS, N = 540, 960, 30, 90


def _write_video(frames, path: Path):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-crf", "12", "-pix_fmt", "yuv420p", str(path)], stdin=subprocess.PIPE)
    for f in frames:
        p.stdin.write(f.tobytes())
    p.stdin.close(); p.wait()


@pytest.fixture(scope="module")
def moving_patch(tmp_path_factory):
    rng = np.random.default_rng(3)
    bg = cv2.GaussianBlur(rng.integers(0, 255, (H, W, 3), dtype=np.uint8), (0, 0), 2.5)
    bg = cv2.addWeighted(bg, 0.45, np.full_like(bg, 110), 0.55, 0)
    patch = cv2.GaussianBlur(rng.integers(0, 255, (120, 120, 3), dtype=np.uint8), (0, 0), 1.6)
    truth, frames = [], []
    for i in range(N):
        t = i / FPS
        cx, cy = W / 2 + 110 * np.sin(t * 1.7), H / 2 + 80 * np.cos(t * 1.1)
        s = 1.0 + 0.25 * np.sin(t * 1.3)
        size = int(round(120 * s))
        pr = cv2.resize(patch, (size, size), interpolation=cv2.INTER_LINEAR)
        f = bg.copy()
        x0, y0 = int(round(cx - size / 2)), int(round(cy - size / 2))
        f[y0:y0 + size, x0:x0 + size] = pr
        frames.append(f); truth.append((cx, cy, s))
    path = tmp_path_factory.mktemp("trk") / "patch.mp4"
    _write_video(frames, path)
    return path, truth


def test_tracker_follows_known_motion(moving_patch):
    path, truth = moving_patch
    cx, cy, s = truth[0]
    roi = {"x": (cx - 60) / W, "y": (cy - 60) / H, "w": 120 / W, "h": 120 / H}
    r = vision.track_region(path, roi, 0, FPS, lambda p, s: None)
    pts = np.array(r["points"])
    assert len(pts) >= N - 2
    gt = np.array([(x / W, y / H) for x, y, _ in truth])[: len(pts)]
    err_px = np.linalg.norm((pts[:, :2] - gt) * np.array([W, H]), axis=1)
    assert err_px.mean() < 4.0, f"mean position error {err_px.mean():.2f}px"
    assert err_px.max() < 12.0, f"max position error {err_px.max():.2f}px"
    sc = pts[:, 2]; gts = np.array([t[2] for t in truth])[: len(pts)]
    assert np.corrcoef(sc, gts)[0, 1] > 0.8, "scale estimate must follow the real scale change"
    assert abs(sc[-1] / sc[0] - gts[-1] / gts[0]) < 0.15


def test_tracker_rejects_textureless_region(tmp_path):
    flat = [np.full((H, W, 3), 128, np.uint8)] * 20
    p = tmp_path / "flat.mp4"
    _write_video(flat, p)
    with pytest.raises(RuntimeError, match="too little texture"):
        vision.track_region(p, {"x": 0.3, "y": 0.3, "w": 0.2, "h": 0.2}, 0, FPS, lambda a, b: None)


@pytest.fixture(scope="module")
def person_video(tmp_path_factory):
    from skimage import data
    im = cv2.cvtColor(data.astronaut(), cv2.COLOR_RGB2BGR)
    canvas = cv2.resize(im, (W, W))
    f = cv2.GaussianBlur(cv2.resize(im, (W, H)), (0, 0), 25)
    f[(H - W) // 2:(H - W) // 2 + W] = canvas
    p = tmp_path_factory.mktemp("seg") / "person.mp4"
    _write_video([f] * 20, p)
    return p, (H - W) // 2


def test_segmentation_cuts_out_the_person(person_video, tmp_path):
    path, y0 = person_video
    r = vision.segment_video(path, tmp_path, FPS, lambda p, s: None, longest=480)
    assert r["frames"] >= 18 and r["width"] * 2 == 270 * 2 or r["width"] > 0
    m = cv2.imread(str(tmp_path / "000010.png"), cv2.IMREAD_UNCHANGED)
    assert m.shape[2] == 4
    a = m[..., 3].astype(float) / 255
    h, w = a.shape
    sy = h / H; sx = w / W
    face = a[int((y0 + 95) * sy):int((y0 + 150) * sy), int(215 * sx):int(265 * sx)]   # her face
    suit = a[int((y0 + 330) * sy):int((y0 + 400) * sy), int(60 * sx):int(200 * sx)]     # orange suit
    blur_bg = a[int(20 * sy):int(120 * sy), int(10 * sx):int(w - 10)]                  # blurred area above the photo
    assert face.mean() > 0.9, f"face alpha {face.mean():.2f}"
    assert suit.mean() > 0.85, f"suit alpha {suit.mean():.2f}"
    assert blur_bg.mean() < 0.15, f"background alpha {blur_bg.mean():.2f}"


def test_segmentation_is_temporally_stable(person_video, tmp_path):
    path, _ = person_video
    vision.segment_video(path, tmp_path, FPS, lambda p, s: None, longest=480)
    a = [cv2.imread(str(tmp_path / f"{i:06d}.png"), cv2.IMREAD_UNCHANGED)[..., 3].astype(float) for i in (8, 9, 10)]
    assert np.abs(a[1] - a[0]).mean() < 2.0 and np.abs(a[2] - a[1]).mean() < 2.0, "matte flickers on a static shot"
