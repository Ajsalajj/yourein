import test from "node:test";
import assert from "node:assert/strict";
import { layoutOnCircle, naturalSweepDeg } from "../src/lib/glyphpath";
import { buildShards, shardPose, shardsArea, shardClip } from "../src/lib/shatter";
import { sceneToScreen, canvasToSource } from "../src/lib/spatial";
import { videoRect } from "../src/lib/reframe";
import { textLayerSchema } from "../src/lib/project";

const W = [30, 22, 28, 28, 18, 30, 26, 24];

test("circular path: every glyph centre lies on the circle, angles advance by measured widths, rotation follows the tangent", () => {
  const R = 300;
  const g = layoutOnCircle(W, { radius: R, startDeg: -40, sweepDeg: 0, direction: "cw", inside: false });
  assert.equal(g.length, W.length);
  for (const p of g) assert.ok(Math.abs(Math.hypot(p.x, p.y) - R) < 1e-6);
  for (let i = 1; i < g.length; i++) {
    assert.ok(g[i].angleDeg > g[i - 1].angleDeg);
    const arc = ((g[i].angleDeg - g[i - 1].angleDeg) * Math.PI) / 180 * R;
    assert.ok(Math.abs(arc - (W[i] + W[i - 1]) / 2) < 1e-6, "neighbour distance = half-advance of both glyphs");
  }
  assert.ok(Math.abs(g[0].rotateDeg - g[0].angleDeg) < 1e-9, "outside text stands on the circle");
  // at 12 o'clock the glyph is upright and at the top; at 3 o'clock it is rotated 90 deg and on the right
  const q = layoutOnCircle([10], { radius: 100, startDeg: 0, sweepDeg: 0, direction: "cw", inside: false })[0];
  assert.ok(Math.abs(q.x - 100 * Math.sin(5 / 100)) < 1e-6 && q.y < -99);
});

test("circular path: fixed sweep justifies the glyphs over the sweep, ccw mirrors, inside flips the reading side", () => {
  const R = 250;
  const g = layoutOnCircle(W, { radius: R, startDeg: 0, sweepDeg: 180, direction: "cw", inside: false });
  const first = g[0].angleDeg - (W[0] / 2 / R) * (180 / Math.PI), last = g[g.length - 1].angleDeg + (W[W.length - 1] / 2 / R) * (180 / Math.PI);
  assert.ok(Math.abs(first - 0) < 1e-6 && Math.abs(last - 180) < 1e-6);
  const gaps = g.slice(1).map((p, i) => ((p.angleDeg - g[i].angleDeg) * Math.PI) / 180 * R - (W[i] + W[i + 1]) / 2);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1e-6, "equal extra gaps");
  const ccw = layoutOnCircle(W, { radius: R, startDeg: 0, sweepDeg: 180, direction: "ccw", inside: false });
  assert.ok(Math.abs(ccw[3].x + g[3].x) < 1e-6, "mirror image about the vertical axis");
  const inside = layoutOnCircle(W, { radius: R, startDeg: 0, sweepDeg: 0, direction: "cw", inside: true });
  assert.ok(Math.abs(inside[2].rotateDeg - (inside[2].angleDeg + 180)) < 1e-9);
  assert.ok(naturalSweepDeg(W, 100) > naturalSweepDeg(W, 400));
  assert.deepEqual(layoutOnCircle([], { radius: 10, startDeg: 0, sweepDeg: 0, direction: "cw", inside: false }), []);
});

test("shatter mesh: shards tile the text box exactly (no gaps or overlaps), deterministic per seed, different across seeds", () => {
  const box = { w: 640, h: 180 };
  const a = buildShards(box.w, box.h, 9, 4, 7);
  assert.equal(a.length, 9 * 4 * 2);
  assert.ok(Math.abs(shardsArea(a) - box.w * box.h) < 1e-6, "areas sum to the box area");
  assert.ok(a.every((s) => s.area > 1));
  const b = buildShards(box.w, box.h, 9, 4, 7), c = buildShards(box.w, box.h, 9, 4, 8);
  assert.deepEqual(a.map((s) => s.pts), b.map((s) => s.pts));
  assert.notDeepEqual(a.map((s) => s.pts), c.map((s) => s.pts));
  for (const s of a) for (const p of s.pts) assert.ok(p.x >= -1e-9 && p.x <= box.w + 1e-9 && p.y >= -1e-9 && p.y <= box.h + 1e-9, "vertices stay inside the box");
  assert.match(shardClip(a[0]), /^polygon\(([\d.]+px [\d.]+px(, )?){3}\)$/);
});

