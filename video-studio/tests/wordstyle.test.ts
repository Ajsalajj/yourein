import test from "node:test";
import assert from "node:assert/strict";
import * as ops from "../src/lib/captions/ops";
import { groupWords } from "../src/lib/captions/grouping";
import { mergeWordStyles, diffStyle, isEmptyStyle, gradientCss, gradientSchema, extrudeShadows, extrudeSchema, glowShadows, glowSchema, shadowLayers, pickEmphasis, wordStyleSchema, customFontSchema, staticTransform } from "../src/lib/wordstyle";
import { TEMPLATES } from "../src/remotion/templates/registry";
import { validateUpload } from "../src/lib/upload";
import type { Word, Caption } from "../src/lib/project";

const mk = (tokens: string[]): Word[] => ops.distributeWords(tokens, 0, tokens.length * 400, 0.9).map((w) => ({ ...w, timingSource: "asr" as const }));
const caps = (): Caption[] => groupWords(mk("this is a remarkable moment today".split(" ")), { wordsPerGroup: 6 });

test("merge: later layers win, undefined never overrides", () => {
  assert.deepEqual(mergeWordStyles({ color: "#fff", fontWeight: 400 }, { color: "#f00", fontWeight: undefined }, null, false), { color: "#f00", fontWeight: 400 });
  assert.ok(isEmptyStyle({}) && isEmptyStyle(undefined) && !isEmptyStyle({ italic: true }));
  assert.deepEqual(diffStyle({ color: "#fff", italic: true }, { color: "#fff" }), { italic: true });
});

test("word style schema rejects out-of-range and unknown-shape values", () => {
  assert.ok(wordStyleSchema.safeParse({ scale: 1.5, color: "#ff00aa", italic: true }).success);
  assert.ok(!wordStyleSchema.safeParse({ fontWeight: 5000 }).success);
});

test("gradient css: stops sorted, slide animates, rotate changes angle", () => {
  const g = gradientSchema.parse({ angle: 90, stops: [{ color: "#0000ff", pos: 1 }, { color: "#ff0000", pos: 0 }], size: 300, animate: "slide", speed: 100 });
  const a = gradientCss(g, 0), b = gradientCss(g, 0.5);
  assert.match(a.backgroundImage, /#ff0000 0\.0%.*#0000ff 100\.0%/);
  assert.notEqual(a.backgroundPosition, b.backgroundPosition);
  const r = gradientSchema.parse({ angle: 0, stops: [{ color: "#000", pos: 0 }, { color: "#fff", pos: 1 }], animate: "rotate", speed: 90 });
  assert.notEqual(gradientCss(r, 0).backgroundImage, gradientCss(r, 1).backgroundImage);
});

test("extrusion builds one stacked shadow per depth pixel along the angle; glow pulses", () => {
  const e = extrudeSchema.parse({ depth: 6, angle: 90, color: "#7c3aed" });
  const s = extrudeShadows(e, 1);
  assert.equal(s.length, 6);
  assert.match(s[0], /^0\.00px 1\.00px 0 /);
  assert.equal(extrudeShadows(e, 0).length, 0);
  const gl = glowSchema.parse({ color: "#0ff", strength: 2, blur: 20, pulse: 0.6, hz: 1 });
  assert.notEqual(glowShadows(gl, 1, 0).join(), glowShadows(gl, 1, 0.25).join());
  assert.equal(glowShadows({ ...gl, strength: 0 }, 1, 0).length, 0);
  assert.equal(shadowLayers([{ color: "#000", blur: 4, x: 2, y: 3 }], 2)[0], "4.0px 6.0px 8.0px #000");
});

test("static transform composes translate/perspective/rotate/skew", () => {
  const t = staticTransform({ dx: 0.1, rotateY: 20, perspective: 600, rotate: -3, skewX: -8 }, 1, 1000);
  assert.match(t, /translate\(100\.0px, 0\.0px\) perspective\(600px\) rotateY\(20deg\) rotate\(-3deg\) skew\(-8deg, 0deg\)/);
});

test("keyword emphasis is deterministic, skips stop words, honours forced ids", () => {
  const w = [{ id: "a", text: "this" }, { id: "b", text: "remarkable" }, { id: "c", text: "moment" }];
  const opts = { mode: "auto" as const, maxPerGroup: 1, minLength: 5 };
  assert.deepEqual([...pickEmphasis(w, opts)], ["b"]);
  assert.deepEqual([...pickEmphasis(w, opts)], [...pickEmphasis(w, opts)]);
  assert.deepEqual([...pickEmphasis(w, opts, { b: false })], ["c"]);
  assert.ok(pickEmphasis(w, { ...opts, mode: "off" }, { a: true }).has("a"));
});

test("word ids are stable across text correction, so per-word styles survive", () => {
  const c0 = caps();
  const id = c0[0].words[3].id; // "remarkable"
  const fixed = ops.editCaptionText(c0, c0[0].id, "this is a remarkable moment tonight");
  assert.equal(fixed[0].words[3].id, id);
  const renamed = ops.setWordText(c0, c0[0].id, id, "wonderful");
  assert.equal(renamed[0].words.find((w) => w.id === id)?.text, "wonderful");
  const [l, r] = ops.splitCaption(c0, c0[0].id, 3);
  assert.ok(r.words.some((w) => w.id === id) && !l.words.some((w) => w.id === id));
  const merged = ops.mergeWithNext(ops.splitCaption(c0, c0[0].id, 3), l.id);
  assert.ok(merged[0].words.some((w) => w.id === id));
});

test("custom font schema requires licence confirmation and a safe family name", () => {
  const ok = { id: "font_abcdef", family: "My Font", assetId: "a1", weight: 400, style: "normal", licenseConfirmed: true };
  assert.ok(customFontSchema.safeParse(ok).success);
  assert.ok(!customFontSchema.safeParse({ ...ok, licenseConfirmed: false }).success);
  assert.ok(!customFontSchema.safeParse({ ...ok, family: "x; } body{display:none" }).success);
});

test("font upload validation accepts font files only within size and extension", () => {
  assert.ok(validateUpload({ filename: "a.woff2", size: 1000, kind: "font" }).ok);
  assert.ok(!validateUpload({ filename: "a.exe", size: 1000, kind: "font" }).ok);
  assert.ok(!validateUpload({ filename: "a.ttf", size: 25_000_000, kind: "font" }).ok);
});

test("phase-2 template families are present, unique and each has a distinct animation+look fingerprint", () => {
  const WANT = ["kinetic-center", "kinetic-scatter", "neon-flicker", "punch", "color-lerp", "hop", "shadow-reveal", "flip", "stretch", "zoom-keyword", "float", "glow-flash", "cinematic-headline", "perspective-fly", "editorial-reveal", "depth-push", "extrude-sway", "bold-cut"];
  const used = new Set(TEMPLATES.map((t) => t.animationId));
  for (const id of WANT) assert.ok(used.has(id as never), `no template uses ${id}`);
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  const fp = TEMPLATES.map((t) => JSON.stringify([t.animationId, t.style.fontFamily, t.style.color, t.style.activeColor, t.style.stroke, t.style.shadow, t.style.look ?? null, t.style.activeLook ?? null]));
  assert.equal(new Set(fp).size, fp.length, "two templates are visually identical");
  assert.ok(TEMPLATES.length >= 73, `expected ≥73 templates, got ${TEMPLATES.length}`);
});
