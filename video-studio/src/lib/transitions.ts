/**
 * Cinematic transitions between two real video layers.
 * `transitionFx` is pure: given progress p (0..1) it returns, for the outgoing layer A and the incoming layer B,
 * the numeric parameters the compositor needs (translate, scale, opacity, directional blur length, radial-zoom-blur strength, reveal mask).
 * The same numbers drive the CSS/SVG path and the canvas path, so preview and export agree, and tests can check continuity.
 */
import { TRANSITION_TYPES, type TransitionSpec, type TransitionType } from "./edit-schema";
import type { Segment } from "./timeline";

export { TRANSITION_TYPES };
export type { TransitionType };

export interface TransitionInfo { id: TransitionType; name: string; blurs: boolean; description: string }
export const TRANSITIONS: TransitionInfo[] = [
  { id: "smooth-zoom", name: "Smooth zoom", blurs: false, description: "Push into the outgoing shot while the next one settles from slightly zoomed-in." },
  { id: "radial-zoom-blur", name: "Radial zoom blur", blurs: true, description: "True radial blur (multi-sample scaled copies of the real frame) as the shot punches through to the next." },
  { id: "directional-blur", name: "Directional blur", blurs: true, description: "Gaussian blur along one axis (SVG filter) while the shots cross-dissolve." },
  { id: "whip-pan", name: "Whip pan", blurs: true, description: "Both shots whip sideways with heavy streak blur, no dissolve." },
  { id: "motion-blur", name: "Motion blur slide", blurs: true, description: "A shorter push of both shots with blur proportional to their speed." },
  { id: "camera-push", name: "Camera push", blurs: false, description: "Dolly through the outgoing shot, emerging into the next from a slight push-in." },
  { id: "flash", name: "Flash", blurs: false, description: "Cut hidden behind a white exposure flash." },
  { id: "mask-reveal", name: "Mask reveal", blurs: false, description: "The next shot is revealed through a soft expanding circular mask." },
  { id: "slide", name: "Slide", blurs: false, description: "The next shot pushes the previous one off screen." },
  { id: "cinematic-fade", name: "Cinematic fade", blurs: false, description: "Dip through black with a slow drift and filmic ease." },
];

export interface LayerFx {
  opacity: number;
  /** translation as a fraction of the frame width / height */
  tx: number;
  ty: number;
  scale: number;
  /** directional blur length in fractions of the frame (x, y); 0 = none */
  blurX: number;
  blurY: number;
  /** radial zoom blur strength 0..1 (centre = frame centre) */
  zoomBlur: number;
  /** 0..1 brightness multiplier (cinematic fade dips to black through this) */
  brightness: number;
  /** soft circular reveal: radius as a fraction of the frame diagonal; null = no mask */
  reveal: { r: number; feather: number } | null;
}
export interface TransitionFx { a: LayerFx; b: LayerFx; /** white overlay 0..1 */ flash: number; /** B above A? */ bOnTop: boolean }

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => { const x = clamp(t); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const easeInOutQuint = (t: number) => { const x = clamp(t); return x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2; };
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
const easeIn = (t: number) => clamp(t) ** 3;
/** 0 for p<=a, 1 for p>=b */
const ramp = (p: number, a: number, b: number) => clamp((p - a) / (b - a));

const ID: LayerFx = { opacity: 1, tx: 0, ty: 0, scale: 1, blurX: 0, blurY: 0, zoomBlur: 0, brightness: 1, reveal: null };
const L = (o: Partial<LayerFx> = {}): LayerFx => ({ ...ID, ...o });
const DIR = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] } as const;