test("shard motion: intact at p=0, flies away from the impact point, falls, spins and fades out by p=1; deterministic", () => {
  const box = { w: 600, h: 160 };
  const shards = buildShards(box.w, box.h, 10, 4, 3);
  const prm = { spread: 0.8, impact: { x: 0.5, y: 0.5 }, seed: 3 };
  for (const s of shards) assert.deepEqual(shardPose(s, 0, box, prm), { tx: 0, ty: 0, rotate: 0, scale: 1, opacity: 1 });
  let outward = 0, gone = 0;
  for (const s of shards) {
    const p = shardPose(s, 0.7, box, prm), q = shardPose(s, 1, box, prm);
    const dx = s.cx - 0.5 * box.w;
    if (Math.abs(dx) > 40 && Math.sign(p.tx) === Math.sign(dx)) outward++;
    if (q.opacity <= 1e-9) gone++;
    assert.deepEqual(shardPose(s, 0.7, box, prm), p);
  }
  assert.ok(outward > shards.filter((s) => Math.abs(s.cx - 0.5 * box.w) > 40).length * 0.9, "shards move away from the impact");
  assert.equal(gone, shards.length);
  assert.ok(shards.reduce((a, s) => a + shardPose(s, 0.9, box, prm).ty, 0) > 0, "on average the pieces fall");
  assert.ok(shardPose(shards[5], 0.5, box, { ...prm, spread: 0.2 }).tx !== shardPose(shards[5], 0.5, box, { ...prm, spread: 1 }).tx);
});

test("scene-anchored text follows the camera: locked (parallax 1) tracks the picture, parallax 0 stays on screen, in between moves less", () => {
  const geo = { srcW: 1920, srcH: 1080, outW: 1080, outH: 1920 };
  const neutral = sceneToScreen({ px: 0.5, py: 0.4, geo, parallax: 1 });
  assert.ok(Math.abs(neutral.x - 0.5) < 1e-9 && neutral.scale === 1);
  // camera pans right and zooms in (face-aware camera)
  const rect = videoRect({ cx: 0.62, cy: 0.5, z: 1.6 }, geo);
  const locked = sceneToScreen({ px: 0.5, py: 0.4, geo, parallax: 1, rect });
  const half = sceneToScreen({ px: 0.5, py: 0.4, geo, parallax: 0.5, rect });
  const screen = sceneToScreen({ px: 0.5, py: 0.4, geo, parallax: 0, rect });
  assert.ok(Math.abs(locked.scale - 1.6) < 1e-9);
  assert.ok(locked.x < 0.5, "scene point moves left on screen when the camera pans right");
  assert.ok(Math.abs(screen.x - neutral.x) < 1e-9 && screen.scale === 1);
  assert.ok(Math.abs(half.x - (neutral.x + locked.x) / 2) < 1e-9 && Math.abs(half.scale - 1.3) < 1e-9);
  // the same point projected through the rectangle by hand
  assert.ok(Math.abs(locked.x - (rect.left + 0.5 * rect.width) / geo.outW) < 1e-9);
  // smart zoom without a camera rect: scale about the focus
  const z = sceneToScreen({ px: 0.5, py: 0.4, geo, parallax: 1, zoom: { scale: 1.5, fx: 0.2, fy: 0.3 } });
  assert.ok(Math.abs(z.x - (0.2 + (0.5 - 0.2) * 1.5)) < 1e-9 && Math.abs(z.scale - 1.5) < 1e-9);
});

test("text layer schema accepts the new fields and old layers still parse", () => {
  const old = { id: "t1", text: "x", startMs: 0, endMs: 1000, x: 0.5, y: 0.5, fontSize: 90, color: "#fff", fontFamily: "Poppins", fontWeight: 700 };
  const l = textLayerSchema.parse(old);
  assert.deepEqual([l.path, l.shatter, l.anchor, l.parallax], [null, null, "screen", 1]);
  const n = textLayerSchema.parse({ ...old, path: { radius: 0.3, startDeg: -90, sweepDeg: 180, direction: "cw", inside: false, spinDegPerSec: 20 }, shatter: { mode: "out", durationMs: 700, spread: 0.8, detail: "medium", seed: 4 }, anchor: "scene", parallax: 0.6 });
  assert.equal(n.path?.radius, 0.3);
  assert.equal(n.shatter?.mode, "out");
  assert.ok(!textLayerSchema.safeParse({ ...old, shatter: { mode: "boom" } }).success);
  assert.ok(!textLayerSchema.safeParse({ ...old, path: { radius: 9, startDeg: 0, sweepDeg: 0, direction: "cw", inside: false } }).success);
});

test("canvasToSource is the exact inverse of the cover mapping (switching a layer to scene anchoring keeps it where it was)", () => {
  for (const geo of [{ srcW: 1920, srcH: 1080, outW: 1080, outH: 1920 }, { srcW: 1080, srcH: 1920, outW: 1080, outH: 1080 }, { srcW: 1280, srcH: 720, outW: 1280, outH: 720 }]) {
    for (const [x, y] of [[0.5, 0.5], [0.2, 0.7], [0.9, 0.1]]) {
      const s = canvasToSource(x, y, geo);
      const back = sceneToScreen({ px: s.x, py: s.y, geo, parallax: 1 });
      assert.ok(Math.abs(back.x - x) < 1e-9 && Math.abs(back.y - y) < 1e-9);
    }
  }
});
