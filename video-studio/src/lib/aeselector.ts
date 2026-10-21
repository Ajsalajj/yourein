/**
 * After-Effects "range selector" model + the parameters DECODED from the user's Pro Presets .ffx files (scripts/dev/ffx_summary.py reads them).
 * Nothing here parses or embeds an .ffx at runtime: the numbers below were read once from the files and are documented in docs/AE_PRESET_ANALYSIS.md.
 *
 * Selector semantics (interpretation, consistent with how the presets behave): a selector region [start+offset, end+offset] (% of the text) moves with
 * Offset; unit i sits at its centre position p_i (optionally randomised by a seeded permutation). The shape gives the amount a unit receives:
 *   square   1 inside the region, 0 outside
 *   rampUp   0 left of the region, linear 0->1 across it, 1 to the right   (offset -100 -> +100 sweeps every unit from 1 to 0: an ENTRANCE)
 *   rampDown 1 left of the region, linear 1->0 across it, 0 to the right   (the same sweep takes every unit from 0 to 1: an EXIT)
 * An animator property then moves from its neutral value to its animator value by that amount (opacity 100 -> value, position += amount*value, ...).
 */
export type Shape = "square" | "rampUp" | "rampDown";
export type Units = "chars" | "words";

export interface Keys { /** [frame, value] pairs, linear between, held outside */ k: [number, number][] }
export const key = (...k: [number, number][]): Keys => ({ k });
export function evalKeys(v: number | Keys, frame: number): number {
  if (typeof v === "number") return v;
  const k = v.k;
  if (frame <= k[0][0]) return k[0][1];
  if (frame >= k[k.length - 1][0]) return k[k.length - 1][1];
  for (let i = 1; i < k.length; i++) if (frame <= k[i][0]) { const [f0, v0] = k[i - 1], [f1, v1] = k[i]; return v0 + ((v1 - v0) * (frame - f0)) / (f1 - f0); }
  return k[k.length - 1][1];
}

export interface Selector {
  units: Units;
  shape: Shape;
  /** percent, may be keyframed (frames from the preset start) */
  start: number | Keys;
  end: number | Keys;
  offset: number | Keys;
  /** 0..100: blends the shape's edges over this share of one unit */
  smoothness: number;
  randomize: boolean;
  seed: number | Keys;
  /** Ease High / Ease Low (%): softens the ramp at its two ends (approximated by blending the linear ramp with a smoothstep) */
  easeHigh: number;
  easeLow: number;
}

