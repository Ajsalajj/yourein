/**
 * Phase 3: eleven "After Effects text animator" style motion presets, written from scratch as pure Remotion frame functions.
 * They imitate the BEHAVIOUR such presets are known for (blink, flicker, tracking, typing...). No .ffx file was read or imported.
 */
import React from "react";
import type { Behavior } from "./types";
import { clamp, easeInOutCubic, easeOutCubic, easeOutExpo, hash, mix, px } from "./helpers";

const h = React.createElement;

/* 1 ─ Word Blink: every word flashes on/off a few times when it is spoken, then holds */
export const wordBlink: Behavior = {
  id: "word-blink",
  name: "Word Blink",
  word: (c) => {
    const blinkMs = clamp(c.dur * 0.7, 260, 640);
    const step = blinkMs / 5;
    const t = c.sinceWord;
    const blinking = t >= 0 && t < blinkMs;
    const on = !blinking || Math.floor(t / step) % 2 === 0;
    return { style: { opacity: c.revealed && on ? 1 - c.exit : 0, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 2 ─ Smooth Fade In and Out: the whole caption eases in with a small drift and eases out again */
export const smoothFadeInOut: Behavior = {
  id: "smooth-fade-in-out",
  name: "Smooth Fade In & Out",
  group: (c) => ({ style: { opacity: easeInOutCubic(c.enter) * (1 - easeInOutCubic(c.exit)), transform: `translateY(${(1 - easeOutCubic(c.enter)) * px(c, 14) * c.k}px) scale(${mix(0.985, 1, easeOutCubic(c.enter))})` } }),
  word: (c) => ({ style: { color: c.isCurrent ? c.style.highlightColor : c.style.color } }),
};

/* 3 ─ Alphabet Blink: letters blink on one after another as if typed on a faulty keyboard */
export const alphabetBlink: Behavior = {
  id: "alphabet-blink",
  name: "Alphabet Blink",
  unit: "char",
  word: (c) => ({ style: { opacity: c.revealed ? 1 - c.exit : 0 } }),
  char: (c, _ch, i, n) => {
    const per = clamp((c.untilWordEnd + c.sinceWord) / Math.max(1, n), 24, 70);
    const t = c.sinceWord - i * per;
    const blinkMs = 3 * 46;
    const on = t >= blinkMs || (t >= 0 && Math.floor(t / 46) % 2 === 0);
    return { display: "inline-block", opacity: on ? 1 : 0 };
  },
};

/* 4 ─ Bottom to Up Blurred: words rise from below out of a blur */
export const bottomUpBlurred: Behavior = {
  id: "bottom-up-blurred",
  name: "Bottom to Up Blurred",
  word: (c) => {
    const p = easeOutExpo(clamp(c.sinceWord / Math.max(200, c.dur)));
    return { style: { opacity: c.revealed ? p * (1 - c.exit) : 0, transform: `translateY(${(1 - p) * px(c, 78) * c.k}px)`, filter: `blur(${(1 - p) * px(c, 16) * c.k}px)`, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 5 ─ Fade Up and Out Smooth: lines float up into place, hold, then float on upward while fading */
export const fadeUpOutSmooth: Behavior = {
  id: "fade-up-out-smooth",
  name: "Fade Up & Out Smooth",
  group: (c) => {
    const inP = easeOutCubic(c.enter), outP = easeInOutCubic(c.exit);
    return { style: { opacity: inP * (1 - outP), transform: `translateY(${(1 - inP) * px(c, 44) - outP * px(c, 44)}px)`, filter: outP > 0 ? `blur(${outP * px(c, 6)}px)` : undefined } };
  },
  word: (c) => {
    const p = easeOutCubic(clamp((c.sinceGroup - c.index * 55) / Math.max(200, c.dur)));
    return { style: { opacity: p, transform: `translateY(${(1 - p) * px(c, 16)}px)`, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 6 ─ Letter Flicker: each letter flickers like a failing sign, steadier and steadier, with a rare glitch afterwards */
export const letterFlicker: Behavior = {
  id: "letter-flicker",
  name: "Letter Flicker",
  unit: "char",
  word: (c) => ({ style: { opacity: c.revealed ? 1 - c.exit : 0 }, glowK: 0.6 + 0.9 * (1 - clamp(c.sinceWord / 900)) }),
  char: (c, _ch, i) => {
    const settle = clamp(c.sinceWord / Math.max(500, c.dur * 1.6));
    const tick = Math.floor(c.frame / 2);
    const r = hash(i * 13.37 + c.index * 7.1 + tick * 0.91);
    const flickerOn = settle >= 1 ? r < 0.012 : r < (1 - settle) * 0.75;
    return { display: "inline-block", opacity: flickerOn ? (settle >= 1 ? 0.55 : 0.12) : 1 };
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

/* 8 ─ Bouncext: letters drop in and bounce on landing */
export const bouncext: Behavior = {
  id: "bounce-text",
  name: "Bouncext",
  unit: "char",
  word: (c) => ({ style: { opacity: c.revealed ? 1 - c.exit : 0, color: c.isCurrent ? c.style.highlightColor : c.style.color } }),
  char: (c, _ch, i) => {
    const t = c.sinceWord - i * 26;
    const s = c.spr(t, { damping: 4.5, stiffness: 190, mass: 0.7, durMs: 640 });
    const land = Math.max(0, s - 1); // overshoot below the baseline squashes the letter
    return { display: "inline-block", opacity: t > 0 ? 1 : 0, transform: `translateY(${(1 - s) * -px(c, 150) * c.k}px) rotate(${(1 - Math.min(s, 1)) * (i % 2 ? 9 : -9)}deg) scale(${1 + land * 0.28}, ${1 - land * 0.34})`, transformOrigin: "50% 100%" };
  },
};

/* 9 ─ Text Tracking: letter spacing opens wide and closes in, with a soft blur-in */
export const textTracking: Behavior = {
  id: "text-tracking",
  name: "Text Tracking",
  unit: "char",
  word: (c) => {
    const p = easeOutCubic(clamp(c.sinceWord / Math.max(300, c.dur * 1.4)));
    return { style: { opacity: c.revealed ? Math.min(1, p * 1.6) * (1 - c.exit) : 0, filter: `blur(${(1 - p) * px(c, 7)}px)`, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
  char: (c, _ch, i, n) => {
    const p = easeOutExpo(clamp(c.sinceWord / Math.max(300, c.dur * 1.4)));
    const spread = (1 - p) * 0.62 * c.k; // em of extra spacing between neighbours, applied symmetrically about the word centre
    return { display: "inline-block", transform: `translateX(${(i - (n - 1) / 2) * spread}em)` };
  },
};

/* 10 ─ Random Up Text: every letter climbs from its own random depth with its own random delay */
export const randomUp: Behavior = {
  id: "random-up",
  name: "Random Up Text",
  unit: "char",
  word: (c) => ({ style: { opacity: c.revealed ? 1 - c.exit : 0 } }),
  char: (c, _ch, i) => {
    const seed = c.index * 31.7 + i * 5.3;
    const delay = hash(seed) * Math.max(160, c.dur * 0.7);
    const rise = 38 + hash(seed + 9.1) * 90;
    const p = easeOutExpo(clamp((c.sinceWord - delay) / Math.max(260, c.dur * 0.9)));
    return { display: "inline-block", opacity: p, transform: `translateY(${(1 - p) * px(c, rise) * c.k}px)` };
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
