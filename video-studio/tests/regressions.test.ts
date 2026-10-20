import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, TEMPLATE_MAP } from "../src/remotion/templates/registry";
import { BEHAVIOR_MAP } from "../src/remotion/animations/behaviors";
import { makeSpring, makeEase } from "../src/remotion/animations/helpers";
import { wordGapEm } from "../src/lib/wordstyle";
import type { WordCtx } from "../src/remotion/animations/types";

/** relative luminance of "#rrggbb" / "rgba(r,g,b,a)" (alpha ignored here, returned separately) */
function parse(c: string): { l: number; a: number } {
  let r = 0, g = 0, b = 0, a = 1;
  const rgba = c.match(/rgba?\(([^)]+)\)/);
  if (rgba) { const p = rgba[1].split(",").map((x) => parseFloat(x)); [r, g, b] = p; a = p[3] ?? 1; }
  else { let h = c.replace("#", ""); if (h.length === 3) h = h.split("").map((x) => x + x).join(""); const n = parseInt(h, 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
  const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return { l: 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b), a };
}

test("regression: every glowing (neon-style) template has a dark edge so it stays legible over bright footage", () => {
  const glowing = TEMPLATES.filter((t) => t.style.look?.glow);
  assert.ok(glowing.length >= 5);
  for (const t of glowing) {
    const l = t.style.look!;
    const darkStroke = l.stroke && parse(l.stroke.color).l < 0.05 && l.stroke.width >= 2;
    const darkShadow = (l.shadows ?? []).some((s) => { const p = parse(s.color); return p.l < 0.05 && p.a >= 0.5; });
    const darkExtrude = l.extrude && parse(l.extrude.color).l < 0.05 && l.extrude.depth >= 6;
    assert.ok(darkStroke || darkShadow || darkExtrude, `${t.id}: neon look needs a dark stroke or dark contact shadow`);
  }
  const cyan = TEMPLATE_MAP["neon-cyan-glow"].style.look!;
  assert.ok(cyan.stroke && cyan.stroke.width >= 3 && (cyan.shadows?.length ?? 0) >= 2, "neon cyan: stroke >=3 and two shadows");
});

test("regression: extruded looks reserve horizontal room so words never visually touch", () => {
  const purple = TEMPLATE_MAP["purple-3d-punch"].style;
  const ex = purple.look!.extrude!;
  const reachEm = (ex.depth * Math.cos((ex.angle * Math.PI) / 180)) / purple.fontSize;
  assert.ok(wordGapEm(purple) >= 0.28 + reachEm - 1e-9);
  assert.ok(wordGapEm(purple) - reachEm >= 0.28, "visible gap after extrusion must stay >= the 0.28 em default");
  // templates without extrusion keep the old spacing exactly
  assert.equal(wordGapEm(TEMPLATE_MAP["bold-white-kinetic"].style), 0.28);
  // an explicit wordGap overrides the base but extrusion is still added
  assert.ok(Math.abs(wordGapEm({ ...purple, wordGap: 0.5 }) - (0.5 + reachEm)) < 1e-9);
  for (const t of TEMPLATES) if (t.style.look?.extrude && Math.cos((t.style.look.extrude.angle * Math.PI) / 180) > 0.05) assert.ok(wordGapEm(t.style) > 0.28, `${t.id} extrusion must widen the gap`);
});

