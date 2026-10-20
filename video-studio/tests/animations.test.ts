import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BEHAVIORS, BEHAVIOR_MAP } from "../src/remotion/animations/behaviors";
import { makeSpring, hash, easeOutCubic, readableOn } from "../src/remotion/animations/helpers";
import { TEMPLATES, TEMPLATE_MAP, CATEGORIES, resolveStyle } from "../src/remotion/templates/registry";
import { stylePropsSchema } from "../src/lib/project";
import type { WordCtx } from "../src/remotion/animations/types";

const REQUIRED = ["word-pop", "smooth-scale", "elastic-bounce", "karaoke", "active-glow", "spring-motion", "slide-up", "slide-down", "blur-reveal", "fade-in", "typewriter", "char-stagger", "word-rotation", "smooth-tracking", "cinematic-serif", "minimal-editorial", "bold-creator", "neon-pulse", "gradient-highlight", "background-pill", "animated-underline", "highlight-sweep", "vertical-stack", "retro-subtitle", "comic-bounce", "soft-shadow-pop", "glitch-accent", "luxury-title", "kinetic-multi-line", "impact-caption"];

test("all 30 required animation types exist exactly once", () => {
  assert.equal(BEHAVIORS.length, 30);
  assert.deepEqual([...BEHAVIORS.map((b) => b.id)].sort(), [...REQUIRED].sort());
  assert.equal(new Set(BEHAVIORS.map((b) => b.id)).size, 30);
});

const FPS = 30;
function ctx(behaviorId: string, ms: number, over: Partial<WordCtx> = {}): WordCtx {
  const tpl = TEMPLATE_MAP[behaviorId] ?? TEMPLATES.find((t) => t.animationId === behaviorId)!;
  const style = { ...tpl.style };
  const frame = Math.round((ms * FPS) / 1000);
  const word = { id: "w", text: "Hello", startMs: 1000, endMs: 1400, confidence: 1, timingSource: "asr" as const, srcStartMs: 1000, srcEndMs: 1400 };
  const gStart = 800, gEnd = 3000;
  const m = (frame * 1000) / FPS;
  return {
    frame, fps: FPS, ms: m, style, scale: 1, dur: style.animationDurationMs, k: style.intensity,
    group: { startMs: gStart, endMs: gEnd, wordCount: 4 }, sinceGroup: m - gStart, untilGroupEnd: gEnd - m,
    enter: Math.min(1, Math.max(0, (m - gStart) / style.animationDurationMs)), exit: 0,
    spr: makeSpring(frame, FPS, style.animationDurationMs),
    word, index: 1, count: 4, sinceWord: m - 1000, untilWordEnd: 1400 - m, wordP: Math.min(1, Math.max(0, (m - 1000) / 400)),
    state: m < 1000 ? "future" : m < 1400 ? "active" : "past", revealed: m >= 1000, lineIndex: 0, indexInLine: 1, lineCount: 1,
    isCurrent: m >= 1000 && m < 1700, startedCount: m >= 1000 ? 2 : 1, currentStartMs: m >= 1000 ? 1000 : 800, emphasis: 0.6, ...over,
  };
}
const sig = (id: string, ms: number) => {
  const b = BEHAVIOR_MAP[id];
  const c = ctx(id, ms);
  const v = b.word?.(c) ?? {};
  const g = b.group?.({ ...c, lineCount: 1 }) ?? {};
  const ch = [0, 1, 2, 3, 4].map((i) => b.char?.(c, "H", i, 5) ?? {});
  return JSON.stringify({ v: { s: v.style, i: v.inner, f: v.fill, h: v.hidden }, g: g.style, ch }, (_k, val) => (typeof val === "object" && val && "$$typeof" in val ? "<node>" : val));
};

test("animation frames are deterministic: same frame -> identical output (no wall clock / Math.random)", () => {
  for (const b of BEHAVIORS) for (const ms of [0, 900, 1050, 1200, 1500, 2900]) assert.equal(sig(b.id, ms), sig(b.id, ms), `${b.id} @${ms}`);
});

test("source of the animation engine never reads wall-clock time or randomness", () => {
  const dir = path.resolve("src/remotion");
  const files: string[] = [];
  const walk = (d: string) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.tsx?$/.test(e.name) && files.push(path.join(d, e.name))));
  walk(dir);
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.ok(!/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setInterval|setTimeout/.test(src), `${path.basename(f)} uses a non-deterministic API`);
  }
});

test("each animation actually animates over time (not static)", () => {
  for (const b of BEHAVIORS) {
    const s = new Set([0, 850, 1000, 1030, 1100, 1250, 1600, 2500].map((ms) => sig(b.id, ms)));
    assert.ok(s.size >= 3, `${b.id} produced only ${s.size} distinct looks`);
  }
});

