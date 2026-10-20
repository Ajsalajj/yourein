import { spring } from "remotion";
import type { BaseCtx } from "./types";

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInCubic = (t: number) => Math.pow(clamp(t), 3);
export const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const easeOutExpo = (t: number) => (clamp(t) >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp(t)));
export const easeOutBack = (t: number, s = 1.70158) => {
  const x = clamp(t) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
};
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Deterministic pseudo-random in [0,1) from an integer seed. Never uses Math.random / wall-clock. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
/** Bell envelope: 0 -> 1 -> 0 across p in [0,1]. */
export const bell = (p: number) => Math.sin(Math.PI * clamp(p));

export type EasingId = "cubic" | "expo" | "sine" | "back" | "linear";
const easeSine = (t: number) => Math.sin((clamp(t) * Math.PI) / 2);
export function makeEase(id: EasingId | undefined): (t: number) => number {
  switch (id) {
    case "expo": return easeOutExpo;
    case "sine": return easeSine;
    case "back": return (t) => easeOutBack(t, 1.2);
    case "linear": return (t) => clamp(t);
    default: return easeOutCubic;
  }
}

export interface SpringOverrides { stiffness?: number; damping?: number }
export function makeSpring(frame: number, fps: number, dur: number, over: SpringOverrides = {}) {
  void frame;
  return (sinceMs: number, opts: { damping?: number; stiffness?: number; mass?: number; durMs?: number } = {}) => {
    if (sinceMs <= 0) return 0;
    const f = (sinceMs * fps) / 1000;
    const durationInFrames = Math.max(2, Math.round(((opts.durMs ?? dur) * fps) / 1000));
    return spring({
      frame: f,
      fps,
      durationInFrames,
      config: { damping: over.damping ?? opts.damping ?? 12, stiffness: over.stiffness ?? opts.stiffness ?? 140, mass: opts.mass ?? 0.8 },
    });
  };
}

export function hexToRgb(color: string): [number, number, number] | null {
  const m = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Black or white, whichever reads better on `bg`. */
export function readableOn(bg: string): string {
  const rgb = hexToRgb(bg);
  if (!rgb) return "#0b0b0f";
  const [r, g, b] = rgb.map((v) => v / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return L > 0.45 ? "#0b0b0f" : "#ffffff";
}
export function withAlpha(color: string, a: number): string {
  const rgb = hexToRgb(color);
  return rgb ? `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${clamp(a)})` : color;
}

/** px sized for the current canvas */
export const px = (c: Pick<BaseCtx, "scale">, v: number) => v * c.scale;

export function rotateHue(color: string, deg: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let sat = 0;
  if (d) {
    sat = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round((h + deg + 360) % 360)}, ${Math.round(Math.max(sat, 0.6) * 100)}%, ${Math.round(Math.min(0.62, Math.max(l, 0.5)) * 100)}%)`;
}
