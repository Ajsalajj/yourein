import test from "node:test";
import assert from "node:assert/strict";
import { buildCameraPath, coverWindow, detectionsOf, faceAt, rejectOutliers, videoRect, projectPoint, type Geometry } from "../src/lib/reframe";
import { reframeSchema } from "../src/lib/edit-schema";
import type { Faces } from "../src/lib/project";

const LAND: Geometry = { srcW: 1920, srcH: 1080, outW: 1080, outH: 1920 }; // 16:9 source -> vertical output
const SAME: Geometry = { srcW: 1080, srcH: 1920, outW: 1080, outH: 1920 };
const settings = (o: Record<string, unknown> = {}) => reframeSchema.parse({ mode: "face", ...o });
function faces(fn: (t: number) => { x: number; y: number; h: number } | null, durationMs = 10000, fps = 10): Faces {
  const samples: Faces["samples"] = [];
  for (let t = 0; t <= durationMs; t += 1000 / fps) { const f = fn(t); samples.push(f ? [t, f.x - f.h * 0.4, f.y - f.h / 2, f.h * 0.8, f.h, 0.9] : [t]); }
  return { id: "f1", fps, width: 1280, height: 720, method: "t", sourceAssetId: "src", createdAt: "x", detected: samples.filter((s) => s.length === 6).length, total: samples.length, samples };
}
const face = (x: number, y = 0.4, h = 0.2) => ({ x, y, h });

test("cover window geometry: landscape->portrait crops width, same aspect crops nothing", () => {
  const w = coverWindow(LAND);
  assert.ok(Math.abs(w.h - 1) < 1e-9 && Math.abs(w.w - 1080 / (1920 / 1080 * 1080) / 1) < 0.35);
  assert.ok(Math.abs(w.w - 0.31640625) < 1e-6);
  assert.deepEqual(coverWindow(SAME), { w: 1, h: 1 });
});

test("fallback: mode off, or no detections, keeps the centre crop exactly", () => {
  for (const [f, r] of [[faces(() => face(0.8)), settings({ mode: "off" })], [null, settings()], [faces(() => null), settings()]] as const) {
    const p = buildCameraPath(f, LAND, r, 5000);
    assert.equal(p.hasFaces, false);
    for (const t of [0, 1234, 4999]) assert.deepEqual(p.at(t), { cx: 0.5, cy: 0.5, z: 1 });
  }
});

test("vertical reframing: a face at the left edge of a 16:9 source stays inside the 9:16 crop (the centre crop would cut it off)", () => {
  const p = buildCameraPath(faces(() => face(0.2)), LAND, settings(), 8000);
  const w = coverWindow(LAND).w;
  assert.ok(0.2 < 0.5 - w / 2, "centre crop excludes the face");
  for (let t = 2000; t <= 8000; t += 250) {
    const c = p.at(t), half = w / c.z / 2;
    assert.ok(Math.abs(c.cx - 0.2) < half * 0.35, `face off-centre at ${t}: cx=${c.cx.toFixed(3)}`);
  }
  assert.ok(p.at(8000).z >= 1);
});

test("following a moving face: always inside the central 70 % of the window once locked, and tighter tightness zooms in", () => {
  const f = faces((t) => face(0.25 + (0.5 * t) / 10000));
  const p = buildCameraPath(f, LAND, settings({ smoothMs: 500 }), 10000);
  const w = coverWindow(LAND).w;
  let worst = 0;
  for (let t = 1500; t <= 10000; t += 100) { const c = p.at(t), half = w / c.z / 2; worst = Math.max(worst, Math.abs(c.cx - (0.25 + (0.5 * t) / 10000)) / half); }
  assert.ok(worst < 0.7, `face reached ${(worst * 100).toFixed(0)} % of the half-window`);
  // look-ahead: at constant speed the steady-state lag must stay small (a plain damped follower trails by ~smoothTime x speed)
  const slow = buildCameraPath(f, LAND, settings({ smoothMs: 700 }), 10000);
  let lag = 0;
  for (let t = 4000; t <= 9500; t += 100) { const c = slow.at(t), half = w / c.z / 2; lag = Math.max(lag, Math.abs(c.cx - (0.25 + (0.5 * t) / 10000)) / half); }
  assert.ok(lag < 0.3, `steady-state lag ${(lag * 100).toFixed(0)} % of the half-window`);
  const loose = buildCameraPath(faces(() => face(0.5, 0.4, 0.12)), LAND, settings({ tightness: 0.2 }), 3000).at(3000).z;
  const tight = buildCameraPath(faces(() => face(0.5, 0.4, 0.12)), LAND, settings({ tightness: 0.5 }), 3000).at(3000).z;
  assert.ok(tight > loose + 0.3);
});

