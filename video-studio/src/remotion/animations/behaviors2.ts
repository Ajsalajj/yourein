/**
 * Behaviours added in phase 2, designed from measurements of the reference videos (docs/REFERENCE_STYLE_ANALYSIS.md).
 * Same contract as behaviors.ts: pure functions of the frame context.
 */
import React from "react";
import type { Behavior, WordCtx } from "./types";
import { clamp, easeInCubic, easeInOutCubic, easeOutExpo, hash, lerpColor, mix, px, withAlpha } from "./helpers";

const h = React.createElement;
const abs: React.CSSProperties = { position: "absolute", left: 0, right: 0, top: 0, textAlign: "center" };

/* ── A1 ─ Bold Kinetic Centre: one giant word at a time, hard cut in, spring from small, zoom-blur out ── */
export const kineticCenter: Behavior = {
  id: "kinetic-center",
  name: "Bold Kinetic Centre",
  layout: "single",
  freeMaxEm: 1.9,
  word: (c) => {
    const len = c.word.text.length;
    const size = clamp(2.05 - 0.13 * len, 0.9, 1.85); // short words go huge, long words stay on screen
    const cur = c.isCurrent;
    const outgoing = c.index === c.startedCount - 2 && c.ms - c.currentStartMs < 120; // previous word, for 120 ms
    if (!cur && !outgoing) return { hidden: true };
    if (outgoing) {
      const p = clamp((c.ms - c.currentStartMs) / 120);
      return { style: { ...abs, fontSize: `${size}em`, opacity: 1 - p, transform: `scale(${1 + 0.9 * easeInCubic(p)})`, filter: `blur(${px(c, 26) * p}px)` } };
    }
    const s = c.spr(c.sinceWord, { damping: 9, stiffness: 340, mass: 0.6, durMs: Math.max(c.dur, 320) });
    const tilt = (c.index % 2 ? 1 : -1) * 2.2 * (1 - Math.min(s, 1));
    return {
      style: {
        ...abs,
        fontSize: `${size}em`,
        opacity: c.revealed ? 1 - c.exit : 0,
        transform: `scale(${(0.5 + 0.5 * Math.min(s, 1.18)) * (1 + (s - 1) * 0.0)}) rotate(${tilt}deg)`,
        lineHeight: 0.95,
      },
    };
  },
};

/* ── A2 ─ Kinetic Scatter: words cut in at positions around the frame, sized by weight, zoom-blur out together ── */
export const kineticScatter: Behavior = {
  id: "kinetic-scatter",
  name: "Kinetic Scatter",
  layout: "free",
  freeMaxEm: 1.7,
  word: (c) => {
    const n = c.count;
    const row = n <= 1 ? 0.5 : c.index / (n - 1);
    const side = c.index % 2 === 0 ? -1 : 1;
    const jx = (hash(c.word.srcStartMs % 997 + c.index) - 0.5) * 0.08;
    const place = { x: 0.5 + side * (0.17 + 0.05 * c.emphasis) + jx, y: 0.3 + row * 0.42 };
    if (!c.revealed) return { hidden: true, place };
    const p = clamp(c.sinceWord / 110);
    const out = c.exit;
    return {
      place,
      style: {
        fontSize: `${mix(0.7, 1.6, c.emphasis)}em`,
        opacity: (0.35 + 0.65 * p) * (1 - out),
        transform: `scale(${mix(0.88, 1, p) * (1 + 0.7 * easeInCubic(out))})`,
        filter: out > 0 ? `blur(${px(c, 22) * out}px)` : undefined,
        lineHeight: 1,
      },
    };
  },
};

