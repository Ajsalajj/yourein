import React, { type CSSProperties } from "react";
import type { Behavior, GroupCtx, WordCtx } from "./types";
import { bell, clamp, easeInOutCubic, easeOutBack, easeOutCubic, easeOutExpo, hash, mix, px, readableOn, smoothstep, withAlpha } from "./helpers";

const h = React.createElement;

/** Fade the whole block in at the start and out at the end. */
const groupFade = (c: GroupCtx) => easeOutCubic(c.enter) * (1 - easeInOutCubic(c.exit));
/** Visibility of a word once spoken, for cumulative reveals. */
const since = (c: WordCtx) => c.sinceWord;

/* 1 ───────────────────────── Word Pop */
const wordPop: Behavior = {
  id: "word-pop",
  name: "Word Pop",
  word: (c) => {
    const s = c.spr(since(c), { damping: 9, stiffness: 190, mass: 0.7 });
    const act = c.isCurrent;
    return {
      style: {
        opacity: c.revealed ? Math.min(1, s * 3) * (1 - c.exit) : 0,
        transform: `scale(${mix(0.35, 1, s) * (act ? 1 + 0.07 * c.k : 1)}) translateY(${(1 - s) * px(c, 24) * c.k}px)`,
        color: act ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 2 ───────────────────────── Smooth Scale */
const smoothScale: Behavior = {
  id: "smooth-scale",
  name: "Smooth Scale",
  group: (c) => ({
    style: { opacity: groupFade(c), transform: `scale(${mix(0.86, 1, easeOutCubic(c.enter)) * mix(1, 0.97, easeInOutCubic(c.exit))})` },
  }),
  word: (c) => {
    const env = c.state === "active" ? smoothstep(0, 0.22, c.wordP) * (1 - smoothstep(0.78, 1, c.wordP)) : 0;
    return { style: { transform: `scale(${1 + 0.11 * c.k * env})`, color: mixColor(c, env) } };
  },
};
function mixColor(c: WordCtx, t: number) {
  return t > 0.5 ? c.style.highlightColor : c.style.color;
}

/* 3 ───────────────────────── Elastic Bounce */
const elasticBounce: Behavior = {
  id: "elastic-bounce",
  name: "Elastic Bounce",
  word: (c) => {
    const t = c.sinceGroup - c.index * 70;
    const s = c.spr(t, { damping: 5, stiffness: 120, mass: 0.9, durMs: Math.max(c.dur, 500) });
    return {
      style: {
        opacity: t > 0 ? 1 - c.exit : 0,
        transform: `translateY(${(1 - s) * -px(c, 190) * c.k}px) scaleY(${mix(1.5, 1, Math.min(s, 1.15))}) scaleX(${mix(0.8, 1, Math.min(s, 1.15))})`,
        transformOrigin: "50% 100%",
        color: c.isCurrent ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 4 ───────────────────────── Karaoke Highlight (colour fill follows the spoken word) */
const karaoke: Behavior = {
  id: "karaoke",
  name: "Karaoke Highlight",
  group: (c) => ({ style: { opacity: easeOutCubic(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const p = c.state === "past" ? 1 : c.state === "active" ? c.wordP : 0;
    const edge = p * 100;
    return {
      fill: { backgroundImage: `linear-gradient(90deg, ${c.style.highlightColor} 0%, ${c.style.highlightColor} ${edge}%, ${c.style.color} ${Math.min(100, edge + 0.01)}%, ${c.style.color} 100%)` },
    };
  },
};

/* 5 ───────────────────────── Active Word Glow */
const activeGlow: Behavior = {
  id: "active-glow",
  name: "Active Word Glow",
  group: (c) => ({ style: { opacity: easeOutCubic(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const env = c.isCurrent ? smoothstep(0, 0.2, c.state === "active" ? c.wordP : 1) : 0;
    const g = env * c.k;
    return {
      style: {
        opacity: mix(0.5, 1, env),
        color: env > 0.3 ? c.style.highlightColor : c.style.color,
        textShadow: env > 0.01 ? `0 0 ${px(c, 14) * g}px ${c.style.highlightColor}, 0 0 ${px(c, 38) * g}px ${withAlpha(c.style.highlightColor, 0.75)}, 0 0 ${px(c, 70) * g}px ${withAlpha(c.style.highlightColor, 0.45)}` : "none",
        transform: `scale(${1 + 0.05 * env})`,
      },
    };
  },
};

/* 6 ───────────────────────── Spring Motion */
const springMotion: Behavior = {
  id: "spring-motion",
  name: "Spring Motion",
  group: (c) => {
    const s = c.spr(c.sinceGroup, { damping: 10, stiffness: 110, mass: 1 });
    return { style: { transform: `translateY(${(1 - s) * px(c, 170) * c.k + c.exit * px(c, 60)}px)`, opacity: Math.min(1, s * 2.2) * (1 - c.exit) } };
  },
  word: (c) => {
    const s = c.spr(c.sinceGroup - c.index * 55, { damping: 9, stiffness: 150, mass: 0.8 });
    const lift = c.spr(c.sinceWord, { damping: 6, stiffness: 260, mass: 0.5, durMs: 360 });
    const dir = c.index % 2 === 0 ? -1 : 1;
    return {
      style: {
        transform: `translateX(${(1 - s) * dir * px(c, 70)}px) translateY(${-lift * px(c, 12) * (c.isCurrent ? 1 : 0)}px) rotate(${(1 - s) * dir * 8}deg)`,
        color: c.isCurrent ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 7 ───────────────────────── Slide Up (masked reveal) */
const slideUp: Behavior = {
  id: "slide-up",
  name: "Slide Up",
  word: (c) => {
    const p = easeOutCubic(c.sinceWord / c.dur);
    return {
      style: { overflow: "hidden", padding: "0.12em 0.06em", margin: "-0.12em -0.06em", opacity: c.revealed ? 1 - easeInOutCubic(c.exit) : 0 },
      inner: { display: "inline-block", transform: `translateY(${(1 - p) * 115}%)`, color: c.isCurrent ? c.style.highlightColor : c.style.color },
    };
  },
};

/* 8 ───────────────────────── Slide Down (line by line, with blur) */
const slideDown: Behavior = {
  id: "slide-down",
  name: "Slide Down",
  word: (c) => {
    const t = c.sinceGroup - c.lineIndex * Math.max(90, c.dur * 0.35);
    const p = easeOutCubic(t / c.dur);
    const out = Math.pow(clamp(c.exit), 3);
    return {
      style: {
        opacity: p * (1 - out),
        transform: `translateY(${(1 - p) * -px(c, 90) * c.k + out * px(c, 50)}px)`,
        filter: `blur(${(1 - p) * 6 * c.k}px)`,
        color: c.isCurrent ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 9 ───────────────────────── Blur Reveal */
const blurReveal: Behavior = {
  id: "blur-reveal",
  name: "Blur Reveal",
  word: (c) => {
    const p = easeOutCubic(c.sinceWord / c.dur);
    return {
      style: {
        opacity: c.revealed ? p * (1 - c.exit) : 0,
        filter: `blur(${(1 - p) * px(c, 22) * c.k}px)`,
        transform: `scale(${mix(1.25, 1, p)})`,
        color: c.isCurrent ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 10 ───────────────────────── Fade In */
const fadeIn: Behavior = {
  id: "fade-in",
  name: "Fade In",
  group: (c) => ({ style: { opacity: easeInOutCubic(c.enter) * (1 - easeInOutCubic(c.exit)) } }),
  word: (c) => ({ style: { opacity: c.isCurrent ? 1 : 0.72, color: c.isCurrent ? c.style.highlightColor : c.style.color } }),
};

/* 11 ───────────────────────── Typewriter (per glyph, with blinking caret) */
const typewriter: Behavior = {
  id: "typewriter",
  name: "Typewriter",
  unit: "char",
  group: (c) => ({ style: { opacity: 1 - easeInOutCubic(c.exit) } }),
  word: (c) => ({
    style: { color: c.style.color },
    suffix:
      c.state === "active" || (c.isCurrent && c.index === c.count - 1)
        ? h("span", { style: { display: "inline-block", width: "0.08em", height: "0.95em", marginLeft: "0.06em", verticalAlign: "-0.1em", background: c.style.highlightColor, opacity: Math.floor((c.frame / c.fps) * 2.4) % 2 === 0 ? 1 : 0 } })
        : undefined,
  }),
  char: (c, _ch, i, n) => {
    const spoken = Math.max(c.word.endMs - c.word.startMs, 120);
    const at = (i / n) * Math.min(spoken * 0.85, 450);
    return { opacity: c.sinceWord >= at ? 1 : 0 };
  },
};

/* 12 ───────────────────────── Character Stagger */
const charStagger: Behavior = {
  id: "char-stagger",
  name: "Character Stagger",
  unit: "char",
  word: (c) => ({ style: { opacity: c.revealed ? 1 - c.exit : 0, color: c.isCurrent ? c.style.highlightColor : c.style.color } }),
  char: (c, _ch, i) => {
    const t = c.sinceWord - i * Math.max(18, c.dur / 14);
    const s = c.spr(t, { damping: 7, stiffness: 220, mass: 0.6, durMs: 420 });
    return { display: "inline-block", opacity: t > 0 ? 1 : 0, transform: `translateY(${(1 - s) * px(c, 46) * c.k}px) rotate(${(1 - s) * (i % 2 ? 14 : -14)}deg) scale(${mix(0.4, 1, s)})` };
  },
};

/* 13 ───────────────────────── Word Rotation (3D flip) */
const wordRotation: Behavior = {
  id: "word-rotation",
  name: "Word Rotation",
  perspective: 900,
  word: (c) => {
    const s = c.spr(c.sinceWord, { damping: 11, stiffness: 130, mass: 0.9 });
    const wob = c.isCurrent ? Math.sin(c.frame / 4) * 1.4 : 0;
    return {
      style: {
        opacity: c.revealed ? Math.min(1, s * 2.5) * (1 - c.exit) : 0,
        transform: `rotateX(${(1 - s) * -95 * c.k}deg) rotateZ(${wob}deg) translateZ(${(1 - s) * -80}px)`,
        transformOrigin: "50% 100%",
        color: c.isCurrent ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 14 ───────────────────────── Smooth Tracking (words converge, transform only so layout never reflows) */
const smoothTracking: Behavior = {
  id: "smooth-tracking",
  name: "Smooth Tracking",
  group: (c) => ({ style: { opacity: easeOutCubic(c.enter * 1.3) * (1 - easeInOutCubic(c.exit)) } }),
  word: (c) => {
    const e = easeOutExpo(c.enter);
    const spread = (c.index - (c.group.wordCount - 1) / 2) * px(c, 56) * (1 - e) * c.k;
    return { style: { transform: `translateX(${spread}px)`, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 15 ───────────────────────── Cinematic Serif */
const cinematicSerif: Behavior = {
  id: "cinematic-serif",
  name: "Cinematic Serif",
  group: (c) => {
    const life = clamp(c.sinceGroup / Math.max(1, c.group.endMs - c.group.startMs));
    const rule = easeOutCubic(c.sinceGroup / (c.dur * 1.6));
    const line = (side: "top" | "bottom"): React.ReactNode =>
      h("div", { key: side, style: { height: Math.max(1, px(c, 2)), width: `${rule * 46}%`, background: `linear-gradient(90deg, transparent, ${c.style.highlightColor}, transparent)`, margin: `${px(c, side === "top" ? 0 : 14)}px auto ${px(c, side === "top" ? 14 : 0)}px`, opacity: 1 - c.exit } });
    return { style: { transform: `scale(${mix(1, 1.045, life)})`, opacity: 1 - easeInOutCubic(c.exit) }, before: line("top"), after: line("bottom") };
  },
  word: (c) => {
    const p = easeInOutCubic(c.sinceWord / (c.dur * 1.4));
    return { style: { opacity: c.revealed ? p : 0, letterSpacing: undefined, filter: `blur(${(1 - p) * 4}px)`, color: c.style.color } };
  },
};

/* 16 ───────────────────────── Minimal Editorial (left aligned wipe + accent bar) */
const minimalEditorial: Behavior = {
  id: "minimal-editorial",
  name: "Minimal Editorial",
  group: (c) => {
    const grow = easeOutCubic(c.sinceGroup / (c.dur * 1.2));
    return {
      style: { opacity: 1 - easeInOutCubic(c.exit), paddingLeft: px(c, 28), position: "relative" },
      before: h("div", { key: "bar", style: { position: "absolute", left: 0, top: 0, bottom: 0, width: Math.max(2, px(c, 5)), background: c.style.highlightColor, transformOrigin: "top", transform: `scaleY(${grow})` } }),
    };
  },
  word: (c) => {
    const p = easeOutCubic(c.sinceWord / c.dur);
    return { style: { clipPath: `inset(-10% ${(1 - (c.revealed ? p : 0)) * 100}% -10% 0)`, opacity: c.revealed ? 1 : 0, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 17 ───────────────────────── Bold Creator (whole group hard-cuts in, active word jumps) */
const boldCreator: Behavior = {
  id: "bold-creator",
  name: "Bold Creator",
  group: (c) => ({ style: { opacity: c.sinceGroup >= 0 ? 1 - (c.exit > 0.6 ? 1 : 0) : 0, transform: `scale(${mix(0.9, 1, easeOutBack(c.sinceGroup / 140))})` } }),
  word: (c) => {
    const s = c.spr(c.sinceWord, { damping: 8, stiffness: 300, mass: 0.5, durMs: 300 });
    const act = c.isCurrent;
    return {
      style: {
        color: act ? c.style.highlightColor : c.style.color,
        transform: act ? `scale(${mix(1, 1.18, s) * (1 + (c.k - 1) * 0.05)}) rotate(${mix(0, -3.5, s)}deg) translateY(${-s * px(c, 8)}px)` : "scale(1)",
        zIndex: act ? 2 : 1,
      },
    };
  },
};

/* 18 ───────────────────────── Neon Pulse */
const neonPulse: Behavior = {
  id: "neon-pulse",
  name: "Neon Pulse",
  group: (c) => {
    const flick = c.sinceGroup < 260 ? (hash(Math.floor(c.frame / 2) * 7) > 0.35 ? 1 : 0.25) : 1;
    return { style: { opacity: flick * (1 - easeInOutCubic(c.exit)) } };
  },
  word: (c) => {
    const pulse = 0.78 + 0.22 * Math.sin((c.frame / c.fps) * Math.PI * 2 * 1.3);
    const hot = c.isCurrent;
    const g = (hot ? 1.5 : 0.7) * pulse * c.k;
    const hl = c.style.highlightColor;
    return {
      style: {
        color: hot ? "#ffffff" : c.style.color,
        textShadow: `0 0 ${px(c, 4) * g}px #fff, 0 0 ${px(c, 12) * g}px ${hl}, 0 0 ${px(c, 28) * g}px ${hl}, 0 0 ${px(c, 56) * g}px ${withAlpha(hl, 0.8)}`,
      },
    };
  },
};

/* 19 ───────────────────────── Gradient Highlight (moving shine across the active word) */
const gradientHighlight: Behavior = {
  id: "gradient-highlight",
  name: "Gradient Highlight",
  group: (c) => ({ style: { opacity: easeOutCubic(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    if (!c.isCurrent) return { style: { color: c.style.color } };
    const pos = mix(0, 100, easeInOutCubic(c.state === "active" ? c.wordP : 1));
    return {
      style: { transform: `scale(${1 + 0.06 * c.k})` },
      fill: {
        backgroundImage: `linear-gradient(${100 + c.frame * 3}deg, ${c.style.highlightColor} 0%, #ffffff 35%, ${c.style.highlightColor} 55%, ${withAlpha(c.style.highlightColor, 0.7)} 100%)`,
        backgroundSize: "250% 100%",
        backgroundPosition: `${pos}% 0`,
      },
    };
  },
};

/* 20 ───────────────────────── Background Pill */
const backgroundPill: Behavior = {
  id: "background-pill",
  name: "Background Pill",
  wordPadEm: 0.84,
  group: (c) => ({ style: { opacity: easeOutCubic(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const act = c.isCurrent;
    const s = c.spr(c.sinceWord, { damping: 12, stiffness: 240, mass: 0.6, durMs: 320 });
    const ink = readableOn(c.style.highlightColor);
    return {
      style: { padding: "0.08em 0.4em", margin: "0 0.02em", color: act ? ink : c.style.color, zIndex: 1 },
      decoration: act
        ? h("span", { style: { position: "absolute", inset: 0, borderRadius: 999, background: c.style.highlightColor, transform: `scale(${mix(0.55, 1, Math.min(s, 1.1))})`, opacity: Math.min(1, s * 3), zIndex: -1, boxShadow: `0 ${px(c, 6)}px ${px(c, 18)}px ${withAlpha(c.style.highlightColor, 0.45)}` } })
        : undefined,
    };
  },
};

/* 21 ───────────────────────── Animated Underline */
const animatedUnderline: Behavior = {
  id: "animated-underline",
  name: "Animated Underline",
  group: (c) => ({ style: { opacity: easeOutCubic(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const p = c.state === "past" ? 1 : c.state === "active" ? easeInOutCubic(c.wordP) : 0;
    return {
      style: { paddingBottom: "0.12em", color: c.style.color },
      decoration: h("span", { style: { position: "absolute", left: 0, right: 0, bottom: 0, height: Math.max(3, px(c, 7)), borderRadius: 99, background: c.style.highlightColor, transformOrigin: "left", transform: `scaleX(${p})`, opacity: c.state === "past" ? 0.55 : 1 } }),
    };
  },
};

/* 22 ───────────────────────── Highlight Sweep (marker block wipes behind the text) */
const highlightSweep: Behavior = {
  id: "highlight-sweep",
  name: "Highlight Sweep",
  wordPadEm: 0.32,
  group: (c) => ({ style: { opacity: easeOutCubic(c.enter) * (1 - c.exit) } }),
  word: (c) => {
    const p = c.state === "past" ? 1 : c.state === "active" ? easeInOutCubic(c.wordP) : 0;
    return {
      style: { padding: "0 0.16em", color: c.style.color, zIndex: 1 },
      decoration: h("span", { style: { position: "absolute", left: 0, top: "6%", bottom: "2%", width: "100%", background: c.style.highlightColor, borderRadius: px(c, 6), transformOrigin: "left", transform: `skewX(-10deg) scaleX(${p})`, zIndex: -1, opacity: 0.95 } }),
    };
  },
};

/* 23 ───────────────────────── Vertical Word Stack (layout: stack) */
const verticalStack: Behavior = {
  id: "vertical-stack",
  name: "Vertical Word Stack",
  layout: "stack",
  word: (c) => {
    // d: 0 = current word, 1 = previous, ... (animated with an ease when the current word changes)
    const cur = Math.max(0, c.startedCount - 1);
    const settle = easeOutBack(clamp((c.ms - c.currentStartMs) / 220), 1.4);
    const d = cur - c.index + (1 - settle);
    const vis = c.revealed && d < 2.6;
    return {
      hidden: !vis,
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        textAlign: "center",
        opacity: vis ? clamp(1 - Math.max(0, d) * 0.42) * (1 - c.exit) : 0,
        transform: `translateY(${-d * px(c, c.style.fontSize * c.style.lineHeight * 0.95)}px) scale(${1 - Math.max(0, d) * 0.14})`,
        color: Math.round(d) === 0 ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 24 ───────────────────────── Retro Subtitle (stepped, CRT scanlines) */
const retroSubtitle: Behavior = {
  id: "retro-subtitle",
  name: "Retro Subtitle",
  group: (c) => ({
    style: { background: c.style.backgroundColor, padding: `${px(c, 12)}px ${px(c, 26)}px`, position: "relative", opacity: c.exit > 0.7 ? 0 : 1, borderRadius: 2 },
    after: h("div", { key: "scan", style: { position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0px, rgba(0,0,0,.28) 2px, transparent 2px, transparent 5px)", backgroundPosition: `0 ${(c.frame % 5)}px`, mixBlendMode: "multiply" } }),
  }),
  word: (c) => {
    const f = Math.floor(c.sinceWord / (1000 / c.fps));
    const blink = f >= 0 && f < 4 ? (f % 2 === 0 ? 1 : 0.15) : 1;
    return { style: { opacity: c.revealed ? blink : 0, color: c.isCurrent ? c.style.highlightColor : c.style.color } };
  },
};

/* 25 ───────────────────────── Comic Bounce (squash & stretch) */
const comicBounce: Behavior = {
  id: "comic-bounce",
  name: "Comic Bounce",
  word: (c) => {
    const s = c.spr(c.sinceWord, { damping: 6, stiffness: 260, mass: 0.55, durMs: 520 });
    const tilt = (hash(c.index + c.word.srcStartMs) - 0.5) * 16;
    const squash = 1 + (1 - Math.min(s, 1)) * 0.5 - Math.max(0, s - 1) * 0.4;
    return {
      style: {
        opacity: c.revealed ? 1 - c.exit : 0,
        transform: `translateY(${-(Math.min(s, 1.25) * px(c, 6)) + (1 - s) * px(c, 60)}px) rotate(${tilt * s}deg) scale(${(2 - squash) * s}, ${squash * s})`,
        transformOrigin: "50% 100%",
        color: c.index % 2 === 0 ? c.style.color : c.style.highlightColor,
      },
    };
  },
};

/* 26 ───────────────────────── Soft Shadow Pop */
const softShadowPop: Behavior = {
  id: "soft-shadow-pop",
  name: "Soft Shadow Pop",
  word: (c) => {
    const p = easeOutCubic(c.sinceWord / c.dur);
    const lift = c.isCurrent ? easeOutCubic(c.sinceWord / 240) : 0;
    return {
      style: {
        opacity: c.revealed ? p * (1 - c.exit) : 0,
        transform: `scale(${mix(0.8, 1, p)}) translateY(${-lift * px(c, 8) * c.k + (1 - p) * px(c, 14)}px)`,
        textShadow: `0 ${px(c, 4 + 14 * (p + lift * 0.5))}px ${px(c, 6 + 30 * p)}px rgba(0,0,0,${0.18 + 0.32 * p})`,
        color: c.isCurrent ? c.style.highlightColor : c.style.color,
      },
    };
  },
};

/* 27 ───────────────────────── Glitch Accent */
const glitchAccent: Behavior = {
  id: "glitch-accent",
  name: "Glitch Accent",
  word: (c) => {
    const t = c.sinceWord;
    const glitching = t >= 0 && t < 260;
    const n = Math.floor(c.frame);
    const j = glitching ? (hash(n * 3 + c.index) - 0.5) * 2 : 0;
    const off = px(c, 7) * c.k * (glitching ? 1 : 0.18);
    const slice = glitching ? hash(n * 5 + c.index * 2) : 0;
    return {
      style: {
        opacity: c.revealed ? 1 - c.exit : 0,
        transform: `translateX(${j * px(c, 10) * c.k}px) skewX(${j * 8}deg)`,
        color: c.isCurrent ? c.style.highlightColor : c.style.color,
        textShadow: `${-off}px 0 rgba(255,0,80,.85), ${off}px 0 rgba(0,240,255,.85)`,
        clipPath: glitching && slice > 0.6 ? `inset(${Math.floor(slice * 40)}% 0 ${Math.floor((1 - slice) * 30)}% 0)` : undefined,
      },
    };
  },
};

/* 28 ───────────────────────── Luxury Title (gold, per-letter fade, expanding rules) */
const luxuryTitle: Behavior = {
  id: "luxury-title",
  name: "Luxury Title",
  unit: "char",
  group: (c) => {
    const e = easeOutCubic(c.sinceGroup / (c.dur * 2));
    const rule = (k: string) => h("div", { key: k, style: { height: Math.max(1, px(c, 1.5)), width: `${e * 60}%`, margin: `${px(c, 16)}px auto`, background: `linear-gradient(90deg, transparent, ${c.style.highlightColor}, transparent)`, opacity: 1 - c.exit } });
    return { style: { opacity: 1 - easeInOutCubic(c.exit) }, before: rule("a"), after: rule("b") };
  },
  word: (c) => ({ style: { filter: `drop-shadow(0 ${px(c, 3)}px ${px(c, 8)}px rgba(0,0,0,.55))` } }),
  // Gold gradient is painted per glyph: background-clip:text does not reach children that carry their own transform/opacity.
  char: (c, _ch, i) => {
    const t = c.sinceGroup - (c.index * 4 + i) * 38;
    const p = easeOutCubic(t / (c.dur * 1.2));
    return {
      display: "inline-block",
      opacity: p,
      transform: `translateY(${(1 - p) * px(c, 14)}px)`,
      backgroundImage: `linear-gradient(180deg, #fff6d8 0%, ${c.style.highlightColor} 48%, #8a6a1e 100%)`,
      WebkitBackgroundClip: "text",
      backgroundClip: "text",
      WebkitTextFillColor: "transparent",
      color: "transparent",
    };
  },
};

/* 29 ───────────────────────── Kinetic Multi-Line (emphasis sizing, alternating slides) */
const kineticMultiLine: Behavior = {
  id: "kinetic-multi-line",
  name: "Kinetic Multi-Line",
  layout: "kinetic",
  word: (c) => {
    const k = c.emphasis;
    const dir = c.lineIndex % 2 === 0 ? -1 : 1;
    const s = c.spr(c.sinceWord, { damping: 13, stiffness: 150, mass: 0.9 });
    return {
      style: {
        fontSize: `${mix(0.72, 1.55, k)}em`,
        opacity: c.revealed ? Math.min(1, s * 2.5) * (1 - c.exit) : 0,
        transform: `translateX(${(1 - s) * dir * px(c, 200) * c.k}px)`,
        color: k > 0.78 ? c.style.highlightColor : c.style.color,
        lineHeight: 1,
      },
    };
  },
};

/* 30 ───────────────────────── Impact Caption (one word at a time, slam + shake) */
const impactCaption: Behavior = {
  id: "impact-caption",
  name: "Impact Caption",
  layout: "single",
  word: (c) => {
    const t = c.sinceWord;
    const p = easeOutExpo(t / 140);
    const decay = Math.exp(-t / 120);
    const shakeX = Math.sin(t / 14) * px(c, 14) * decay * c.k;
    const shakeY = Math.cos(t / 11) * px(c, 9) * decay * c.k;
    const flash = t < 100 ? 1 : 0;
    return {
      style: {
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        textAlign: "center",
        opacity: c.isCurrent ? 1 - c.exit : 0,
        transform: `translate(${shakeX}px, ${shakeY}px) scale(${mix(2.3, 1, p)})`,
        color: flash ? "#ffffff" : c.style.highlightColor,
        filter: flash ? "brightness(1.6)" : undefined,
      },
    };
  },
};

export const BEHAVIORS: Behavior[] = [
  wordPop, smoothScale, elasticBounce, karaoke, activeGlow, springMotion, slideUp, slideDown, blurReveal, fadeIn,
  typewriter, charStagger, wordRotation, smoothTracking, cinematicSerif, minimalEditorial, boldCreator, neonPulse,
  gradientHighlight, backgroundPill, animatedUnderline, highlightSweep, verticalStack, retroSubtitle, comicBounce,
  softShadowPop, glitchAccent, luxuryTitle, kineticMultiLine, impactCaption,
];

export const BEHAVIOR_MAP: Record<string, Behavior> = Object.fromEntries(BEHAVIORS.map((b) => [b.id, b]));
export type { CSSProperties };
