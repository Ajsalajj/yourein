/** Reusable looks (WordStyle layers) used by the premium templates. Every value is tunable per template/word in the UI. */
import type { WordStyle } from "../../lib/wordstyle";
import { stack } from "../fontStacks";

const soft = (a = 0.5, blur = 34, y = 10) => ({ color: `rgba(0,0,0,${a})`, blur, x: 0, y });

export const LOOKS = {
  /** Reference 1: giant tight heavy white with a deep soft shadow for contrast over footage */
  heavyWhite: { color: "#ffffff", shadows: [soft(0.62, 14, 4), soft(0.4, 44, 12)] } satisfies WordStyle,

  /** Reference 4: neon-green bold italic serif keyword with offset dark-green depth and a lime halo (measured colour ~#05f105) */
  greenItalic: {
    fontFamily: stack("Playfair Display"), fontWeight: 900, fontStyle: "italic", sizeScale: 1.5,
    color: "#12f012",
    extrude: { depth: 9, color: "#0a6b0a", angle: 60, fade: true },
    glow: { color: "#76ff3a", blur: 22, strength: 2, pulse: 0, hz: 1 },
    animationId: "char-stagger",
  } satisfies WordStyle,

  /** Reference 4 / user brief: purple 3D extrusion (violet measured ~#4b00fd) */
  purple3d: {
    gradient: { angle: 180, size: 100, animate: "none", speed: 0, shine: null, stops: [{ color: "#b58cff", pos: 0 }, { color: "#7a3dff", pos: 0.55 }, { color: "#4b00fd", pos: 1 }] },
    extrude: { depth: 24, color: "#2a0a8c", angle: 55, fade: true },
    glow: { color: "#7a3dff", blur: 24, strength: 1, pulse: 0, hz: 1 },
    stroke: { color: "#ffffff", width: 1.5 },
  } satisfies WordStyle,

  /** Reference 3: azure gradient with diagonal shine and cyan halo (title measured ~#11acfa) */
  neonCyan: {
    gradient: { angle: 180, size: 100, animate: "none", speed: 0, stops: [{ color: "#e9ffff", pos: 0 }, { color: "#38d8f8", pos: 0.42 }, { color: "#0a7ff0", pos: 1 }], shine: { color: "#ffffff", width: 20, speed: 70, angle: 24, intensity: 0.9 } },
    glow: { color: "#00cfff", blur: 28, strength: 3, pulse: 0.22, hz: 1.1 },
    // dark edge + contact shadow: a bright cyan tube over bright footage has almost no luminance contrast on its own
    stroke: { color: "#03233f", width: 3.5 },
    shadows: [soft(0.75, 8, 2), soft(0.45, 26, 6)],
  } satisfies WordStyle,

  /** Reference 3 "Hero Text"/"Smooth Cross": pink -> violet gradient that slides while the word pops */
  pinkPop: {
    gradient: { angle: 100, size: 300, animate: "slide", speed: 130, shine: null, stops: [{ color: "#ff5ea8", pos: 0 }, { color: "#ff9a5e", pos: 0.25 }, { color: "#c13bff", pos: 0.55 }, { color: "#ff5ea8", pos: 1 }] },
    glow: { color: "#ff4fa0", blur: 22, strength: 2, pulse: 0, hz: 1 },
    shadows: [soft(0.65, 8, 2), soft(0.4, 18, 6)],
  } satisfies WordStyle,

  rainbow: {
    gradient: { angle: 100, size: 350, animate: "slide", speed: 150, stops: ["#ff3b3b", "#ffb000", "#ffee00", "#3bff6a", "#00c8ff", "#6a5cff", "#ff3bd0", "#ff3b3b"].map((color, i, a) => ({ color, pos: i / (a.length - 1) })), shine: { color: "#ffffff", width: 14, speed: 120, angle: 18, intensity: 0.9 } },
    glow: { color: "#ffffff", blur: 14, strength: 1, pulse: 0.2, hz: 0.8 },
    shadows: [soft(0.65, 8, 2), soft(0.45, 16, 6)],
  } satisfies WordStyle,

  /** Reference 3 "Metallic Text": banded silver with specular sweep and dark edge */
  chrome: {
    gradient: { angle: 180, size: 100, animate: "none", speed: 0, stops: [{ color: "#ffffff", pos: 0 }, { color: "#c3ccd9", pos: 0.28 }, { color: "#5f6b7d", pos: 0.5 }, { color: "#eef3fa", pos: 0.62 }, { color: "#8893a4", pos: 0.82 }, { color: "#ffffff", pos: 1 }], shine: { color: "#ffffff", width: 12, speed: 80, angle: 22, intensity: 1 } },
    stroke: { color: "#1a212c", width: 2 },
    shadows: [soft(0.55, 14, 6)],
    glow: { color: "#cfe3ff", blur: 12, strength: 1, pulse: 0, hz: 1 },
  } satisfies WordStyle,

  /** Reference 2: warm golden yellow headline (measured ~#f6d041 / #fad53d) */
  headlineYellow: { color: "#f8d53a", skewX: -9, shadows: [soft(0.45, 28, 8)] } satisfies WordStyle,

  gold: {
    gradient: { angle: 180, size: 100, animate: "none", speed: 0, shine: { color: "#fff6cf", width: 16, speed: 60, angle: 20, intensity: 0.8 }, stops: [{ color: "#fff3b0", pos: 0 }, { color: "#f6d041", pos: 0.5 }, { color: "#b8860b", pos: 1 }] },
    extrude: { depth: 10, color: "#6b4a00", angle: 90, fade: true },
  } satisfies WordStyle,

  deepExtrude: { color: "#fff7e0", extrude: { depth: 30, color: "#d1342f", angle: 62, fade: true }, shadows: [soft(0.5, 30, 20)] } satisfies WordStyle,

  /** long soft shadow that animates in (smooth-shadow-reveal) */
  longShadow: { color: "#ffffff", shadows: [{ color: "rgba(0,0,0,0.55)", blur: 40, x: 0, y: 22 }, { color: "rgba(0,0,0,0.3)", blur: 8, x: 0, y: 4 }] } satisfies WordStyle,
};
