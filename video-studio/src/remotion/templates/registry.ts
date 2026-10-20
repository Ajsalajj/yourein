/**
 * Central template registry. A template = animation behaviour id + a complete set of style properties.
 * Add a template by appending to TEMPLATES; the gallery, editor and exporter pick it up automatically.
 */
import type { CaptionStyleState, StyleProps } from "../../lib/project";
import { stack } from "../fontStacks";
import { LOOKS } from "./looks";

export const CATEGORIES = ["Minimal", "Cinematic", "Bold", "Neon", "Social Media", "Educational", "Luxury", "Corporate", "Gaming", "Podcast", "Malayalam Reels", "Bold Kinetic", "Neon FX", "Creator", "Cinematic Type"] as const;
export type Category = (typeof CATEGORIES)[number];

export interface CaptionTemplate {
  id: string;
  name: string;
  category: Category;
  description: string;
  animationId: string;
  style: StyleProps;
  /** where the caption block sits by default (0..1 of the frame) */
  position: { x: number; y: number };
  keywords: string[];
  /** applying this template also puts captions behind the subject (when a subject matte exists) */
  behindSubject?: boolean;
}

export const BASE_STYLE: StyleProps = {
  fontFamily: stack("Inter"),
  fontWeight: 800,
  fontSize: 64,
  color: "#ffffff",
  highlightColor: "#ffd60a",
  backgroundColor: "transparent",
  strokeColor: "#000000",
  strokeWidth: 0,
  shadow: { color: "rgba(0,0,0,0.55)", blur: 14, offsetX: 0, offsetY: 4 },
  letterSpacing: 0,
  lineHeight: 1.15,
  uppercase: false,
  italic: false,
  align: "center",
  animationDurationMs: 420,
  intensity: 1,
  maxWordsPerLine: 3,
  maxLines: 2,
  wordsPerGroup: 5,
};

const T = (
  id: string,
  name: string,
  category: Category,
  animationId: string,
  description: string,
  font: string,
  style: Partial<StyleProps>,
  keywords: string[] = [],
  position = { x: 0.5, y: 0.72 },
): CaptionTemplate => ({
  id,
  name,
  category,
  animationId,
  description,
  position,
  keywords,
  style: { ...BASE_STYLE, ...style, fontFamily: stack(font) },
});

const hardShadow = { color: "#000000", blur: 0, offsetX: 4, offsetY: 5 };

