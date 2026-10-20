/**
 * Per-word style schema + pure helpers (merge, CSS builders, keyword emphasis).
 *
 * A WordStyle is a *sparse* set of overrides. Layers are merged in this order (later wins):
 *   template look -> active-word look -> emphasis look -> the user's style for that exact word id.
 * User styles live in `project.wordStyles[wordId]` (separate from caption text/timing), keyed by stable word ids, so
 * they survive text corrections (ids are kept), splits, merges, regrouping, saves and reloads.
 */
import { z } from "zod";
import { graphemeCount } from "./captions/text";

const color = z.string().min(1).max(64);

export const gradientStopSchema = z.object({ color, pos: z.number().min(0).max(1) });
export const shineSchema = z.object({
  color: color.default("#ffffff"),
  /** band width as % of the text width */
  width: z.number().min(5).max(80).default(22),
  /** band speed in % of the text width per second (loops) */
  speed: z.number().min(-400).max(400).default(90),
  angle: z.number().min(-90).max(90).default(20),
  intensity: z.number().min(0).max(1).default(0.85),
});
export const gradientSchema = z.object({
  /** CSS angle: 180 = top to bottom, 90 = left to right */
  angle: z.number().min(-360).max(360).default(180),
  stops: z.array(gradientStopSchema).min(2).max(8),
  /** background size along the axis in % (>100 lets the gradient slide) */
  size: z.number().min(100).max(800).default(100),
  animate: z.enum(["none", "slide", "rotate", "hue"]).default("none"),
  /** slide: % per second; rotate / hue: degrees per second */
  speed: z.number().min(-720).max(720).default(0),
  shine: shineSchema.nullable().default(null),
});
export type Gradient = z.infer<typeof gradientSchema>;

export const shadowLayerSchema = z.object({ color, blur: z.number().min(0).max(80), x: z.number().min(-80).max(80), y: z.number().min(-80).max(80) });
export type ShadowLayer = z.infer<typeof shadowLayerSchema>;

export const glowSchema = z.object({
  color,
  blur: z.number().min(0).max(120),
  /** number of stacked halos, 0..3 (each is wider and softer) */
  strength: z.number().min(0).max(3),
  /** breathing: amount 0..1 at `hz` cycles per second */
  pulse: z.number().min(0).max(1).default(0),
  hz: z.number().min(0.1).max(8).default(1.2),
});
export type Glow = z.infer<typeof glowSchema>;

export const extrudeSchema = z.object({
  /** depth in px on a 1080 canvas */
  depth: z.number().min(0).max(80),
  color,
  /** direction of the extrusion in degrees (0 = right, 90 = down, 135 = down-left) */
  angle: z.number().min(-360).max(360).default(45),
  /** darken the layers with distance */
  fade: z.boolean().default(true),
});
export type Extrude = z.infer<typeof extrudeSchema>;

export const backgroundSchema = z.object({ color, radius: z.number().min(0).max(2).default(0.2), padX: z.number().min(0).max(1.5).default(0.25), padY: z.number().min(0).max(1).default(0.05) });
export const strokeSchema = z.object({ color, width: z.number().min(0).max(40) });

export const wordStyleSchema = z
  .object({
    // typography
    fontFamily: z.string().max(200),
    fontWeight: z.number().int().min(100).max(900),
    fontStyle: z.enum(["normal", "italic"]),
    /** size multiplier relative to the caption's font size */
    sizeScale: z.number().min(0.2).max(5),
    textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]),
    letterSpacing: z.number().min(-0.2).max(1.5),
    // paint
    color,
    opacity: z.number().min(0).max(1),
    stroke: strokeSchema,
    shadows: z.array(shadowLayerSchema).max(6),
    glow: glowSchema,
    extrude: extrudeSchema,
    background: backgroundSchema,
    gradient: gradientSchema,
    // geometry (static; animation presets move the word on top of these)
    rotate: z.number().min(-180).max(180),
    skewX: z.number().min(-60).max(60),
    skewY: z.number().min(-60).max(60),
    rotateX: z.number().min(-85).max(85),
    rotateY: z.number().min(-85).max(85),
    perspective: z.number().min(200).max(4000),
    /** offset from its natural position, as a fraction of the canvas' short side */
    dx: z.number().min(-1.5).max(1.5),
    dy: z.number().min(-1.5).max(1.5),
    /** take the word out of the line and place it at an absolute canvas position (fractions, centre anchored) */
    position: z.object({ x: z.number().min(-0.2).max(1.2), y: z.number().min(-0.2).max(1.2) }).nullable(),
    // motion
    animationId: z.string().max(60),
    enterMs: z.number().min(60).max(2500),
    delayMs: z.number().min(-800).max(2000),
    springStiffness: z.number().min(20).max(600),
    springDamping: z.number().min(2).max(60),
    easing: z.enum(["cubic", "expo", "sine", "back", "linear"]),
    /** entry blur in px that decays over `enterMs` (a motion-blur approximation) */
    blurInPx: z.number().min(0).max(60),
    /** force (true) or suppress (false) keyword emphasis for this word */
    emphasize: z.boolean(),
  })
  .partial();