test("no sudden jumps: a face that teleports is followed at a bounded speed", () => {
  const f = faces((t) => (t < 4000 ? face(0.3) : face(0.75)), 9000);
  const p = buildCameraPath(f, LAND, settings(), 9000);
  const w = coverWindow(LAND).w;
  let maxSpeed = 0;
  for (let i = 1; i < p.samples.length; i++) {
    const a = p.samples[i - 1], b = p.samples[i];
    maxSpeed = Math.max(maxSpeed, (Math.abs(b.cam.cx - a.cam.cx) / ((b.t - a.t) / 1000)) / (w / b.cam.z));
  }
  assert.ok(maxSpeed <= 0.55, `camera moved ${maxSpeed.toFixed(2)} window-widths per second`);
  // and it did arrive
  assert.ok(Math.abs(p.at(9000).cx - 0.75) < 0.05);
  // acceleration is continuous too (no velocity steps larger than a small bound)
  let maxDv = 0;
  for (let i = 2; i < p.samples.length; i++) { const v1 = p.samples[i - 1].cam.cx - p.samples[i - 2].cam.cx, v2 = p.samples[i].cam.cx - p.samples[i - 1].cam.cx; maxDv = Math.max(maxDv, Math.abs(v2 - v1)); }
  assert.ok(maxDv < 0.002, `velocity step ${maxDv}`);
});

test("detection failures: outliers rejected, short gaps bridged, long gaps held then eased back to the centre", () => {
  const dets = detectionsOf(faces((t) => face(0.3 + t / 100000)));
  const glitched = dets.map((d) => ({ ...d }));
  glitched[40] = { ...glitched[40], cx: 0.95 };
  assert.equal(rejectOutliers(glitched).length, dets.length - 1);
  const pg = buildCameraPath({ ...faces(() => face(0.3)), samples: faces(() => face(0.3)).samples.map((s, i) => (i === 40 ? [s[0], 0.95, 0.4, 0.16, 0.2, 0.9] : s)) } as Faces, LAND, settings(), 10000);
  assert.ok(Math.abs(pg.at(4200).cx - pg.at(3500).cx) < 0.01, "single false detection does not move the camera");
  // bridge: 0.5 s gap interpolated
  const gap = detectionsOf(faces((t) => (t > 2000 && t < 2500 ? null : face(0.3 + t / 100000))));
  const mid = faceAt(gap, 2250)!;
  assert.ok(mid && mid.conf === 1 && Math.abs(mid.cx - 0.3225) < 0.01);
  // long gap: hold ~1.2 s, then confidence fades to 0 and the camera returns to the centre
  const longGap = faces((t) => (t < 2000 ? face(0.8) : null), 12000);
  const lp = buildCameraPath(longGap, LAND, settings(), 12000);
  assert.ok(lp.at(1900).cx > 0.7);
  assert.ok(lp.at(2800).cx > 0.6, "still holding shortly after the face vanished");
  assert.ok(Math.abs(lp.at(11000).cx - 0.5) < 0.03 && Math.abs(lp.at(11000).z - 1) < 0.05, "back to the fallback crop");
  // monotone drift back (no oscillation)
  let prev = lp.at(3000).cx;
  for (let t = 3200; t <= 9000; t += 200) { const c = lp.at(t).cx; assert.ok(c <= prev + 0.002, `overshoot at ${t}`); prev = c; }
});

test("manual overrides win and blend in/out smoothly", () => {
  const o = { id: "o1", startMs: 3000, endMs: 6000, x: 0.15, y: 0.5, scale: 1.8 };
  const p = buildCameraPath(faces(() => face(0.7)), LAND, settings({ overrides: [o] }), 9000);
  const w = coverWindow(LAND);
  const mid = p.at(4500);
  assert.ok(Math.abs(mid.z - 1.8) < 1e-6);
  assert.ok(Math.abs(mid.cx - Math.max(0.15, w.w / 1.8 / 2)) < 1e-6, "clamped inside the frame but at the override position");
  assert.ok(Math.abs(p.at(2000).cx - p.at(1990).cx) < 0.01 && Math.abs(p.at(7000).cx - 0.7) < 0.1);
  assert.ok(p.at(3100).cx < p.at(2900).cx && p.at(3100).cx > mid.cx - 1e-9 || p.at(3100).cx >= mid.cx, "eases toward the override");
});

test("the video rectangle always covers the output (no black bars) along the whole path, including extra zoom", () => {
  for (const g of [LAND, SAME, { srcW: 1280, srcH: 720, outW: 1080, outH: 1080 }]) {
    const p = buildCameraPath(faces((t) => face(0.15 + (0.7 * t) / 10000, 0.3 + 0.2 * Math.sin(t / 900))), g, settings({ tightness: 0.45 }), 10000);
    for (let t = 0; t <= 10000; t += 100) for (const extra of [1, 1.3]) {
      const r = videoRect(p.at(t), g, extra);
      assert.ok(r.left <= 0.5 && r.top <= 0.5 && r.left + r.width >= g.outW - 0.5 && r.top + r.height >= g.outH - 0.5, `bars at t=${t} ${JSON.stringify(r)}`);
    }
  }
});

test("projectPoint maps the tracked face near the target eye line of the output", () => {
  const p = buildCameraPath(faces(() => face(0.6, 0.35, 0.2)), LAND, settings(), 6000);
  const c = p.at(6000);
  const pt = projectPoint(0.6, 0.35, c, LAND);
  assert.ok(Math.abs(pt.x - LAND.outW / 2) < LAND.outW * 0.06, `face x at ${pt.x}`);
  assert.ok(pt.y > LAND.outH * 0.3 && pt.y < LAND.outH * 0.55, `face y at ${pt.y}`);
});