function mulberry(seed: number) {
  let a = (seed | 0) + 0x6d2b79f5;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Seeded permutation of 0..n-1 (Fisher-Yates). Different seeds give different orders; the same seed always the same. */
export function permutation(n: number, seed: number): number[] {
  const r = mulberry(Math.round(seed) * 7919 + n);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function shapeValue(shape: Shape, x: number): number {
  switch (shape) {
    case "square": return x >= 0 && x <= 1 ? 1 : 0;
    case "rampUp": return clamp01(x);
    case "rampDown": return 1 - clamp01(x);
  }
}

/** Amount (0..1) of every unit at `frame`. n = number of units (characters or words of the caption). */
export function selectorAmounts(sel: Selector, n: number, frame: number): number[] {
  if (n <= 0) return [];
  const start = evalKeys(sel.start, frame), end = evalKeys(sel.end, frame), offset = evalKeys(sel.offset, frame), seed = evalKeys(sel.seed, frame);
  const lo = start + offset, width = Math.max(1e-6, end - start);
  const empty = end - start < 1e-3; // an empty region selects nothing (letter flicker ends with start = end = 100)
  const perm = sel.randomize ? permutation(n, seed) : null;
  const unit = 100 / n;
  const soft = clamp01(sel.smoothness / 100);
  const ease = clamp01((sel.easeHigh + sel.easeLow) / 200);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const rank = perm ? perm[i] : i;
    const p = (rank + 0.5) * unit;
    // smoothness: average the shape over +-half a unit around the centre (3 taps) so neighbouring units blend instead of stepping
    const taps = soft > 0 ? [-0.5, 0, 0.5] : [0];
    let a = 0;
    for (const t of taps) a += shapeValue(sel.shape, (p + t * unit * soft - lo) / width);
    a = empty && sel.shape === "square" ? 0 : a / taps.length;
    a = a + ease * (smooth(a) - a);
    out.push(Math.min(1, Math.max(0, a)));
  }
  return out;
}

/* ───────── decoded presets ───────── */
export interface AeAnimator {
  selector: Selector;
  /** animator property values; opacity 0 = hidden at amount 1; y in px at 1080 px; blur in px; tracking in 1/1000 em */
  props: { opacity?: number; y?: number; blur?: number; tracking?: number };
  /** frame offset of this animator on the preset timeline */
  at?: number;
  /** exits: the sweep is anchored so it FINISHES when the caption ends (instead of starting at a fixed time) */
  anchorEnd?: boolean;
}
export interface AePreset {
  id: string;
  name: string;
  /** frame rate of the preset's own comp (frames in the keyframes are at this rate) */
  fps: number;
  animators: AeAnimator[];
  /** tracking applied to the whole text (frames) */
  trackingKeys?: Keys;
  /** total life of the preset in frames (from the first keyframe to the last) */
  lengthFrames: number;
  /** how it was obtained */
  source: "decoded" | "partly-decoded" | "not-decodable";
  notes: string;
}

const S = (o: Partial<Selector> & Pick<Selector, "units" | "shape">): Selector => ({ start: 0, end: 100, offset: 0, smoothness: 100, randomize: false, seed: 0, easeHigh: 0, easeLow: 0, ...o });

export const AE_PRESETS: Record<string, AePreset> = {
  "word-blink": {
    id: "word-blink", name: "Word Blink", fps: 24, lengthFrames: 14, source: "decoded",
    animators: [{ selector: S({ units: "words", shape: "rampUp", offset: key([0, -100], [14, 100]), randomize: true, seed: key([0, 0], [14, 145]), easeHigh: 15, easeLow: 57 }), props: { opacity: 0 } }],
    notes: "Words, ramp up, randomised order with a seed that runs 0->145 over the 14 frames (the order reshuffles every frame = the blink), offset -100->+100, opacity animator 0.",
  },
  "alphabet-blink": {
    id: "alphabet-blink", name: "Alphabet Blink", fps: 24, lengthFrames: 14, source: "decoded",
    animators: [{ selector: S({ units: "chars", shape: "rampUp", offset: key([0, -100], [14, 100]), randomize: true, seed: key([0, 0], [12, 32]) }), props: { opacity: 0 } }],
    notes: "Characters, ramp up, randomised, seed 0->32 over 12 frames, offset -100->+100 over 14 frames, opacity 0.",
  },
  "bottom-up-blurred": {
    id: "bottom-up-blurred", name: "Bottom to Up Blurred", fps: 24, lengthFrames: 42, source: "decoded",
    animators: [{ selector: S({ units: "words", shape: "rampUp", offset: key([0, -100], [42, 100]), easeHigh: 32, easeLow: 100 }), props: { opacity: 0, y: 57, blur: 59 } }],
    notes: "Words, ramp up, offset -100->+100 over 42 frames; animator: position y +57, opacity 0, blur 59; ease high 32 / low 100.",
  },
  "smooth-fade-in-out": {
    id: "smooth-fade-in-out", name: "Smooth Fade In & Out", fps: 30, lengthFrames: 94, source: "decoded",
    animators: [
      { selector: S({ units: "chars", shape: "rampUp", offset: key([0, -100], [57.987, 100]), easeHigh: 100 }), props: { opacity: 0 } },
      { at: 31.129, anchorEnd: true, selector: S({ units: "chars", shape: "rampDown", offset: key([0, -100], [60.429, 100]), easeHigh: 100 }), props: { opacity: 0 } },
    ],
    trackingKeys: key([0, 0], [94, 5]),
    notes: "Characters fade in with a ramp-up sweep over 58 frames and out with a ramp-down sweep starting at frame 31 (60 frames); tracking drifts 0->5 over 94 frames.",
  },
  "fade-up-out-smooth": {
    id: "fade-up-out-smooth", name: "Fade Up & Out Smooth", fps: 30, lengthFrames: 71, source: "partly-decoded",
    animators: [
      { at: 3, selector: S({ units: "words", shape: "square", start: key([0, 0], [37, 100]), smoothness: 100 }), props: { opacity: 0 } },
      { at: 30, anchorEnd: true, selector: S({ units: "chars", shape: "rampDown", offset: key([0, -100], [37, 100]) }), props: { opacity: 0 } },
    ],
    trackingKeys: key([0, 0], [71, 7]),
    notes: "Words are uncovered left to right (square selector, start 0->100 over 37 frames), characters fade out with a ramp-down sweep (37 frames); tracking drifts 0->7. A third animator (opacity 100) carries no motion; no position animator was found, so the 'up' is only what the tracking/selectors give.",
  },
  "letter-flicker": {
    id: "letter-flicker", name: "Letter Flicker", fps: 30, lengthFrames: 35, source: "decoded",
    animators: [{ selector: S({ units: "chars", shape: "square", start: key([0, 0], [35, 100]), randomize: true, seed: key([0, 0], [35, 172]), easeHigh: 56 }), props: { opacity: 0 } }],
    notes: "Characters, square selector whose START runs 0->100 over 35 frames (letters leave the selection one by one), randomised with seed 0->172 (reshuffles every frame = flicker), opacity 0.",
  },
};

/** Frame at which the last keyframe of the animator's moving parameter sits (the length of its sweep). */
export function sweepFrames(a: AeAnimator): number {
  for (const v of [a.selector.offset, a.selector.start, a.selector.end]) if (typeof v === "object") return v.k[v.k.length - 1][0];
  return 0;
}

/**
 * Amounts of every unit for animator `ai` at `ms` after the preset started; `msToEnd` (ms until the caption ends) anchors exits.
 * A preset is authored for `lengthFrames`; a caption group shorter than that plays the whole preset time-compressed so the
 * entrance and exit sweeps never overlap into a permanently faint caption.
 */
export function presetAmounts(p: AePreset, ai: number, n: number, ms: number, msToEnd?: number): number[] {
  const a = p.animators[ai];
  const presetMs = (p.lengthFrames / p.fps) * 1000;
  const groupMs = msToEnd !== undefined ? ms + msToEnd : presetMs;
  const rate = Math.max(1, presetMs / Math.max(1, groupMs));
  const fps = p.fps * rate;
  const f = a.anchorEnd && msToEnd !== undefined ? sweepFrames(a) - (msToEnd * fps) / 1000 : (ms * fps) / 1000 - (a.at ?? 0);
  return selectorAmounts(a.selector, n, f);
}

/** Combined opacity (0..1) of unit i from all animators that set opacity */
export function opacityOf(p: AePreset, amounts: number[][], i: number): number {
  let o = 1;
  p.animators.forEach((a, k) => { if (a.props.opacity !== undefined) o *= 1 + amounts[k][i] * (a.props.opacity / 100 - 1); });
  return Math.min(1, Math.max(0, o));
}
