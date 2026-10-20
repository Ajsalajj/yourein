"""Face detection/tracking tests on synthetic footage with KNOWN motion (the real photo is pasted at known offsets)."""
import subprocess, sys
from pathlib import Path
import cv2, numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import faces  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
STILL = ROOT / "data" / "samples" / "person_still.png"
pytestmark = pytest.mark.skipif(not STILL.exists() or not faces.MODEL.exists(), reason="sample image / model missing")


def photo_face():
    img = cv2.imread(str(STILL))
    d = faces.FaceDetector()
    f = d.scan(img)
    assert f, "no face found on the reference photo"
    return img, f[0]


def make_video(path: Path, offsets, blank=(), W=1280, H=720, fps=10, scale=0.55):
    """Landscape canvas; the portrait photo scaled by `scale` is pasted with its centre at per-frame (x, y) offsets. Returns ground-truth face centres."""
    img, f = photo_face()
    p = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ph, pw = p.shape[:2]
    fc = ((f["x"] + f["w"] / 2) * pw, (f["y"] + f["h"] / 2) * ph)
    wr = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "12", str(path)], stdin=subprocess.PIPE)
    truth = []
    for i, (cx, cy) in enumerate(offsets):
        canvas = np.full((H, W, 3), (90, 70, 60), np.uint8)
        if i not in blank:
            x0, y0 = int(cx - pw / 2), int(cy - ph / 2)
            xs, ys = max(0, x0), max(0, y0)
            xe, ye = min(W, x0 + pw), min(H, y0 + ph)
            canvas[ys:ye, xs:xe] = p[ys - y0:ye - y0, xs - x0:xe - x0]
            truth.append(((x0 + fc[0]) / W, (y0 + fc[1]) / H))
        else:
            truth.append(None)
        wr.stdin.write(canvas.tobytes())
    wr.stdin.close(); wr.wait()
    return truth


def test_detector_finds_the_photo_face_with_sensible_box():
    img, f = photo_face()
    # the face box is roughly square in pixels and sits in the upper part of the portrait
    px_w, px_h = f["w"] * img.shape[1], f["h"] * img.shape[0]
    assert 0.7 < px_w / px_h < 1.4
    assert f["y"] < 0.5 and f["score"] > 0.8


def test_no_face_in_a_plain_frame():
    d = faces.FaceDetector()
    assert d.scan(np.full((720, 1280, 3), 120, np.uint8)) == []
    noise = np.random.default_rng(1).integers(0, 255, (720, 1280, 3), dtype=np.uint8)
    assert [f for f in d.scan(noise) if f["score"] > 0.8] == []


def test_tracking_follows_known_motion_and_reports_gaps(tmp_path):
    n = 40
    xs = np.linspace(380, 900, n)
    ys = 360 + 40 * np.sin(np.linspace(0, 3, n))
    offsets = list(zip(xs, ys))
    blank = set(range(18, 24))  # the face disappears for 0.6 s
    vid = tmp_path / "moving.mp4"
    truth = make_video(vid, offsets, blank)
    res = faces.analyse_faces(vid, lambda p, s: None, sample_fps=10)
    assert res["total"] >= n - 1
    errs, missed_inside_blank, missed_outside = [], 0, 0
    for i, s in enumerate(res["samples"][:n]):
        if truth[i] is None:
            missed_inside_blank += 1 if s["primary"] is None else 0
            continue
        if s["primary"] is None:
            missed_outside += 1
            continue
        c = (s["primary"]["x"] + s["primary"]["w"] / 2, s["primary"]["y"] + s["primary"]["h"] / 2)
        errs.append(float(np.hypot(c[0] - truth[i][0], c[1] - truth[i][1])))
    assert missed_outside <= 2, f"lost the face on {missed_outside} frames that had one"
    assert np.median(errs) < 0.02 and max(errs) < 0.06, f"centre error median {np.median(errs):.3f} max {max(errs):.3f}"
    assert missed_inside_blank >= 5, "frames without a face must be reported as gaps, not invented"
    # the track follows the horizontal sweep monotonically (allowing for detector jitter)
    cx = [s["primary"]["x"] + s["primary"]["w"] / 2 for s in res["samples"][:18] if s["primary"]]
    assert cx[-1] - cx[0] > 0.15


def test_two_faces_keeps_following_the_same_subject(tmp_path):
    img, f = photo_face()
    p = cv2.resize(img, None, fx=0.45, fy=0.45, interpolation=cv2.INTER_AREA)
    ph, pw = p.shape[:2]
    W, H = 1280, 720
    wr = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", "10", "-i", "-", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "12", str(tmp_path / "two.mp4")], stdin=subprocess.PIPE)
    for i in range(30):
        c = np.full((H, W, 3), (80, 80, 80), np.uint8)
        xa = 200 + i * 6   # subject A drifts right
        c[100:100 + ph, xa:xa + pw] = p[: min(ph, H - 100), : pw]
        xb = 800           # subject B stays put (similar size)
        c[100:100 + ph, xb:xb + pw] = p[: min(ph, H - 100), : pw]
        wr.stdin.write(c.tobytes())
    wr.stdin.close(); wr.wait()
    res = faces.analyse_faces(tmp_path / "two.mp4", lambda p_, s: None, sample_fps=10)
    xs = [s["primary"]["x"] + s["primary"]["w"] / 2 for s in res["samples"] if s["primary"]]
    assert len(xs) >= 27
    # whichever face was chosen first it must not jump between the two (separation ~0.45 of the frame width)
    jumps = [abs(a - b) for a, b in zip(xs, xs[1:])]
    assert max(jumps) < 0.1, f"primary jumped {max(jumps):.2f}"