/* ── B1 ─ Neon Flicker: tube power-on flicker, steady glow breathing, flash on each spoken word ── */
export const neonFlicker: Behavior = {
  id: "neon-flicker",
  name: "Neon Flicker",
  group: (c) => ({ style: { opacity: 1 - easeInOutCubic(c.exit) } }),
  word: (c) => {
    const f = Math.floor(c.sinceWord / (1000 / c.fps));
    const flicker = f >= 0 && f < 12 ? (hash(f * 13 + c.index * 7) > 0.4 ? 1 : 0.2) : 1;
    const flash = c.isCurrent ? Math.exp(-Math.max(0, c.sinceWord) / 240) : 0;
    return {
      style: { opacity: c.revealed ? flicker : 0.25 },
      glowK: (c.isCurrent ? 1.15 : 0.7) + 1.1 * flash + 0.12 * Math.sin(c.tSec * Math.PI * 2 * 1.1),
    };
  },
};

/* ── C1 ─ Punch: lands from huge and turned, extrusion grows as it hits, tiny camera shake ── */
export const punch: Behavior = {
  id: "punch",
  name: "3D Punch",
  perspective: 900,
  word: (c) => {
    const t = c.sinceWord;
    const s = c.spr(t, { damping: 8, stiffness: 300, mass: 0.7, durMs: Math.max(c.dur, 420) });
    const decay = Math.exp(-Math.max(0, t) / 140);
    const shake = Math.sin(t / 13) * px(c, 9) * decay * c.k;
    return {
      extrudeK: clamp(t / 170),
      style: {
        opacity: c.revealed ? Math.min(1, t / 50) * (1 - c.exit) : 0,
        transform: `translate(${shake}px, ${-Math.cos(t / 11) * px(c, 6) * decay * c.k}px) scale(${1 + 0.42 * c.sk * (1 - Math.min(s, 1)) + Math.max(0, s - 1) * 0.3}) rotateY(${(1 - Math.min(s, 1)) * 38}deg) rotate(${(1 - Math.min(s, 1)) * -5}deg)`,
        filter: t < 120 ? `blur(${px(c, 10) * (1 - t / 120)}px)` : undefined,
      },
    };
  },
};