const FPS = 30;
function ctx(id: string, ms: number): WordCtx {
  const tpl = TEMPLATES.find((t) => t.animationId === id)!;
  const style = { ...tpl.style };
  const frame = Math.round((ms * FPS) / 1000);
  const word = { id: "w", text: "BIG", startMs: 1000, endMs: 1400, confidence: 1, timingSource: "asr" as const, srcStartMs: 1000, srcEndMs: 1400 };
  const m = (frame * 1000) / FPS;
  return {
    frame, fps: FPS, ms: m, style, scale: 1, dur: style.animationDurationMs, k: style.intensity,
    group: { startMs: 800, endMs: 3000, wordCount: 3 }, sinceGroup: m - 800, untilGroupEnd: 3000 - m, enter: 1, exit: 0, tSec: frame / FPS, look: {}, emphasized: false,
    spr: makeSpring(frame, FPS, style.animationDurationMs, { stiffness: style.springStiffness, damping: style.springDamping }), ease: makeEase(style.easing), sk: style.scaleIntensity ?? 1, exitMs: 200,
    word, index: 2, count: 3, sinceWord: m - 1000, untilWordEnd: 1400 - m, wordP: Math.min(1, Math.max(0, (m - 1000) / 400)), state: m < 1000 ? "future" : "active", revealed: m >= 1000,
    lineIndex: 0, indexInLine: 2, lineCount: 1, isCurrent: true, hlP: 1, geom: { rects: [0, 1, 2].map((i) => ({ x: i * 150, y: 0, w: 140, h: 70 })), width: 450, height: 70 }, startedCount: 3, currentStartMs: 1000, emphasis: 0.6,
  } as WordCtx;
}

test("regression: 3D Punch never enters larger than 1.5x, so an incoming word cannot swallow the previous word", () => {
  const b = BEHAVIOR_MAP["punch"];
  let maxScale = 0;
  for (let ms = 1000; ms <= 1800; ms += 33) {
    const t = b.word!(ctx("punch", ms)).style?.transform;
    const m = String(t).match(/scale\(([-0-9.]+)\)/);
    assert.ok(m, "punch must set a scale");
    maxScale = Math.max(maxScale, parseFloat(m![1]));
  }
  assert.ok(maxScale <= 1.5, `punch scale peaked at ${maxScale.toFixed(2)}`);
  assert.ok(maxScale > 1.05, "punch must still overshoot (it is a punch)");
});

import { captionMotionActive } from "../src/lib/composition";
test("motion-blur gating: the expensive multi-sample blur is off while captions are still and on while they move", () => {
  const caps = [{ id: "c", startMs: 1000, endMs: 3000, words: [{ id: "a", text: "x", startMs: 1000, endMs: 1400, confidence: 1, timingSource: "asr" as const, srcStartMs: 1000, srcEndMs: 1400 }, { id: "b", text: "y", startMs: 2000, endMs: 2400, confidence: 1, timingSource: "asr" as const, srcStartMs: 2000, srcEndMs: 2400 }], styleId: null, animationId: null, position: null, speakerId: null }];
  assert.equal(captionMotionActive(caps, 500), false, "before the caption");
  assert.equal(captionMotionActive(caps, 1300), true, "entering");
  assert.equal(captionMotionActive(caps, 1800), false, "settled between words");
  assert.equal(captionMotionActive(caps, 2200), true, "second word entering");
  assert.equal(captionMotionActive(caps, 3100), true, "leaving");
  assert.equal(captionMotionActive(caps, 4000), false, "gone");
});

import { behindContentActive } from "../src/lib/composition";
test("subject cut-out gating: only exists while something is drawn behind the subject", () => {
  const caps = [{ id: "c", startMs: 1000, endMs: 2000, words: [], styleId: null, animationId: null, position: null, speakerId: null }];
  const o = { behindLayers: [{ startMs: 5000, endMs: 6000 }], captionsBehind: true, captions: caps };
  assert.equal(behindContentActive(o, 500), false);
  assert.equal(behindContentActive(o, 1500), true, "behind-caption visible");
  assert.equal(behindContentActive(o, 2400), true, "caption animating out");
  assert.equal(behindContentActive(o, 3500), false, "gap between content");
  assert.equal(behindContentActive(o, 5500), true, "behind title");
  assert.equal(behindContentActive({ ...o, captionsBehind: false }, 1500), false, "captions in front need no cut-out");
  assert.equal(behindContentActive({ behindLayers: [], captionsBehind: false, captions: caps }, 5500), false);
});
