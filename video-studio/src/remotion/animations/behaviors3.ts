/**
 * Phase 3: eleven "After Effects text animator" style motion presets, written from scratch as pure Remotion frame functions.
 * They imitate the BEHAVIOUR such presets are known for (blink, flicker, tracking, typing...). No .ffx file was read or imported.
 */
import React from "react";
import type { Behavior } from "./types";
import { clamp, easeInOutCubic, easeOutCubic, easeOutExpo, hash, mix, px } from "./helpers";
import { AE_PRESETS, evalKeys, key, opacityOf, presetAmounts } from "../../lib/aeselector";

const h = React.createElement;

/**
 * Behaviours driven by parameters DECODED from the user's Pro Presets .ffx files (src/lib/aeselector.ts, docs/AE_PRESET_ANALYSIS.md).
 * Timing runs in the preset's own frames (24 or 30 fps) from the start of the caption group; exits are anchored to the end of the caption.
 */
const unitIndex = (c: { index: number; count: number }, i: number, n: number) => ({ idx: c.index * n + i, total: Math.max(1, c.count * n) });

/** amounts per animator for a caption at this moment, for `n` units */
const amountsAt = (presetId: string, n: number, c: { sinceGroup: number; untilGroupEnd: number }) => {
  const p = AE_PRESETS[presetId];
  return p.animators.map((_, k) => presetAmounts(p, k, n, c.sinceGroup, c.untilGroupEnd));
};