/* ── C2 ─ Colour Lerp: white -> accent as the word is spoken, back to white after (smooth, not a snap) ── */
export const colorLerp: Behavior = {
  id: "color-lerp",
  name: "Colour Lerp",
  group: (c) => ({ style: { opacity: c.ease(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const upIn = c.hlP;
    const back = c.state === "past" ? clamp(1 - (c.ms - c.word.endMs) / 260) : 1;
    const amount = c.state === "future" ? 0 : upIn * back;
    return { style: { color: lerpColor(c.style.color, c.style.highlightColor, amount), transform: `scale(${1 + 0.09 * c.sk * c.ease(amount)})` } };
  },
};

/* ── C3 ─ Hop: each word arcs in from the previous word's slot and lands with an elastic settle ── */
export const hop: Behavior = {
  id: "hop",
  name: "Elastic Hop",
  word: (c) => {
    const r = c.geom.rects[c.index];
    const p0 = c.geom.rects[Math.max(0, c.index - 1)];
    const t = c.sinceWord;
    const flight = Math.max(160, c.dur * 0.7);
    const p = clamp(t / flight);
    const land = c.spr(t - flight, { damping: 5, stiffness: 260, mass: 0.55, durMs: 520 });
    const dx = c.index === 0 ? 0 : (p0.x + p0.w / 2 - (r.x + r.w / 2)) * (1 - c.ease(p));
    const arc = Math.sin(Math.PI * p) * px(c, 120) * c.k + (c.index === 0 ? (1 - c.ease(p)) * -px(c, 160) : 0);
    const squash = t < flight ? 1 + 0.15 * Math.sin(Math.PI * p) : 1 - 0.28 * (1 - Math.min(land, 1)) + Math.max(0, land - 1) * 0.1;
    return {
      style: { opacity: c.revealed ? 1 - c.exit : 0, transform: `translate(${dx}px, ${-arc}px) scale(${2 - squash > 1 ? 1 / squash : 1}, ${squash})`, transformOrigin: "50% 100%", color: c.isCurrent ? c.style.highlightColor : c.style.color },
    };
  },
};

/* ── D1 ─ Shadow Reveal: a long soft shadow collapses onto the word while it fades up out of blur ── */
export const shadowReveal: Behavior = {
  id: "shadow-reveal",
  name: "Shadow Reveal",
  word: (c) => {
    const p = c.ease(c.sinceWord / Math.max(300, c.dur * 1.6));
    return {
      shadowK: mix(3.4, 1, p),
      style: { opacity: c.revealed ? p * (1 - c.exit) : 0, transform: `translateY(${(1 - p) * px(c, 26)}px)`, filter: `blur(${(1 - p) * px(c, 8)}px)` },
    };
  },
};

/* ── C4 ─ Flip: the word turns over about its horizontal axis and comes back in the accent colour ── */
export const flip: Behavior = {
  id: "flip",
  name: "Colour Flip",
  perspective: 800,
  group: (c) => ({ style: { opacity: c.ease(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const p = clamp(c.sinceWord / Math.max(260, c.dur));
    const e = easeInOutCubic(p);
    const angle = e * 180;
    const upright = angle <= 90 ? angle : angle - 180; // never shows the mirrored back side
    const turned = c.revealed && angle > 90;
    return { style: { color: turned ? c.style.highlightColor : c.style.color, transform: `rotateX(${upright}deg)`, opacity: c.revealed ? 1 : 0.6 } };
  },
};

/* ── A3 ─ Stretch: rubber-band - starts wide and flat, snaps to size with overshoot ── */
export const stretch: Behavior = {
  id: "stretch",
  name: "Word Stretch",
  word: (c) => {
    const s = c.spr(c.sinceWord, { damping: 6, stiffness: 230, mass: 0.7, durMs: Math.max(c.dur, 480) });
    const sx = 1 + (2.6 - 1) * (1 - Math.min(s, 1)) * c.sk + Math.max(0, s - 1) * -0.5;
    const sy = 1 - 0.62 * (1 - Math.min(s, 1)) * c.sk + Math.max(0, s - 1) * 0.35;
    return {
      style: { opacity: c.revealed ? Math.min(1, c.sinceWord / 40) * (1 - c.exit) : 0, transform: `scale(${sx}, ${sy})`, filter: `blur(${(1 - Math.min(s, 1)) * px(c, 12)}px)`, color: c.isCurrent ? c.style.highlightColor : c.style.color },
    };
  },
};

/* ── A4 ─ Zoomed Keyword: camera-style zoom on the spoken word; neighbours dim and shuffle aside ── */
export const zoomKeyword: Behavior = {
  id: "zoom-keyword",
  name: "Zoomed Keyword",
  group: (c) => ({ style: { opacity: c.ease(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const cur = c.startedCount - 1;
    const z = 1 + 0.95 * c.sk;
    const sCur = c.spr(c.ms - c.currentStartMs, { damping: 12, stiffness: 220, mass: 0.8, durMs: 420 });
    const rects = c.geom.rects;
    const extra = rects[Math.max(0, cur)] ? rects[Math.max(0, cur)].w * (z - 1) * Math.min(sCur, 1.05) : 0;
    const isCur = c.index === cur;
    const shift = c.index < cur ? -extra / 2 : c.index > cur ? extra / 2 : 0;
    return {
      style: {
        transform: isCur ? `scale(${1 + (z - 1) * Math.min(sCur, 1.12)})` : `translateX(${shift}px) scale(${1 - 0.14 * Math.min(sCur, 1)})`,
        opacity: isCur ? 1 : mix(1, 0.5, Math.min(sCur, 1)),
        color: isCur ? c.style.highlightColor : c.style.color,
        zIndex: isCur ? 3 : 1,
      },
    };
  },
};

/* ── B2 ─ Float: words rise in, then drift continuously on slow sine paths with parallax ── */
export const float: Behavior = {
  id: "float",
  name: "Floating Words",
  group: (c) => ({ style: { opacity: c.ease(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const p = c.ease(c.sinceWord / Math.max(300, c.dur * 1.4));
    const t = c.tSec * 0.45 + c.index * 0.21;
    return {
      style: {
        opacity: c.revealed ? p : 0,
        transform: `translate(${Math.sin(t * 2 * Math.PI * 0.7) * px(c, 6) * c.k}px, ${(1 - p) * px(c, 36) + Math.sin(t * 2 * Math.PI) * px(c, 8) * c.k}px) rotate(${Math.sin(t * 2 * Math.PI * 0.8 + 1) * 1.8 * c.k}deg)`,
      },
    };
  },
};

/* ── B3 ─ Glow Flash: every spoken word is hit by a glow flash that decays into a slow breathing halo ── */
export const glowFlash: Behavior = {
  id: "glow-flash",
  name: "Glow Pulse",
  group: (c) => ({ style: { opacity: c.ease(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const flash = c.revealed ? Math.exp(-Math.max(0, c.sinceWord) / 260) : 0;
    const s = c.spr(c.sinceWord, { damping: 10, stiffness: 260, durMs: 320 });
    return { glowK: 0.55 + 2.0 * flash + 0.18 * Math.sin(c.tSec * Math.PI * 2 * 0.9 + c.index), style: { transform: `scale(${1 + 0.07 * c.sk * Math.max(0, 1 - Math.abs(s - 1) * 2) * (c.isCurrent ? 1 : 0)})`, opacity: c.revealed ? 1 : 0.35 } };
  },
};

/* ── D2 ─ Cinematic Headline: focus-in from heavy blur, slow push, then RECEDES into depth with a bloom (ref. 2) ── */
export const cinematicHeadline: Behavior = {
  id: "cinematic-headline",
  name: "Cinematic Headline",
  group: (c) => {
    const life = clamp(c.sinceGroup / Math.max(1, c.group.endMs - c.group.startMs));
    const e = easeInCubic(c.exit);
    return {
      style: {
        transform: `scale(${mix(1, 1.05, life) * (1 - 0.46 * e)}) translateY(${-e * px(c, 30)}px)`,
        opacity: 1 - easeInOutCubic(clamp((c.exit - 0.15) / 0.85)),
        filter: e > 0 ? `blur(${px(c, 9) * e}px) brightness(${1 + 0.55 * e}) saturate(${1 - 0.4 * e})` : undefined,
      },
    };
  },
  word: (c) => {
    const p = c.ease(c.sinceWord / Math.max(260, c.dur));
    return { style: { opacity: c.revealed ? p : 0, transform: `scale(${1 + 0.22 * (1 - p)})`, filter: `blur(${(1 - p) * px(c, 26)}px)` } };
  },
};

/* ── D3 ─ Perspective Fly: words fly out of depth in a tilted 3D space, with a floor reflection; recede on exit ── */
export const perspectiveFly: Behavior = {
  id: "perspective-fly",
  name: "Perspective Title",
  perspective: 700,
  group: (c) => ({
    style: {
      transform: `rotateX(${14 - 6 * c.exit}deg) rotateY(-9deg) translateZ(${-260 * easeInCubic(c.exit)}px)`,
      transformStyle: "preserve-3d",
      opacity: 1 - easeInOutCubic(c.exit),
      WebkitBoxReflect: `below ${Math.round(px(c, 6))}px linear-gradient(transparent 52%, rgba(255,255,255,0.32))`,
    },
  }),
  word: (c) => {
    const p = c.ease(c.sinceWord / Math.max(320, c.dur * 1.3));
    const s = c.spr(c.sinceWord, { damping: 14, stiffness: 120, mass: 1, durMs: 520 });
    return { style: { opacity: c.revealed ? Math.min(1, p * 1.6) : 0, transform: `translateZ(${(1 - Math.min(s, 1.04)) * -900}px) rotateY(${(1 - Math.min(s, 1)) * 42}deg)` } };
  },
};

/* ── D4 ─ Editorial Reveal: clipped rise per word with a drawn rule underneath ── */
export const editorialReveal: Behavior = {
  id: "editorial-reveal",
  name: "Editorial Reveal",
  group: (c) => {
    const grow = c.ease(c.sinceGroup / (c.dur * 2));
    return { style: { opacity: 1 - easeInOutCubic(c.exit) }, after: h("div", { key: "rule", style: { height: Math.max(1, px(c, 2)), width: `${grow * 100}%`, background: c.style.highlightColor, marginTop: px(c, 14), opacity: 0.9, alignSelf: "flex-start" } }) };
  },
  word: (c) => {
    const p = easeOutExpo(c.sinceWord / Math.max(360, c.dur * 1.5));
    return {
      style: { opacity: c.revealed ? Math.min(1, p * 1.5) : 0, clipPath: `inset(${(1 - p) * 70}% 0 -12% 0)`, transform: `translateY(${(1 - p) * px(c, 34)}px)`, filter: `blur(${(1 - p) * px(c, 4)}px)` },
    };
  },
};

/* ── D5 ─ Depth Push: giant words settle in with a slow dolly-out; built to sit behind a subject ── */
export const depthPush: Behavior = {
  id: "depth-push",
  name: "Depth Push",
  group: (c) => {
    const e = easeInCubic(c.exit);
    return { style: { transform: `scale(${mix(1.1, 1, c.ease(c.sinceGroup / (c.dur * 4))) * (1 + 0.5 * e)})`, opacity: 1 - e, filter: e > 0 ? `blur(${px(c, 18) * e}px)` : undefined } };
  },
  word: (c) => {
    const p = c.ease(c.sinceWord / Math.max(200, c.dur * 0.8));
    return { style: { opacity: c.revealed ? p : 0, transform: `scale(${1.08 - 0.08 * p})` } };
  },
};

/* ── D6 ─ Extrude Sway: a deep extruded word that sways in 3D (the extrusion turns with it) ── */
export const extrudeSway: Behavior = {
  id: "extrude-sway",
  name: "Extrude Sway",
  perspective: 900,
  word: (c) => {
    const s = c.spr(c.sinceWord, { damping: 11, stiffness: 180, mass: 0.9, durMs: 480 });
    const sway = Math.sin(c.tSec * Math.PI * 2 * 0.5 + c.index * 0.7);
    return {
      extrudeK: clamp(c.sinceWord / 260),
      style: { opacity: c.revealed ? Math.min(1, c.sinceWord / 60) * (1 - c.exit) : 0, transform: `scale(${0.6 + 0.4 * Math.min(s, 1.1)}) rotateY(${sway * 16 * c.k}deg) rotateX(${-6 + Math.cos(c.tSec * 3 + c.index) * 2}deg)` },
    };
  },
};

/* ── C5 ─ Bold Cut: whole line hard-cuts in with a tiny pop; keywords bring their own animation ── */
export const boldCut: Behavior = {
  id: "bold-cut",
  name: "Bold Cut",
  group: (c) => ({ style: { opacity: c.sinceGroup >= 0 ? (c.exit > 0.7 ? 0 : 1) : 0, transform: `scale(${mix(0.94, 1, easeOutExpo(c.sinceGroup / 140))})` } }),
  word: (c) => ({ style: { opacity: c.revealed ? 1 : 0.0 } }),
};

export const BEHAVIORS_2: Behavior[] = [kineticCenter, kineticScatter, neonFlicker, punch, colorLerp, hop, shadowReveal, flip, stretch, zoomKeyword, float, glowFlash, cinematicHeadline, perspectiveFly, editorialReveal, depthPush, extrudeSway, boldCut];
export type { WordCtx };
void withAlpha;