export function transitionFx(type: TransitionType, p0: number, dir: TransitionSpec["direction"] = "left", intensity = 0.7): TransitionFx {
  const p = clamp(p0);
  const k = clamp(intensity, 0, 1);
  const [dx, dy] = DIR[dir];
  const horizontal = dx !== 0;
  switch (type) {
    case "smooth-zoom": {
      const e = easeInOut(p);
      return { a: L({ scale: 1 + (0.25 + 0.35 * k) * e, opacity: 1 - ramp(p, 0.35, 0.85) }), b: L({ scale: 1 + (0.18 + 0.2 * k) * (1 - e), opacity: ramp(p, 0.15, 0.65) }), flash: 0, bOnTop: true };
    }
    case "radial-zoom-blur": {
      // blur peaks at the cut; A flies in, B arrives from beyond and settles
      const bell = Math.sin(Math.PI * p);
      const cut = ramp(p, 0.42, 0.58);
      return {
        a: L({ scale: 1 + (0.5 + 0.9 * k) * easeIn(Math.min(1, p / 0.5)), zoomBlur: bell * (0.5 + 0.5 * k), opacity: 1 - cut }),
        b: L({ scale: 1 + (0.35 + 0.5 * k) * (1 - easeOut(ramp(p, 0.5, 1))), zoomBlur: bell * (0.5 + 0.5 * k), opacity: cut }),
        flash: 0, bOnTop: true,
      };
    }
    case "directional-blur": {
      const bell = Math.sin(Math.PI * p);
      const len = (0.05 + 0.12 * k) * bell;
      const mix = ramp(p, 0.3, 0.7);
      return { a: L({ opacity: 1 - mix, blurX: horizontal ? len : 0, blurY: horizontal ? 0 : len, tx: dx * 0.03 * easeInOut(p), ty: dy * 0.03 * easeInOut(p) }), b: L({ opacity: mix, blurX: horizontal ? len : 0, blurY: horizontal ? 0 : len, tx: -dx * 0.03 * (1 - easeInOut(p)), ty: -dy * 0.03 * (1 - easeInOut(p)) }), flash: 0, bOnTop: true };
    }
    case "whip-pan": {
      const e = easeInOutQuint(p);
      const speed = Math.sin(Math.PI * e) ; // velocity-like bell
      const len = (0.1 + 0.2 * k) * speed;
      const cut = ramp(e, 0.46, 0.54);
      return { a: L({ tx: dx * 1.0 * e, ty: dy * 1.0 * e, blurX: horizontal ? len : 0, blurY: horizontal ? 0 : len, opacity: 1 - cut }), b: L({ tx: dx * (e - 1) * 1.0, ty: dy * (e - 1) * 1.0, blurX: horizontal ? len : 0, blurY: horizontal ? 0 : len, opacity: cut }), flash: 0, bOnTop: true };
    }
    case "motion-blur": {
      const e = easeInOut(p);
      const v = Math.sin(Math.PI * e);
      const len = (0.04 + 0.1 * k) * v;
      const d = 0.35;
      const mix = ramp(p, 0.3, 0.7);
      return { a: L({ tx: dx * d * e, ty: dy * d * e, blurX: horizontal ? len : 0, blurY: horizontal ? 0 : len, opacity: 1 - mix }), b: L({ tx: dx * d * (e - 1), ty: dy * d * (e - 1), blurX: horizontal ? len : 0, blurY: horizontal ? 0 : len, opacity: mix }), flash: 0, bOnTop: true };
    }
    case "camera-push": {
      const e = easeInOut(p);
      return { a: L({ scale: 1 + (0.4 + 0.5 * k) * easeIn(p), opacity: 1 - ramp(p, 0.55, 0.95), brightness: 1 + 0.1 * Math.sin(Math.PI * p) }), b: L({ scale: 1 + (0.12 + 0.12 * k) * (1 - e), opacity: ramp(p, 0.3, 0.8) }), flash: 0, bOnTop: true };
    }
    case "flash": {
      const f = Math.pow(Math.sin(Math.PI * p), 2.2) * (0.6 + 0.4 * k);
      const cut = p >= 0.5 ? 1 : 0;
      return { a: L({ opacity: 1 - cut, scale: 1 + 0.04 * p }), b: L({ opacity: cut, scale: 1 + 0.04 * (1 - p) }), flash: f, bOnTop: true };
    }
    case "mask-reveal": {
      const e = easeInOut(p);
      return { a: L({ scale: 1 + 0.06 * e }), b: L({ reveal: e >= 0.999 ? null : { r: 1.15 * e + 0.0001, feather: 0.12 }, scale: 1 + 0.08 * (1 - e) }), flash: 0, bOnTop: true };
    }
    case "slide": {
      const e = easeInOut(p);
      return { a: L({ tx: dx * e, ty: dy * e }), b: L({ tx: dx * (e - 1), ty: dy * (e - 1) }), flash: 0, bOnTop: true };
    }
    case "cinematic-fade": {
      const e = easeInOut(p);
      const dip = ramp(p, 0.5, 0.5001);
      return { a: L({ brightness: Math.max(0, 1 - e * 2), opacity: 1 - dip, scale: 1 + 0.03 * p }), b: L({ brightness: Math.max(0, Math.min(1, (e - 0.5) * 2)), opacity: dip, scale: 1.03 - 0.03 * p }), flash: 0, bOnTop: true };
    }
  }
}