export type WordStyle = z.infer<typeof wordStyleSchema>;

export const customFontSchema = z.object({
  id: z.string().min(6).max(40),
  /** CSS family name used in styles; letters, digits, spaces, hyphens only */
  family: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 \-]{0,40}$/),
  assetId: z.string(),
  weight: z.number().int().min(100).max(900).default(400),
  style: z.enum(["normal", "italic"]).default("normal"),
  /** The user confirmed they hold a licence that permits embedding this font in their videos. */
  licenseConfirmed: z.literal(true),
});
export type CustomFont = z.infer<typeof customFontSchema>;

/* ───────── merge ───────── */
export function mergeWordStyles(...layers: (WordStyle | undefined | null | false)[]): WordStyle {
  const out: Record<string, unknown> = {};
  for (const l of layers) {
    if (!l) continue;
    for (const [k, v] of Object.entries(l)) if (v !== undefined) out[k] = v;
  }
  return out as WordStyle;
}

export function isEmptyStyle(s: WordStyle | undefined): boolean {
  return !s || Object.values(s).every((v) => v === undefined);
}

/** Remove keys that are undefined or equal to the base value, so saved styles stay minimal. */
export function diffStyle(next: WordStyle, base: WordStyle = {}): WordStyle {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(next)) if (v !== undefined && JSON.stringify(v) !== JSON.stringify((base as Record<string, unknown>)[k])) out[k] = v;
  return out as WordStyle;
}