export const TEMPLATES: CaptionTemplate[] = [
  T("word-pop", "Word Pop", "Social Media", "word-pop", "Words spring onto the screen one by one as they are spoken; the current word glows yellow.", "Poppins", { fontSize: 72, strokeWidth: 6, highlightColor: "#ffd60a", maxWordsPerLine: 3 }, ["tiktok", "reels", "shorts"]),
  T("smooth-scale", "Smooth Scale", "Corporate", "smooth-scale", "The whole caption eases in with a gentle scale; the spoken word swells slightly.", "Inter", { fontWeight: 700, fontSize: 60, highlightColor: "#4cc2ff", maxWordsPerLine: 4 }, ["clean", "business"]),
  T("elastic-bounce", "Elastic Bounce", "Social Media", "elastic-bounce", "Words drop from above with a rubbery overshoot and squash on landing.", "Montserrat", { fontWeight: 800, fontSize: 70, uppercase: true, strokeWidth: 7, highlightColor: "#ff4d6d" }, ["bouncy", "fun"]),
  T("karaoke", "Karaoke Highlight", "Social Media", "karaoke", "A colour fill travels through each word exactly as it is spoken.", "Poppins", { fontSize: 68, strokeWidth: 6, highlightColor: "#22e58a" }, ["sing", "lyrics", "fill"]),
  T("active-glow", "Active Word Glow", "Cinematic", "active-glow", "Everything dims except the spoken word, which lights up with a soft halo.", "Inter", { fontWeight: 700, fontSize: 62, color: "#e8ecff", highlightColor: "#7cf4ff", shadow: null }, ["glow", "halo"]),
  T("spring-motion", "Spring Motion", "Social Media", "spring-motion", "The block springs up from below while words swing in from alternating sides.", "Poppins", { fontSize: 66, strokeWidth: 5, highlightColor: "#ff9f1c" }, ["energetic"]),
  T("slide-up", "Slide Up", "Minimal", "slide-up", "Each word rises out of an invisible mask line - crisp and quiet.", "Inter", { fontWeight: 700, fontSize: 58, highlightColor: "#a5f3fc", shadow: null }, ["mask", "reveal"]),
  T("slide-down", "Slide Down", "Podcast", "slide-down", "Lines drift down into place one after another with a soft blur settle.", "Space Grotesk", { fontWeight: 700, fontSize: 56, highlightColor: "#ffb4a2", maxWordsPerLine: 4 }, ["talk", "interview"]),
  T("blur-reveal", "Blur Reveal", "Cinematic", "blur-reveal", "Words condense out of a heavy blur, like a lens pulling focus.", "DM Serif Display", { fontWeight: 400, fontSize: 66, color: "#f5f1e8", highlightColor: "#ffd9a0", shadow: { color: "rgba(0,0,0,.6)", blur: 22, offsetX: 0, offsetY: 6 } }, ["focus", "film"]),
  T("fade-in", "Fade In", "Minimal", "fade-in", "A calm cross-fade. The spoken word is bright; the rest rests at lower opacity.", "Inter", { fontWeight: 700, fontSize: 54, highlightColor: "#cfe8ff", maxWordsPerLine: 5, wordsPerGroup: 7 }, ["subtle", "simple"], { x: 0.5, y: 0.8 }),
  T("typewriter", "Typewriter", "Educational", "typewriter", "Glyph-by-glyph typing with a blinking caret, timed to the speech.", "JetBrains Mono", { fontWeight: 700, fontSize: 50, color: "#e6edf3", highlightColor: "#3fb950", shadow: null, backgroundColor: "transparent", maxWordsPerLine: 4 }, ["code", "tutorial"]),
  T("char-stagger", "Character Stagger", "Social Media", "char-stagger", "Every letter hops in with its own spring, rippling across the word.", "Montserrat", { fontWeight: 800, fontSize: 66, uppercase: true, strokeWidth: 6, highlightColor: "#00e5ff" }, ["letters", "wave"]),
  T("word-rotation", "Word Rotation", "Bold", "word-rotation", "Words flip upright in 3D, hinged on their baseline.", "Oswald", { fontWeight: 700, fontSize: 78, uppercase: true, strokeWidth: 5, highlightColor: "#ffb703" }, ["flip", "3d"]),
  T("smooth-tracking", "Smooth Tracking", "Podcast", "smooth-tracking", "Words glide together from a wide spread into a tight line.", "Space Grotesk", { fontWeight: 500, fontSize: 52, uppercase: true, letterSpacing: 0.08, highlightColor: "#9be7ff", shadow: null, maxWordsPerLine: 4 }, ["tracking", "title"]),
  T("cinematic-serif", "Cinematic Serif", "Cinematic", "cinematic-serif", "Italic serif lines with a slow push-in and gold hairlines drawing above and below.", "Cormorant Garamond", { fontWeight: 700, fontSize: 80, italic: true, color: "#f6efe3", highlightColor: "#d9b46a", animationDurationMs: 700, lineHeight: 1.05 }, ["film", "movie", "trailer"], { x: 0.5, y: 0.82 }),
  T("minimal-editorial", "Minimal Editorial", "Minimal", "minimal-editorial", "Left-aligned uppercase text wipes in beside a growing accent bar.", "Inter", { fontWeight: 700, fontSize: 46, uppercase: true, letterSpacing: 0.1, align: "left", highlightColor: "#ff5a36", shadow: null, maxWordsPerLine: 4 }, ["magazine", "editorial"]),
  T("bold-creator", "Bold Creator", "Bold", "bold-creator", "The block cuts in hard; the active word jumps, tilts and turns lime.", "Anton", { fontWeight: 400, fontSize: 88, uppercase: true, strokeWidth: 9, highlightColor: "#c6ff00", shadow: hardShadow, lineHeight: 1.05 }, ["youtube", "creator", "hormozi"]),
  T("neon-pulse", "Neon Pulse", "Neon", "neon-pulse", "A buzzing neon tube with a breathing glow and a power-on flicker.", "Orbitron", { fontWeight: 700, fontSize: 58, color: "#fdf0ff", highlightColor: "#ff2bd6", shadow: null, maxWordsPerLine: 3 }, ["glow", "cyberpunk"]),
  T("gradient-highlight", "Gradient Highlight", "Neon", "gradient-highlight", "A liquid-metal shine sweeps through the spoken word.", "Poppins", { fontSize: 70, highlightColor: "#ff5ea8", strokeWidth: 0, shadow: { color: "rgba(0,0,0,.5)", blur: 16, offsetX: 0, offsetY: 4 } }, ["shine", "gradient"]),
  T("background-pill", "Background Pill", "Social Media", "background-pill", "A rounded pill springs in behind the spoken word.", "Poppins", { fontWeight: 700, fontSize: 60, highlightColor: "#ffd60a", shadow: { color: "rgba(0,0,0,.6)", blur: 10, offsetX: 0, offsetY: 3 }, maxWordsPerLine: 3 }, ["pill", "label"]),
  T("animated-underline", "Animated Underline", "Educational", "animated-underline", "A coloured underline draws itself beneath each word as it is said.", "Inter", { fontWeight: 800, fontSize: 60, highlightColor: "#ff6b6b" }, ["lecture", "explain"]),
  T("highlight-sweep", "Highlight Sweep", "Educational", "highlight-sweep", "A marker-style block sweeps behind each word, like a highlighter pen.", "Poppins", { fontWeight: 700, fontSize: 62, highlightColor: "#7c3aed", shadow: null }, ["marker", "notes"]),
  T("vertical-stack", "Vertical Word Stack", "Bold", "vertical-stack", "A single column: the new word pushes earlier ones up as they shrink and fade.", "Anton", { fontWeight: 400, fontSize: 104, uppercase: true, strokeWidth: 7, highlightColor: "#ff3d71", lineHeight: 0.95, shadow: hardShadow }, ["stack", "column"], { x: 0.5, y: 0.68 }),
  T("retro-subtitle", "Retro Subtitle", "Gaming", "retro-subtitle", "Pixel type on a dark console strip with stepped blink-in and CRT scanlines.", "VT323", { fontWeight: 400, fontSize: 70, color: "#ffe94d", highlightColor: "#ffffff", backgroundColor: "rgba(8,6,20,0.78)", shadow: { color: "#000000", blur: 0, offsetX: 3, offsetY: 3 }, maxWordsPerLine: 5, wordsPerGroup: 7 }, ["arcade", "8bit", "pixel"], { x: 0.5, y: 0.84 }),
  T("comic-bounce", "Comic Bounce", "Social Media", "comic-bounce", "Cartoon squash-and-stretch jumps with a different tilt on every word.", "Bangers", { fontWeight: 400, fontSize: 78, strokeWidth: 9, highlightColor: "#ffe14d", shadow: hardShadow, letterSpacing: 0.02 }, ["cartoon", "comic"]),
  T("soft-shadow-pop", "Soft Shadow Pop", "Corporate", "soft-shadow-pop", "Words ease up from the surface while a soft shadow deepens beneath them.", "Poppins", { fontWeight: 700, fontSize: 64, highlightColor: "#ffffff", shadow: null }, ["elegant", "lift"]),
  T("glitch-accent", "Glitch Accent", "Gaming", "glitch-accent", "RGB-split jitter and sliced scanlines punch each word in, then settle.", "Space Grotesk", { fontWeight: 700, fontSize: 62, uppercase: true, highlightColor: "#00ffe1", shadow: null }, ["glitch", "cyber", "vhs"]),
  T("luxury-title", "Luxury Title", "Luxury", "luxury-title", "Widely tracked gilded capitals fade in letter by letter between two golden rules.", "Cinzel", { fontWeight: 700, fontSize: 54, letterSpacing: 0.14, uppercase: true, highlightColor: "#d4af37", shadow: null, animationDurationMs: 600, wordsPerGroup: 4, maxWordsPerLine: 3 }, ["gold", "fashion", "premium"]),
  T("kinetic-multi-line", "Kinetic Multi-Line", "Bold", "kinetic-multi-line", "Words are sized by weight and slide in from alternating sides across staggered lines.", "Archivo Black", { fontWeight: 400, fontSize: 64, uppercase: true, highlightColor: "#ffd60a", maxWordsPerLine: 2, maxLines: 3, wordsPerGroup: 6, lineHeight: 1.0, strokeWidth: 4 }, ["typography", "kinetic"], { x: 0.5, y: 0.62 }),
  T("impact-caption", "Impact Caption", "Bold", "impact-caption", "One giant word at a time, slamming in with a camera shake.", "Anton", { fontWeight: 400, fontSize: 150, uppercase: true, strokeWidth: 12, highlightColor: "#ffd60a", shadow: hardShadow, wordsPerGroup: 4, maxWordsPerLine: 1, maxLines: 1 }, ["slam", "impact", "meme"], { x: 0.5, y: 0.6 }),

  // Variants that fill out the categories (same engine, different look & timing)
  T("lux-gilded", "Gilded Whisper", "Luxury", "blur-reveal", "Italic Playfair in champagne gold that resolves out of a soft blur.", "Playfair Display", { fontWeight: 700, italic: true, fontSize: 64, color: "#fff4d6", highlightColor: "#e5c07b", animationDurationMs: 650, shadow: { color: "rgba(0,0,0,.55)", blur: 20, offsetX: 0, offsetY: 4 } }, ["gold", "serif"]),
  T("lux-quiet", "Quiet Luxury", "Luxury", "fade-in", "Barely-there serif fade for high-end product and lifestyle footage.", "DM Serif Display", { fontWeight: 400, fontSize: 58, color: "#f3efe6", highlightColor: "#ffffff", animationDurationMs: 800, shadow: null, maxWordsPerLine: 4 }, ["serif", "boutique"], { x: 0.5, y: 0.82 }),
  T("corp-clean", "Clean Rise", "Corporate", "slide-up", "Neat sans captions that rise from a baseline mask, with a brand-blue active word.", "Inter", { fontWeight: 700, fontSize: 56, highlightColor: "#5ab0ff", maxWordsPerLine: 4 }, ["brand", "presentation"]),
  T("pod-karaoke", "Podcast Karaoke", "Podcast", "karaoke", "Follow-along fill in a friendly grotesque, three words to a line.", "Space Grotesk", { fontWeight: 700, fontSize: 58, highlightColor: "#ffcf5a", strokeWidth: 4, maxWordsPerLine: 3 }, ["audiogram"]),
  T("game-arcade", "Arcade Neon", "Gaming", "neon-pulse", "Acid-green arcade tube lettering that flickers on.", "Orbitron", { fontWeight: 900, fontSize: 54, color: "#e6ffe0", highlightColor: "#39ff14", shadow: null, uppercase: true }, ["neon", "stream"]),
  T("edu-steps", "Step by Step", "Educational", "vertical-stack", "A rolling column of key words, good for lists and definitions.", "Montserrat", { fontWeight: 800, fontSize: 76, uppercase: true, highlightColor: "#4ade80", strokeWidth: 0, lineHeight: 1.0 }, ["list", "steps"], { x: 0.5, y: 0.68 }),

  // Malayalam Reels - Malayalam-first fonts, animations that never split or space glyph clusters
  T("ml-reel-pop", "Reel Pop", "Malayalam Reels", "word-pop", "Anek Malayalam heavy weight with a springy pop - made for Malayalam reels.", "Anek Malayalam", { fontWeight: 800, fontSize: 74, strokeWidth: 6, highlightColor: "#ffd60a" }, ["malayalam", "reel"]),
  T("ml-reel-karaoke", "Reel Karaoke", "Malayalam Reels", "karaoke", "Pink karaoke fill across Malayalam words.", "Anek Malayalam", { fontWeight: 800, fontSize: 70, strokeWidth: 6, highlightColor: "#ff5d8f" }, ["malayalam"]),
  T("ml-reel-pill", "Reel Pill", "Malayalam Reels", "background-pill", "WhatsApp-green pill follows the spoken word.", "Noto Sans Malayalam", { fontWeight: 700, fontSize: 60, highlightColor: "#25d366" }, ["malayalam"]),
  T("ml-reel-sweep", "Reel Highlighter", "Malayalam Reels", "highlight-sweep", "Orange marker sweep behind Malayalam text.", "Anek Malayalam", { fontWeight: 800, fontSize: 66, highlightColor: "#ff3d00", shadow: null }, ["malayalam", "marker"]),
  T("ml-reel-glow", "Reel Glow", "Malayalam Reels", "active-glow", "Warm glow on the word being spoken.", "Noto Sans Malayalam", { fontWeight: 700, fontSize: 64, highlightColor: "#ffe066", shadow: null }, ["malayalam", "glow"]),
  T("ml-reel-bounce", "Reel Bounce", "Malayalam Reels", "elastic-bounce", "Rubbery drop-in for punchy Malayalam captions.", "Anek Malayalam", { fontWeight: 800, fontSize: 72, uppercase: false, strokeWidth: 6, highlightColor: "#00e0ff" }, ["malayalam", "bounce"]),

  // ── Added with the caption-engine upgrade: the remaining behaviours of the "core 30" list ──
  T("color-switch", "Color Switch", "Social Media", "color-switch", "Every spoken word lands in a new colour from a hue-rotated palette, with a white flash and a tick of scale.", "Poppins", { fontSize: 70, strokeWidth: 6, highlightColor: "#ff3b8d" }, ["colour", "rainbow", "multicolor"]),
  T("sliding-box", "Moving Box", "Social Media", "sliding-box", "One rounded highlight box glides from word to word on a spring, resizing to fit each word.", "Poppins", { fontWeight: 700, fontSize: 60, highlightColor: "#ffd60a", shadow: { color: "rgba(0,0,0,.6)", blur: 10, offsetX: 0, offsetY: 3 }, maxWordsPerLine: 3 }, ["box", "highlight", "slide"]),
  T("squash-stretch", "Squash & Stretch", "Social Media", "squash-stretch", "Words stretch as they fall, squash flat on impact and settle back - volume-preserving cartoon physics.", "Montserrat", { fontWeight: 800, fontSize: 68, textTransform: "uppercase", strokeWidth: 6, highlightColor: "#7cf4ff" }, ["cartoon", "physics"]),
  T("bouncy-lines", "Bouncy Lines", "Social Media", "bouncy-lines", "Each line bounces in as a unit; the letters ride a decaying wave across it.", "Poppins", { fontWeight: 800, fontSize: 72, strokeWidth: 6, highlightColor: "#ffd60a", maxWordsPerLine: 2, maxLines: 3, wordsPerGroup: 6 }, ["multiline", "wave"], { x: 0.5, y: 0.66 }),
  T("yellow-emphasis", "Yellow Emphasis", "Social Media", "yellow-emphasis", "Three reading states: upcoming words dim, the spoken word snaps to yellow with a glow, finished words go white.", "Montserrat", { fontWeight: 800, fontSize: 66, textTransform: "uppercase", strokeWidth: 7, highlightColor: "#ffe14d" }, ["yellow", "classic", "emphasis"]),
  T("bold-cinematic", "Bold Cinematic", "Cinematic", "bold-cinematic", "Heavy condensed capitals focus in word by word under a slow push-in, with an anamorphic light streak.", "Oswald", { fontWeight: 700, fontSize: 86, textTransform: "uppercase", letterSpacing: 0.05, highlightColor: "#ffb347", animationDurationMs: 650, maxWordsPerLine: 3, shadow: null }, ["trailer", "movie", "heavy"], { x: 0.5, y: 0.78 }),
  T("editorial-serif", "Editorial Serif", "Minimal", "minimal-editorial", "A serif pull-quote that wipes in beside a vermilion rule - magazine typography for video.", "Playfair Display", { fontWeight: 700, fontSize: 60, align: "left", highlightColor: "#d9573c", shadow: null, maxWordsPerLine: 4, letterSpacing: 0 }, ["serif", "magazine", "quote"]),
  T("minimal-white", "Minimal White", "Minimal", "fade-in", "Plain white sans on a calm cross-fade. No stroke, no colour, nothing to distract.", "Inter", { fontWeight: 400, fontSize: 52, highlightColor: "#ffffff", strokeWidth: 0, maxWordsPerLine: 5, wordsPerGroup: 8, shadow: { color: "rgba(0,0,0,.45)", blur: 12, offsetX: 0, offsetY: 2 } }, ["white", "clean", "subtle"], { x: 0.5, y: 0.82 }),
  T("abril-pop", "Abril Pop", "Luxury", "soft-shadow-pop", "High-contrast Abril Fatface display type rising on a deepening soft shadow.", "Abril Fatface", { fontWeight: 400, fontSize: 76, color: "#fff4e6", highlightColor: "#ff9f68", shadow: null }, ["didone", "fashion", "headline"]),

  // ═══ Phase 2: reference-driven style families (docs/REFERENCE_STYLE_ANALYSIS.md) ═══
  // Family A - Bold Kinetic (reference 1)
  T("bold-white-kinetic", "Bold White Kinetic", "Bold Kinetic", "kinetic-center", "One giant heavy word at a time: hard cut in, spring up from small, zoom-blur out as the next word lands.", "Inter", { fontWeight: 900, fontSize: 210, letterSpacing: -0.045, lineHeight: 0.9, animationDurationMs: 380, springStiffness: 340, springDamping: 9, wordsPerGroup: 6, look: LOOKS.heavyWhite, shadow: null }, ["giant", "word by word", "kinetic"], { x: 0.5, y: 0.56 }),
  T("kinetic-scatter", "Kinetic Scatter", "Bold Kinetic", "kinetic-scatter", "Words cut in at staggered spots around the frame, sized by weight; keywords in warm yellow. Made to sit around a subject.", "Inter", { fontWeight: 900, fontSize: 132, letterSpacing: -0.04, lineHeight: 0.92, wordsPerGroup: 5, look: LOOKS.heavyWhite, emphasis: { mode: "auto", maxPerGroup: 2, minLength: 4 }, emphasisLook: { color: "#f8d53a" }, shadow: null }, ["scatter", "around subject"], { x: 0.5, y: 0.5 }),
  T("zoomed-keyword", "Zoomed Keyword", "Bold Kinetic", "zoom-keyword", "A camera-style zoom on the spoken word while the rest dims and shuffles aside.", "Montserrat", { fontWeight: 800, fontSize: 84, highlightColor: "#f8d53a", strokeWidth: 0, look: LOOKS.heavyWhite, shadow: null, maxWordsPerLine: 4, scaleIntensity: 1 }, ["zoom", "emphasis"], { x: 0.5, y: 0.7 }),
  T("word-stretch", "Word Stretch", "Bold Kinetic", "stretch", "Rubber-band entrance: each word starts wide and flat, then snaps to size with overshoot.", "Archivo Black", { fontWeight: 400, fontSize: 96, highlightColor: "#f8d53a", springStiffness: 230, springDamping: 6, look: LOOKS.heavyWhite, shadow: null, textTransform: "uppercase", maxWordsPerLine: 2 }, ["elastic", "stretch"], { x: 0.5, y: 0.6 }),

  // Family B - Neon Effects (reference 3)
  T("neon-cyan-glow", "Neon Cyan Glow", "Neon FX", "neon-flicker", "Azure-to-ice gradient tube with a cyan halo, power-on flicker and a diagonal shine sweep.", "Montserrat", { fontWeight: 800, fontSize: 76, color: "#eaffff", highlightColor: "#00cfff", look: LOOKS.neonCyan, shadow: null, textTransform: "uppercase", letterSpacing: 0.02 }, ["cyan", "neon", "shine"], { x: 0.5, y: 0.68 }),
  T("pink-gradient-pop", "Pink Gradient Pop", "Neon FX", "word-pop", "Pink-to-violet gradient that keeps sliding through the letters while each word pops in.", "Poppins", { fontWeight: 800, fontSize: 80, look: LOOKS.pinkPop, shadow: null, strokeWidth: 0 }, ["pink", "purple", "gradient"], { x: 0.5, y: 0.7 }),
  T("rainbow-gradient-shine", "Rainbow Gradient Shine", "Neon FX", "smooth-scale", "A rainbow that flows through the type with a white shine band racing across it.", "Poppins", { fontWeight: 800, fontSize: 78, look: LOOKS.rainbow, shadow: null }, ["rainbow", "shine"], { x: 0.5, y: 0.7 }),
  T("glow-pulse", "Glow Pulse", "Neon FX", "glow-flash", "Each spoken word takes a glow flash that decays into a slow breathing violet halo.", "Poppins", { fontWeight: 700, fontSize: 72, color: "#ffffff", highlightColor: "#b36bff", look: { color: "#ffffff", glow: { color: "#b36bff", blur: 30, strength: 3, pulse: 0.3, hz: 0.9 }, stroke: { color: "#1a0a33", width: 2.5 }, shadows: [{ color: "rgba(0,0,0,0.7)", blur: 8, x: 0, y: 2 }] }, shadow: null }, ["glow", "pulse", "violet"], { x: 0.5, y: 0.7 }),
  T("floating-word-motion", "Floating Word Motion", "Neon FX", "float", "Words rise in, then drift on slow sine paths with parallax and a minty glow - nothing ever sits still.", "Poppins", { fontWeight: 600, fontSize: 70, look: { color: "#ffffff", glow: { color: "#3de2c0", blur: 20, strength: 2, pulse: 0.15, hz: 0.6 }, stroke: { color: "#06241f", width: 2.5 }, shadows: [{ color: "rgba(0,0,0,0.7)", blur: 8, x: 0, y: 2 }] }, shadow: null, maxWordsPerLine: 3 }, ["float", "drift", "mint"], { x: 0.5, y: 0.7 }),

  // Family C - Creator Captions (reference 4)
  T("green-italic-impact", "Green Italic Impact", "Creator", "bold-cut", "Bold white subtitles; the keyword is swapped for neon-green bold serif italic that rises in letter by letter, with lime glow and offset depth.", "Inter", { fontWeight: 900, fontSize: 108, letterSpacing: -0.02, look: LOOKS.heavyWhite, emphasis: { mode: "auto", maxPerGroup: 1, minLength: 5 }, emphasisLook: LOOKS.greenItalic, shadow: null, maxWordsPerLine: 3, wordsPerGroup: 4, animationDurationMs: 520 }, ["green", "italic", "serif", "keyword"], { x: 0.5, y: 0.66 }),
  T("purple-3d-punch", "Purple 3D Punch", "Creator", "punch", "Violet gradient letters with real depth: they land from huge and turned, the extrusion growing as they hit.", "Archivo Black", { fontWeight: 400, fontSize: 92, textTransform: "uppercase", look: LOOKS.purple3d, shadow: null, springStiffness: 300, springDamping: 8, maxWordsPerLine: 2 }, ["purple", "3d", "extrude", "punch"], { x: 0.5, y: 0.66 }),
  T("yellow-active-word", "Yellow Active Word", "Creator", "color-lerp", "Plain white subtitles; the spoken word melts to warm yellow and back to white - smooth, never a snap.", "Inter", { fontWeight: 800, fontSize: 104, highlightColor: "#f8d53a", look: LOOKS.heavyWhite, shadow: null, highlightMs: 160, maxWordsPerLine: 3 }, ["white", "yellow", "active word"], { x: 0.5, y: 0.7 }),
  T("elastic-word-bounce", "Elastic Word Bounce", "Creator", "hop", "Words hop along an arc from the previous word and land with an elastic squash.", "Poppins", { fontWeight: 800, fontSize: 96, highlightColor: "#ffd60a", strokeWidth: 5, shadow: { color: "#000000", blur: 0, offsetX: 3, offsetY: 5 } }, ["hop", "elastic", "bounce"], { x: 0.5, y: 0.7 }),
  T("animated-color-flip", "Animated Color Flip", "Creator", "flip", "Each word flips over its horizontal axis and comes back in the accent colour.", "Montserrat", { fontWeight: 800, fontSize: 90, textTransform: "uppercase", highlightColor: "#ff4d6d", strokeWidth: 4, shadow: { color: "rgba(0,0,0,.6)", blur: 12, offsetX: 0, offsetY: 4 } }, ["flip", "colour change"], { x: 0.5, y: 0.7 }),
  T("creator-keyword-pop", "Keyword Enlarge", "Creator", "bold-cut", "Clean white subtitles where the key word of every phrase is enlarged, turned yellow and popped in.", "Montserrat", { fontWeight: 800, fontSize: 98, look: LOOKS.heavyWhite, emphasis: { mode: "auto", maxPerGroup: 1, minLength: 4 }, emphasisLook: { sizeScale: 1.7, color: "#f8d53a", animationId: "word-pop", rotate: -3 }, shadow: null, wordsPerGroup: 4 }, ["keyword", "enlarge", "emphasis"], { x: 0.5, y: 0.68 }),

  // Family D - Cinematic Typography (references 1 and 2)
  T("cinematic-giant-headline", "Cinematic Giant Headline", "Cinematic Type", "cinematic-headline", "Oversized condensed capitals in white and golden-yellow italic: focus in from blur, slow push, then recede into depth with a bloom.", "Anton", { fontWeight: 400, fontSize: 230, textTransform: "uppercase", lineHeight: 0.95, letterSpacing: -0.01, look: LOOKS.heavyWhite, emphasis: { mode: "auto", maxPerGroup: 1, minLength: 4 }, emphasisLook: LOOKS.headlineYellow, shadow: null, maxWordsPerLine: 2, exitMs: 340, animationDurationMs: 420, wordsPerGroup: 4 }, ["headline", "giant", "yellow", "recede"], { x: 0.5, y: 0.44 }),
  { ...T("behind-person-typography", "Behind-Person Typography", "Cinematic Type", "depth-push", "Giant heavy words settle in on a slow dolly-out, sitting BEHIND the speaker when a subject matte exists.", "Inter", { fontWeight: 900, fontSize: 250, letterSpacing: -0.05, lineHeight: 0.88, look: { color: "#ffffff" }, shadow: null, maxWordsPerLine: 2, wordsPerGroup: 3, animationDurationMs: 520 }, ["behind", "depth", "giant", "mask"], { x: 0.5, y: 0.4 }), behindSubject: true },
  T("perspective-title", "Perspective Title", "Cinematic Type", "perspective-fly", "Gold letters fly out of depth into a tilted 3D space with depth and a glossy floor reflection.", "Montserrat", { fontWeight: 800, fontSize: 112, textTransform: "uppercase", letterSpacing: 0.04, look: LOOKS.gold, shadow: null, maxWordsPerLine: 2 }, ["3d", "perspective", "reflection", "gold"], { x: 0.5, y: 0.52 }),
  T("deep-text-extrusion", "Deep Text Extrusion", "Cinematic Type", "extrude-sway", "A thick, hard extrusion in red-brown that sways in 3D - the depth turns with the letters.", "Archivo Black", { fontWeight: 400, fontSize: 112, textTransform: "uppercase", look: LOOKS.deepExtrude, shadow: null, maxWordsPerLine: 2 }, ["extrude", "depth", "3d"], { x: 0.5, y: 0.6 }),
  T("smooth-editorial-reveal", "Smooth Editorial Reveal", "Cinematic Type", "editorial-reveal", "Light sans lines rise from a clip mask; keywords switch to golden serif italic; a rule draws underneath.", "Inter", { fontWeight: 500, fontSize: 80, align: "left", highlightColor: "#f8d53a", look: { color: "#ffffff", shadows: [{ color: "rgba(0,0,0,.45)", blur: 18, x: 0, y: 3 }] }, emphasis: { mode: "auto", maxPerGroup: 1, minLength: 5 }, emphasisLook: { fontFamily: stack("Playfair Display"), fontWeight: 700, fontStyle: "italic", color: "#f8d53a", sizeScale: 1.22 }, shadow: null, maxWordsPerLine: 4, wordsPerGroup: 6 }, ["editorial", "serif", "reveal"], { x: 0.5, y: 0.74 }),
  T("chrome-metallic-text", "Chrome Metallic Text", "Cinematic Type", "blur-reveal", "Banded chrome italic with a dark edge and a specular band sweeping through it.", "Playfair Display", { fontWeight: 900, fontSize: 92, look: { ...LOOKS.chrome, fontStyle: "italic" }, shadow: null, maxWordsPerLine: 3 }, ["chrome", "metal", "silver"], { x: 0.5, y: 0.66 }),
  T("smooth-shadow-reveal", "Smooth Shadow Reveal", "Cinematic Type", "shadow-reveal", "Words fade up out of blur while a long soft shadow collapses underneath them.", "Poppins", { fontWeight: 700, fontSize: 84, look: LOOKS.longShadow, shadow: null, maxWordsPerLine: 3, animationDurationMs: 520 }, ["shadow", "soft", "reveal"], { x: 0.5, y: 0.66 }),
];

export const TEMPLATE_MAP: Record<string, CaptionTemplate> = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
export const DEFAULT_TEMPLATE_ID = "word-pop";

export function getTemplate(id: string | null | undefined): CaptionTemplate {
  return (id && TEMPLATE_MAP[id]) || TEMPLATE_MAP[DEFAULT_TEMPLATE_ID];
}

/** Effective style for a caption: its own template if it overrides one, else the project style + user overrides. */
export function resolveStyle(project: CaptionStyleState, captionStyleId: string | null): { style: StyleProps; template: CaptionTemplate } {
  if (captionStyleId && captionStyleId !== project.templateId) {
    const t = getTemplate(captionStyleId);
    return { style: t.style, template: t };
  }
  const t = getTemplate(project.templateId);
  return { style: { ...t.style, ...project.overrides }, template: t };
}

export function searchTemplates(query: string, category: Category | "All"): CaptionTemplate[] {
  const q = query.trim().toLowerCase();
  return TEMPLATES.filter((t) => (category === "All" || t.category === category) && (!q || [t.name, t.description, t.category, ...t.keywords].join(" ").toLowerCase().includes(q)));
}