test("every animation behaves differently from every other (no colour-swap clones)", () => {
  const times = [850, 1000, 1030, 1100, 1250, 1600, 2500];
  const fingerprints = BEHAVIORS.map((b) => ({ id: b.id, fp: times.map((t) => sig(b.id, t)).join("|") }));
  const seen = new Map<string, string>();
  for (const f of fingerprints) {
    assert.ok(!seen.has(f.fp), `${f.id} behaves identically to ${seen.get(f.fp)}`);
    seen.set(f.fp, f.id);
  }
  // behaviours must also differ structurally in how they are built, not only in numbers
  const kinds = new Set(BEHAVIORS.map((b) => `${b.layout ?? "flow"}/${b.unit ?? "word"}/${b.group ? "g" : "-"}/${b.word ? "w" : "-"}/${b.char ? "c" : "-"}`));
  assert.ok(kinds.size >= 6, `only ${kinds.size} structural kinds`);
});

test("word pop: hidden before its word, then scales up with overshoot-free end state", () => {
  const before = BEHAVIOR_MAP["word-pop"].word!(ctx("word-pop", 900)).style!;
  assert.equal(before.opacity, 0);
  const after = BEHAVIOR_MAP["word-pop"].word!(ctx("word-pop", 1800)).style!;
  assert.equal(after.opacity, 1);
  assert.match(String(after.transform), /scale\(1(\.0+)?\)|scale\(1 /);
});

test("karaoke fill progress follows the spoken word", () => {
  const edge = (ms: number) => [...String(BEHAVIOR_MAP["karaoke"].word!(ctx("karaoke", ms)).fill!.backgroundImage).matchAll(/ (\d+(?:\.\d+)?)%, /g)][1][1];
  assert.equal(Number(edge(950)), 0);
  assert.ok(Number(edge(1200)) > 30 && Number(edge(1200)) < 70);
  assert.equal(Number(edge(1600)), 100);
});

test("typewriter reveals characters progressively", () => {
  const b = BEHAVIOR_MAP["typewriter"];
  const vis = (ms: number) => [0, 1, 2, 3, 4].filter((i) => b.char!(ctx("typewriter", ms), "x", i, 5).opacity === 1).length;
  assert.ok(vis(1005) < vis(1250) && vis(1250) <= vis(1500));
  assert.equal(vis(1500), 5);
});

test("spring is zero before start and settles near 1", () => {
  const sp = makeSpring(0, 30, 400);
  assert.equal(sp(-10), 0);
  assert.equal(sp(0), 0);
  assert.ok(Math.abs(sp(2000) - 1) < 0.01);
});

test("helpers", () => {
  assert.equal(hash(5), hash(5));
  assert.notEqual(hash(5), hash(6));
  assert.equal(easeOutCubic(1), 1);
  assert.equal(readableOn("#ffd60a"), "#0b0b0f");
  assert.equal(readableOn("#101030"), "#ffffff");
});

/* ───────── template registry ───────── */
test("template ids are unique and reference real animations", () => {
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert.ok(BEHAVIOR_MAP[t.animationId], `${t.id} -> ${t.animationId}`);
    assert.ok(t.name && t.description.length > 20, t.id);
    assert.ok((CATEGORIES as readonly string[]).includes(t.category));
    stylePropsSchema.parse(t.style);
  }
});

test("every one of the 30 animations is exposed by at least one template; every category has templates", () => {
  const used = new Set(TEMPLATES.map((t) => t.animationId));
  for (const id of REQUIRED) assert.ok(used.has(id), `animation ${id} has no template`);
  for (const c of CATEGORIES) assert.ok(TEMPLATES.filter((t) => t.category === c).length >= 2, `category ${c} needs >= 2 templates`);
});

test("template style resolution: project overrides apply, per-caption template ignores them", () => {
  const base = { templateId: "karaoke", overrides: { fontSize: 99 }, position: { x: 0.5, y: 0.7 } };
  assert.equal(resolveStyle(base, null).style.fontSize, 99);
  assert.equal(resolveStyle(base, "karaoke").style.fontSize, 99);
  assert.equal(resolveStyle(base, "word-pop").style.fontSize, TEMPLATE_MAP["word-pop"].style.fontSize);
});

test("Malayalam Reels templates default to a Malayalam font", () => {
  for (const t of TEMPLATES.filter((t) => t.category === "Malayalam Reels")) assert.match(t.style.fontFamily, /^"(Anek Malayalam|Noto Sans Malayalam)"/);
});

test("every font stack falls back to Malayalam, Devanagari and Tamil faces", () => {
  for (const t of TEMPLATES) for (const f of ["Noto Sans Malayalam", "Noto Sans Devanagari", "Noto Sans Tamil"]) assert.ok(t.style.fontFamily.includes(f), `${t.id} lacks ${f}`);
});
