import test from "node:test";
import assert from "node:assert/strict";
import { TRANSITIONS, TRANSITION_TYPES, transitionFx, placeTransitions, windowProgress, layerCss, type LayerFx } from "../src/lib/transitions";
import { transitionSchema } from "../src/lib/edit-schema";
import { demoProject, segsOf } from "./helpers";

const visible = (l: LayerFx, flash = 0) => l.opacity > 0.02 && l.brightness > 0.02 && Math.abs(l.tx) < 1 && Math.abs(l.ty) < 1 && !(l.reveal && l.reveal.r < 0.01) && flash < 1;
const isIdentity = (l: LayerFx) => Math.abs(l.tx) < 1e-6 && Math.abs(l.ty) < 1e-6 && Math.abs(l.scale - 1) < 1e-6 && Math.abs(l.opacity - 1) < 1e-6 && l.blurX < 1e-6 && l.blurY < 1e-6 && l.zoomBlur < 1e-6 && Math.abs(l.brightness - 1) < 1e-6 && !l.reveal;

test("all ten requested transitions exist exactly once and have descriptions", () => {
  assert.deepEqual([...TRANSITION_TYPES].sort(), ["camera-push", "cinematic-fade", "directional-blur", "flash", "mask-reveal", "motion-blur", "radial-zoom-blur", "slide", "smooth-zoom", "whip-pan"]);
  assert.equal(TRANSITIONS.length, 10);
  assert.ok(TRANSITIONS.every((t) => t.description.length > 20));
});

for (const type of TRANSITION_TYPES) {
  for (const dir of ["left", "right", "up", "down"] as const) {
    test(`${type}/${dir}: starts as the outgoing shot, ends as the incoming shot, never reveals nothing in between`, () => {
      const s = transitionFx(type, 0, dir, 0.8), e = transitionFx(type, 1, dir, 0.8);
      assert.ok(isIdentity(s.a), "p=0: A untouched");
      assert.ok(isIdentity(e.b), "p=1: B untouched");
      assert.ok(!visible(s.b), "p=0: B hidden");
      assert.ok(!visible(e.a) || type === "mask-reveal" /* A is covered by the fully revealed B */, "p=1: A hidden (or covered by the mask)");
      assert.equal(s.flash, 0); assert.ok(e.flash < 0.01);
      // continuity: no jumps larger than a threshold between neighbouring samples (smooth for a 12-frame window)
      let prev = transitionFx(type, 0, dir, 0.8);
      for (let i = 1; i <= 60; i++) {
        const cur = transitionFx(type, i / 60, dir, 0.8);
        for (const w of ["a", "b"] as const) {
          assert.ok(Math.abs(cur[w].tx - prev[w].tx) < 0.2 && Math.abs(cur[w].ty - prev[w].ty) < 0.2, `${type} translate jump`);
          assert.ok(Math.abs(cur[w].scale - prev[w].scale) < 0.25, `${type} scale jump`);
        }
        // something of the program is always on screen: A or B visible, or a flash/dip is in progress
        const mid = visible(cur.a) || visible(cur.b) || cur.flash > 0.3 || type === "cinematic-fade";
        assert.ok(mid, `${type} p=${i / 60} shows nothing`);
        prev = cur;
      }
    });
  }
}

test("blur transitions really blur; non-blur ones never do", () => {
  for (const t of TRANSITIONS) {
    let maxBlur = 0, maxZoom = 0;
    for (let i = 0; i <= 40; i++) { const f = transitionFx(t.id, i / 40, "left", 0.9); maxBlur = Math.max(maxBlur, f.a.blurX, f.a.blurY, f.b.blurX, f.b.blurY); maxZoom = Math.max(maxZoom, f.a.zoomBlur, f.b.zoomBlur); }
    if (t.blurs) assert.ok(maxBlur > 0.05 || maxZoom > 0.5, `${t.id} should blur`);
    else assert.ok(maxBlur === 0 && maxZoom === 0, `${t.id} should not blur`);
  }
  // direction: horizontal types blur on X, vertical on Y
  const h = transitionFx("directional-blur", 0.5, "right", 1), v = transitionFx("directional-blur", 0.5, "down", 1);
  assert.ok(h.a.blurX > 0 && h.a.blurY === 0 && v.a.blurY > 0 && v.a.blurX === 0);
  // radial is symmetric around the cut: strongest in the middle
  assert.ok(transitionFx("radial-zoom-blur", 0.5).a.zoomBlur > transitionFx("radial-zoom-blur", 0.1).a.zoomBlur);
});