/* ───────── CSS builders (pure; unit-tested) ───────── */
const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function gradientCss(g: Gradient, tSec: number): { backgroundImage: string; backgroundSize: string; backgroundPosition: string } {
  let angle = g.angle;
  let pos = 0;
  let filter = "";
  if (g.animate === "rotate") angle += g.speed * tSec;
  if (g.animate === "slide") pos = (((g.speed * tSec) % g.size) + g.size) % g.size; // looping position
  void filter;
  const stops = [...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${(s.pos * 100).toFixed(1)}%`).join(", ");
  const layers: string[] = [];
  const sizes: string[] = [];
  const positions: string[] = [];
  if (g.shine) {
    const sh = g.shine;
    const rgb = hex.test(sh.color) ? sh.color : "#ffffff";
    const band = Math.max(2, sh.width);
    layers.push(`linear-gradient(${90 + sh.angle}deg, transparent 0%, transparent 38%, ${rgb} 50%, transparent 62%, transparent 100%)`);
    sizes.push(`${Math.round(100 + 10000 / band)}% 100%`);
    // loop the band across the word: -60% .. 160%
    const phase = (((sh.speed * tSec) % 220) + 220) % 220;
    positions.push(`${(phase - 60).toFixed(1)}% 0`);
  }
  layers.push(`linear-gradient(${angle}deg, ${stops})`);
  sizes.push(g.angle === 90 || g.angle === 270 ? `${g.size}% 100%` : `100% ${g.size}%`);
  positions.push(g.angle === 90 || g.angle === 270 ? `${pos}% 0` : `0 ${pos}%`);
  return { backgroundImage: layers.join(", "), backgroundSize: sizes.join(", "), backgroundPosition: positions.join(", ") };
}

/** Hue rotation (deg) applied as a CSS filter for `animate: "hue"` gradients. */
export function gradientHue(g: Gradient, tSec: number): number {
  return g.animate === "hue" ? (g.speed * tSec) % 360 : 0;
}

export function extrudeShadows(e: Extrude, scale: number, k = 1): string[] {
  const depth = Math.round(e.depth * scale * k);
  if (depth < 1) return [];
  const rad = (e.angle * Math.PI) / 180;
  const dx = Math.cos(rad), dy = Math.sin(rad);
  const out: string[] = [];
  const rgb = parseHex(e.color);
  for (let i = 1; i <= depth; i++) {
    const f = e.fade ? 1 - 0.45 * (i / depth) : 1;
    const c = rgb ? `rgb(${Math.round(rgb[0] * f)},${Math.round(rgb[1] * f)},${Math.round(rgb[2] * f)})` : e.color;
    out.push(`${(dx * i).toFixed(2)}px ${(dy * i).toFixed(2)}px 0 ${c}`);
  }
  return out;
}

export function glowShadows(g: Glow, scale: number, tSec: number, k = 1): string[] {
  if (g.strength <= 0) return [];
  const breath = g.pulse ? 1 + g.pulse * 0.5 * Math.sin(tSec * Math.PI * 2 * g.hz) : 1;
  const out: string[] = [];
  const layers = Math.ceil(g.strength);
  for (let i = 0; i < layers; i++) {
    const w = i + 1 === layers ? g.strength - i || 1 : 1;
    const blur = g.blur * scale * (0.35 + i * 0.9) * breath * k;
    out.push(`0 0 ${blur.toFixed(1)}px ${g.color}`);
    if (w >= 0.99 && i === 0) out.push(`0 0 ${(blur * 0.5).toFixed(1)}px ${g.color}`); // tight inner halo
  }
  return out;
}

export function shadowLayers(list: ShadowLayer[], scale: number, k = 1): string[] {
  return list.map((s) => `${(s.x * scale * k).toFixed(1)}px ${(s.y * scale * k).toFixed(1)}px ${(s.blur * scale * Math.max(0.4, k)).toFixed(1)}px ${s.color}`);
}

function parseHex(c: string): [number, number, number] | null {
  const m = c.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((x) => x + x).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function staticTransform(s: WordStyle, scale: number, shortSide: number): string {
  const parts: string[] = [];
  if (s.dx || s.dy) parts.push(`translate(${((s.dx ?? 0) * shortSide).toFixed(1)}px, ${((s.dy ?? 0) * shortSide).toFixed(1)}px)`);
  if (s.perspective && (s.rotateX || s.rotateY)) parts.push(`perspective(${s.perspective * scale}px)`);
  if (s.rotateX) parts.push(`rotateX(${s.rotateX}deg)`);
  if (s.rotateY) parts.push(`rotateY(${s.rotateY}deg)`);
  if (s.rotate) parts.push(`rotate(${s.rotate}deg)`);
  if (s.skewX || s.skewY) parts.push(`skew(${s.skewX ?? 0}deg, ${s.skewY ?? 0}deg)`);
  return parts.join(" ");
}

/* ───────── keyword emphasis ───────── */
const STOP = new Set("a an the and or but if so to of in on at for from by with as is are was were be been it its this that these those i you he she we they me my your our their not no do does did have has had will would can could should just very really then than too also into out up down over about".split(" "));

export interface EmphasisOptions { mode: "off" | "auto"; maxPerGroup: number; minLength: number }
export const DEFAULT_EMPHASIS: EmphasisOptions = { mode: "off", maxPerGroup: 1, minLength: 5 };

/**
 * Deterministic keyword picker (same input -> same output in preview and export).
 * Score: length, digits, capitalisation, not a stop word; ties broken by position (later words first, which is where
 * the point of a phrase usually lands). Words the user forced via `emphasize` always win.
 */
export function pickEmphasis(words: { id: string; text: string }[], opts: EmphasisOptions, forced: Record<string, boolean | undefined> = {}): Set<string> {
  const out = new Set<string>();
  for (const w of words) if (forced[w.id] === true) out.add(w.id);
  if (opts.mode !== "auto") return out;
  const scored = words
    .map((w, i) => {
      const bare = w.text.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
      const len = graphemeCount(bare);
      const stop = STOP.has(bare.toLowerCase());
      const score = (stop ? -10 : 0) + len + (/\d/.test(bare) ? 3 : 0) + (/^\p{Lu}/u.test(bare) && i > 0 ? 2 : 0) + i * 0.01;
      return { id: w.id, len, stop, score };
    })
    .filter((w) => forced[w.id] !== false && !w.stop && w.len >= opts.minLength)
    .sort((a, b) => b.score - a.score);
  const limit = words.length < 3 ? 0 : opts.maxPerGroup;
  let added = 0;
  for (const w of scored) {
    if (added >= limit) break;
    if (!out.has(w.id)) { out.add(w.id); added++; }
  }
  return out;
}

/**
 * Gap between words in em. The default 0.28 em, plus the horizontal reach of any extrusion on the caption look
 * (stacked-shadow depth is painted to the right of each glyph and visually eats the space: "IT BIG" read as "ITBIG").
 */
export function wordGapEm(style: { fontSize: number; wordGap?: number; look?: { extrude?: { depth: number; angle: number } } }): number {
  const ex = style.look?.extrude;
  const reach = ex ? (ex.depth * Math.max(0, Math.cos((ex.angle * Math.PI) / 180))) / Math.max(1, style.fontSize) : 0;
  return (style.wordGap ?? 0.28) + reach;
}

