"""Matte pipeline tests: objective comparison against exact ground truth, plus controls (feather, grow/shrink, temporal)."""
import sys
from pathlib import Path
import cv2, numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.matte import MatteOpts, MatteRefiner  # noqa: E402
from app.vision import Segmenter, MODEL  # noqa: E402
import matte_gt  # noqa: E402

pytestmark = pytest.mark.skipif(not matte_gt.STILL.exists() or not MODEL.exists(), reason="sample image / model missing")
W, H = 270, 480


@pytest.fixture(scope="module")
def data():
    frames, gt = matte_gt.build(frames=30)
    fr = [cv2.resize(f, (W, H), interpolation=cv2.INTER_AREA) for f in frames]
    g = [cv2.resize(a, (W, H), interpolation=cv2.INTER_AREA) for a in gt]
    seg = Segmenter()
    raws = [seg.raw(f) for f in fr]
    return fr, g, raws


def run(data, opts):
    fr, _, raws = data
    r = MatteRefiner(opts)
    return [r.step(f, Segmenter.upsample(rw, W, H)) for f, rw in zip(fr, raws)]


def iou(a, b):
    a, b = a > 0.5, b > 0.5
    return (a & b).sum() / max(1, (a | b).sum())


def edge_f1(a, b, tol=2):
    ea, eb = cv2.Canny((a * 255).astype(np.uint8), 50, 150) > 0, cv2.Canny((b * 255).astype(np.uint8), 50, 150) > 0
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * tol + 1, 2 * tol + 1))
    da, db = cv2.dilate(ea.astype(np.uint8), k) > 0, cv2.dilate(eb.astype(np.uint8), k) > 0
    p, r = (ea & db).sum() / max(1, ea.sum()), (eb & da).sum() / max(1, eb.sum())
    return 2 * p * r / max(1e-9, p + r)


def temporal_error(m, g):
    e = []
    for i in range(1, len(m)):
        band = cv2.dilate((np.abs(g[i] - 0.5) < 0.49).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        e.append(np.abs((m[i] - m[i - 1]) - (g[i] - g[i - 1]))[band].mean())
    return float(np.mean(e))


def test_refined_pipeline_beats_legacy_on_exact_ground_truth(data):
    _, g, _ = data
    old, new = run(data, MatteOpts(legacy=True)), run(data, MatteOpts())
    m = lambda f, mm: float(np.mean([f(a, b) for a, b in zip(mm, g)]))
    print(f"IoU legacy {m(iou, old):.3f} new {m(iou, new):.3f} | edge F1 legacy {m(edge_f1, old):.3f} new {m(edge_f1, new):.3f} | temporal err legacy {temporal_error(old, g):.3f} new {temporal_error(new, g):.3f}")
    assert m(iou, new) >= m(iou, old) - 0.002
    assert m(edge_f1, new) >= m(edge_f1, old) + 0.04, "edges must align better with the real boundary"
    assert temporal_error(new, g) <= temporal_error(old, g)


def test_guided_filter_is_what_improves_edges(data):
    _, g, _ = data
    on, off = run(data, MatteOpts()), run(data, MatteOpts(guided=False))
    assert np.mean([edge_f1(a, b) for a, b in zip(on, g)]) > np.mean([edge_f1(a, b) for a, b in zip(off, g)]) + 0.02


def test_temporal_smoothing_reduces_flicker_on_a_static_scene(data):
    fr, _, raws = data
    rng = np.random.default_rng(3)
    noisy = [np.clip(raws[0] + rng.normal(0, 0.12, raws[0].shape).astype(np.float32), 0, 1) for _ in range(12)]  # same frame, noisy network output
    def flicker(opts):
        r = MatteRefiner(opts)
        out = [r.step(fr[0], Segmenter.upsample(n, W, H)) for n in noisy]
        return float(np.mean([np.abs(out[i] - out[i - 1]).mean() for i in range(3, len(out))]))
    assert flicker(MatteOpts(temporal=0.8)) < 0.7 * flicker(MatteOpts(temporal=0.0))


def test_feather_grow_and_shrink_do_what_they_say(data):
    area = lambda mm: float(np.mean([(a > 0.5).sum() for a in mm]))
    base = run(data, MatteOpts())
    grown, shrunk = run(data, MatteOpts(grow=3)), run(data, MatteOpts(grow=-3))
    assert area(grown) > area(base) * 1.01 and area(shrunk) < area(base) * 0.99
    # feather: wider soft edge = lower mean edge gradient, same area within a percent
    def grad(mm):
        return float(np.mean([np.abs(cv2.Sobel(a, cv2.CV_32F, 1, 0)).max() for a in mm]))
    soft, hard = run(data, MatteOpts(feather=5)), run(data, MatteOpts(feather=0))
    assert grad(soft) < 0.75 * grad(hard)
    assert abs(area(soft) - area(hard)) / area(hard) < 0.03
    assert all(0 <= a.min() and a.max() <= 1 for a in grown + shrunk + soft)


def test_options_are_clamped_and_serialisable():
    o = MatteOpts(temporal=5, feather=99, grow=-50).clean()
    assert (o.temporal, o.feather, o.grow) == (0.9, 12, -8)
    assert set(o.dict()) == {"guided", "temporal", "feather", "grow", "legacy"}