test("each transition produces a distinct look (mid-point parameter fingerprints differ)", () => {
  const fp = TRANSITIONS.map((t) => JSON.stringify(transitionFx(t.id, 0.5, "left", 0.7), (_k, v) => (typeof v === "number" ? Math.round(v * 1000) / 1000 : v)));
  assert.equal(new Set(fp).size, 10);
});

test("flash peaks at the cut and the cut happens behind it", () => {
  const f = transitionFx("flash", 0.5, "left", 1);
  assert.ok(f.flash > 0.9);
  assert.ok(transitionFx("flash", 0.3, "left", 1).b.opacity === 0 && transitionFx("flash", 0.7, "left", 1).a.opacity === 0);
});

test("layerCss builds transform, directional-blur filter and reveal mask", () => {
  const fx = transitionFx("whip-pan", 0.3, "left", 1).a;
  const css = layerCss(fx, 1080, 1920, "fx1") as Record<string, string>;
  assert.match(css.transform, /translate\(-/);
  assert.match(css.filter, /url\(#fx1\)/);
  const m = layerCss(transitionFx("mask-reveal", 0.5).b, 1080, 1920) as Record<string, string>;
  assert.match(m.maskImage, /radial-gradient\(circle at 50% 50%, #000 [\d.]+px, transparent [\d.]+px\)/);
});

test("placement: transitions snap to the nearest real join, windows are even, clamped to the neighbouring clips and never overlap", () => {
  const p = demoProject(undefined, { cuts: [[3000, 4000], [4200, 9000]] }); // segments: 0-3000, 4000-4200 (200 ms!), 9000-20000
  const segs = segsOf(p);
  assert.equal(segs.length, 3);
  const mk = (join: number, ms = 800) => transitionSchema.parse({ id: `t${join}`, type: "slide", joinSrcMs: join, durationMs: ms });
  const placed = placeTransitions([mk(3050), mk(4200)], segs, 30);
  assert.equal(placed.length, 2);
  const [a, b] = placed;
  assert.equal(a.joinFrame, segs[1].outStartFrame);
  assert.ok(a.frames % 2 === 0 && b.frames % 2 === 0);
  // the 200 ms (6 frame) middle clip limits both neighbouring windows to <= 3 frames per side
  assert.ok(a.frames / 2 <= Math.floor(segs[1].frames / 2));
  assert.ok(b.frames / 2 <= Math.floor(segs[1].frames / 2));
  assert.ok(a.startFrame + a.frames <= b.startFrame, "windows do not overlap");
  // source continuation: A continues past its end, B starts before its start
  assert.equal(a.aStartSrcFrame, segs[0].srcStartFrame + (a.startFrame - segs[0].outStartFrame));
  assert.ok(a.bStartSrcFrame < segs[1].srcStartFrame);
  // a transition far from any join is ignored; one join can hold one transition
  assert.equal(placeTransitions([mk(12000)], segs, 30).length, 0);
  assert.equal(placeTransitions([mk(3000), mk(3100)], segs, 30).length, 1, "the second one has no join left within 400 ms");
});

test("window progress stays strictly inside (0,1) and is monotonic", () => {
  const F = 12; let prev = 0;
  for (let k = 0; k < F; k++) { const p = windowProgress(k, F); assert.ok(p > 0 && p < 1 && p > prev); prev = p; }
});