/* 1 ─ Word Blink (decoded) */
export const wordBlink: Behavior = {
  id: "word-blink",
  name: "Word Blink",
  word: (c) => {
    const am = amountsAt("word-blink", c.count, c);
    return { style: { opacity: opacityOf(AE_PRESETS["word-blink"], am, c.index) * (1 - c.exit), color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 2 ─ Smooth Fade In and Out (decoded): characters fade in with a ramp sweep, fade out with a ramp-down sweep, tracking drifts */
export const smoothFadeInOut: Behavior = {
  id: "smooth-fade-in-out",
  name: "Smooth Fade In & Out",
  unit: "char",
  word: (c) => {
    const p = AE_PRESETS["smooth-fade-in-out"];
    const tr = evalKeys(p.trackingKeys!, (c.sinceGroup * p.fps) / 1000) / 1000;
    return { style: { color: c.isCurrent ? c.style.highlightColor : c.style.color, letterSpacing: `${c.style.letterSpacing + tr}em` } };
  },
  char: (c, _ch, i, n) => {
    const { idx, total } = unitIndex(c, i, n);
    const p = AE_PRESETS["smooth-fade-in-out"];
    const am = amountsAt("smooth-fade-in-out", total, c);
    return { display: "inline-block", opacity: opacityOf(p, am, idx) };
  },
};

/* 3 ─ Alphabet Blink (decoded) */
export const alphabetBlink: Behavior = {
  id: "alphabet-blink",
  name: "Alphabet Blink",
  unit: "char",
  word: (c) => ({ style: { opacity: 1 - c.exit } }),
  char: (c, _ch, i, n) => {
    const { idx, total } = unitIndex(c, i, n);
    const p = AE_PRESETS["alphabet-blink"];
    return { display: "inline-block", opacity: opacityOf(p, amountsAt("alphabet-blink", total, c), idx) };
  },
};

/* 4 ─ Bottom to Up Blurred (decoded): words start 57 px low, fully blurred (59 px) and transparent, then settle in sequence */
export const bottomUpBlurred: Behavior = {
  id: "bottom-up-blurred",
  name: "Bottom to Up Blurred",
  word: (c) => {
    const p = AE_PRESETS["bottom-up-blurred"];
    const a = amountsAt("bottom-up-blurred", c.count, c)[0][c.index];
    const an = p.animators[0].props;
    return { style: { opacity: (1 + a * (an.opacity! / 100 - 1)) * (1 - c.exit), transform: `translateY(${a * an.y! * c.scale * c.k}px)`, filter: a > 0.003 ? `blur(${a * an.blur! * c.scale * 0.5}px)` : undefined, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 5 ─ Fade Up and Out Smooth (partly decoded): words uncovered left to right, characters fade out by a ramp-down sweep, tracking drifts */
export const fadeUpOutSmooth: Behavior = {
  id: "fade-up-out-smooth",
  name: "Fade Up & Out Smooth",
  unit: "char",
  word: (c) => {
    const p = AE_PRESETS["fade-up-out-smooth"];
    const tr = evalKeys(p.trackingKeys!, (c.sinceGroup * p.fps) / 1000) / 1000;
    const a = presetAmounts(p, 0, c.count, c.sinceGroup, c.untilGroupEnd)[c.index];
    return { style: { opacity: 1 - a, transform: `translateY(${a * px(c, 22)}px)`, color: c.isCurrent ? c.style.highlightColor : c.style.color, letterSpacing: `${c.style.letterSpacing + tr}em` } };
  },
  char: (c, _ch, i, n) => {
    const p = AE_PRESETS["fade-up-out-smooth"];
    const { idx, total } = unitIndex(c, i, n);
    const a = presetAmounts(p, 1, total, c.sinceGroup, c.untilGroupEnd)[idx];
    return { display: "inline-block", opacity: 1 - a };
  },
};

/* 6 ─ Letter Flicker (decoded): letters leave a randomised square selection one by one while the order reshuffles every frame */
export const letterFlicker: Behavior = {
  id: "letter-flicker",
  name: "Letter Flicker",
  unit: "char",
  word: (c) => ({ style: { opacity: 1 - c.exit }, glowK: 0.6 + 0.9 * (1 - clamp(c.sinceGroup / 1200)) }),
  char: (c, _ch, i, n) => {
    const { idx, total } = unitIndex(c, i, n);
    return { display: "inline-block", opacity: opacityOf(AE_PRESETS["letter-flicker"], amountsAt("letter-flicker", total, c), idx) };
  },
};

/* 7 ─ Type Animation In and Out: typed on letter by letter, deleted from the end when the caption leaves */
export const typeInOut: Behavior = {
  id: "type-in-out",
  name: "Type Animation In & Out",
  unit: "char",
  word: (c) => {
    const caret =
      c.isCurrent && c.exit === 0
        ? h("span", { "aria-hidden": true, style: { display: "inline-block", width: "0.07em", height: "0.85em", marginLeft: "0.06em", verticalAlign: "-0.08em", background: c.style.highlightColor, opacity: Math.floor(c.tSec * 2.4) % 2 === 0 ? 1 : 0 } })
        : undefined;
    return { style: { opacity: c.revealed ? 1 : 0 }, suffix: caret };
  },
  char: (c, _ch, i, n) => {
    const span = clamp((c.untilWordEnd + c.sinceWord) * 0.8, 120, 520);
    const typed = c.sinceWord >= (i / Math.max(1, n)) * span;
    const g = (c.index + i / Math.max(1, n)) / Math.max(1, c.count); // position of this letter within the whole caption, 0..1
    const kept = g <= 1 - c.exit + 1e-9;
    return { display: "inline-block", opacity: typed && kept ? 1 : 0 };
  },
};

/* 8 ─ Bouncext (decoded): the whole text slides up 6.09 % of the frame height over 3.5 frames while fading in, then the preset's own overshoot
   expression runs: value + v * 0.04 * sin(1.8 * t * 2pi) / e^(3 t) * easeOut(t, 0, 3, 1, 0), v = speed just before the last key. */
export const bouncext: Behavior = {
  id: "bounce-text",
  name: "Bouncext",
  group: (c) => {
    const fps = 30, riseFrames = 3.5, rise = 0.06094 * 1080 * c.scale;
    const f = (c.sinceGroup * fps) / 1000;
    const inP = clamp(f / riseFrames);
    const v = -rise / (riseFrames / fps); // px/s, upward while sliding in (linear keys)
    const t = Math.max(0, (f - riseFrames) / fps); // s after the last key
    const easeOut = Math.pow(1 - clamp(t / 3), 3);
    const bounce = t > 0 && t < 3 ? v * 0.04 * Math.sin(1.8 * t * 2 * Math.PI) / Math.exp(3 * t) * easeOut : 0;
    return { style: { opacity: inP * (1 - c.exit), transform: `translateY(${(1 - inP) * rise + bounce}px)` } };
  },
  word: (c) => ({ style: { color: c.isCurrent ? c.style.highlightColor : c.style.color } }),
};

/* 9 ─ Text Tracking (decoded values): tracking amount 0 -> 12 (1/1000 em) over 73 frames at 30 fps, applied to every character */
export const textTracking: Behavior = {
  id: "text-tracking",
  name: "Text Tracking",
  word: (c) => {
    const tr = evalKeys(key([0, 0], [73, 12]), (c.sinceGroup * 30) / 1000) / 1000;
    return { style: { opacity: c.revealed ? 1 - c.exit : 0, letterSpacing: `${c.style.letterSpacing + tr}em`, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 10 ─ Random Up Text (partly decoded): each letter animates for 24 frames (rotation -79.7 -> 0 deg, opacity 0 -> 100, bezier ease 0.33/0.17) and the
   range selector sweeps 0 -> 100 over 40 frames at 30 fps, so letters start at random moments inside the first 16 frames. The 1000 px position animator
   is driven by an expression selector that cannot be read from the file; the small rise below is my own addition. */
export const randomUp: Behavior = {
  id: "random-up",
  name: "Random Up Text",
  unit: "char",
  word: (c) => ({ style: { opacity: c.revealed ? 1 - c.exit : 0 } }),
  char: (c, _ch, i) => {
    const seed = c.index * 31.7 + i * 5.3;
    const delay = hash(seed) * (16 / 30) * 1000;
    const p = easeOutCubic(clamp((c.sinceWord - delay) / ((24 / 30) * 1000)));
    return { display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * px(c, 60 + hash(seed + 9.1) * 60) * c.k}px) rotate(${(1 - p) * -79.7}deg)` };
  },
};

/* 11 ─ Ramp Up Zoom Text: the caption zooms up as it arrives and keeps creeping larger while it is held; later words are larger */
export const rampUpZoom: Behavior = {
  id: "ramp-up-zoom",
  name: "Ramp Up Zoom Text",
  group: (c) => {
    const e = easeOutExpo(c.enter);
    const creep = 1 + 0.07 * clamp(c.sinceGroup / Math.max(1, c.group.endMs - c.group.startMs));
    return { style: { opacity: Math.min(1, e * 1.5) * (1 - c.exit), transform: `scale(${mix(0.55, 1, e) * creep * (1 + 0.1 * c.exit)})` } };
  },
  word: (c) => {
    const rank = c.count > 1 ? c.index / (c.count - 1) : 1;
    const s = c.spr(c.sinceWord, { damping: 9, stiffness: 230, mass: 0.7, durMs: 420 });
    return { style: { opacity: c.revealed ? 1 : 0, transform: `scale(${mix(0.9, 1.0 + 0.14 * rank, clamp(s, 0, 1.25))})`, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

export const BEHAVIORS_3: Behavior[] = [wordBlink, smoothFadeInOut, alphabetBlink, bottomUpBlurred, fadeUpOutSmooth, letterFlicker, typeInOut, bouncext, textTracking, randomUp, rampUpZoom];
