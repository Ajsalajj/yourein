/**
 * Central template registry. A template = animation behaviour id + a complete set of style properties.
 * Add a template by appending to TEMPLATES; the gallery, editor and exporter pick it up automatically.
 */
import type { CaptionStyleState, StyleProps } from "../../lib/project";
import { stack } from "../fontStacks";

export const CATEGORIES = ["Minimal", "Cinematic", "Bold", "Neon", "Social Media", "Educational", "Luxury", "Corporate", "Gaming", "Podcast", "Malayalam Reels"] as const;
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