/* ───────── placing transitions on the real joins of the edit ───────── */
export interface PlacedTransition {
  spec: TransitionSpec;
  /** index of the segment before the join */
  joinIndex: number;
  /** output frame of the join */
  joinFrame: number;
  /** first output frame of the window and its length (even) */
  startFrame: number;
  frames: number;
  /** source frame of A / B at the first window frame (linear continuations of their segments; B may be negative -> clamp) */
  aStartSrcFrame: number;
  bStartSrcFrame: number;
}

/** Match each transition to the nearest join (within 400 ms) and clamp its window so it never reaches into a neighbouring window. */
export function placeTransitions(specs: TransitionSpec[], segs: Segment[], fps: number): PlacedTransition[] {
  const out: PlacedTransition[] = [];
  const used = new Set<number>();
  for (const spec of [...specs].sort((a, b) => a.joinSrcMs - b.joinSrcMs)) {
    let best = -1, bd = Infinity;
    for (let i = 0; i + 1 < segs.length; i++) { const d = Math.abs(segs[i].srcEndMs - spec.joinSrcMs); if (d < bd && !used.has(i)) { bd = d; best = i; } }
    if (best < 0 || bd > 400) continue;
    used.add(best);
    const A = segs[best], B = segs[best + 1];
    const wanted = Math.max(2, Math.round((spec.durationMs * fps) / 1000));
    const half = Math.max(1, Math.min(Math.floor(wanted / 2), Math.floor(A.frames / 2), Math.floor(B.frames / 2)));
    const joinFrame = B.outStartFrame;
    out.push({ spec, joinIndex: best, joinFrame, startFrame: joinFrame - half, frames: half * 2, aStartSrcFrame: A.srcStartFrame + (joinFrame - half - A.outStartFrame), bStartSrcFrame: B.srcStartFrame + (joinFrame - half - B.outStartFrame) });
  }
  return out;
}

/** progress for frame `k` (0-based inside the window of `frames` frames), strictly inside (0,1) so the window edges blend with the plain clips */
export const windowProgress = (k: number, frames: number) => (k + 1) / (frames + 1);

/** Render a layer's fx as CSS (used by the CSS/SVG path). `w`/`h` are the composition size in px. */
export function layerCss(fx: LayerFx, w: number, h: number, filterId?: string): React.CSSProperties {
  const transform = `translate(${(fx.tx * 100).toFixed(3)}%, ${(fx.ty * 100).toFixed(3)}%) scale(${fx.scale.toFixed(4)})`;
  const css: Record<string, string | number | undefined> = { opacity: fx.opacity, transform, transformOrigin: "50% 50%" };
  const filters: string[] = [];
  if ((fx.blurX > 0.0005 || fx.blurY > 0.0005) && filterId) filters.push(`url(#${filterId})`);
  if (fx.brightness !== 1) filters.push(`brightness(${fx.brightness.toFixed(3)})`);
  if (filters.length) css.filter = filters.join(" ");
  if (fx.reveal) {
    const r = fx.reveal.r * Math.hypot(w, h) / 2; // radius in px (fraction of half-diagonal)
    const f = fx.reveal.feather * Math.hypot(w, h) / 2;
    const m = `radial-gradient(circle at 50% 50%, #000 ${Math.max(0, r - f).toFixed(1)}px, transparent ${r.toFixed(1)}px)`;
    css.WebkitMaskImage = m;
    css.maskImage = m;
  }
  return css as React.CSSProperties;
}
