/**
 * The "core 30" caption presets: one entry per named motion style. Every entry must resolve to a template
 * whose animation behaviour is UNIQUE within the list (enforced by tests), so no two presets share motion.
 */
import { TEMPLATE_MAP, type CaptionTemplate } from "./registry";

export const CORE_30: { n: number; label: string; templateId: string }[] = [
  { n: 1, label: "Karaoke word highlighting", templateId: "karaoke" },
  { n: 2, label: "Animated color switching", templateId: "color-switch" },
  { n: 3, label: "Spring word pop", templateId: "word-pop" },
  { n: 4, label: "Elastic bounce", templateId: "elastic-bounce" },
  { n: 5, label: "Smooth scaling", templateId: "smooth-scale" },
  { n: 6, label: "Blur reveal", templateId: "blur-reveal" },
  { n: 7, label: "Cinematic fade", templateId: "cinematic-serif" },
  { n: 8, label: "Word slide", templateId: "slide-up" },
  { n: 9, label: "Gradient sweep", templateId: "gradient-highlight" },
  { n: 10, label: "Neon active-word glow", templateId: "neon-pulse" },
  { n: 11, label: "Moving background boxes", templateId: "sliding-box" },
  { n: 12, label: "Animated underline", templateId: "animated-underline" },
  { n: 13, label: "Text squash and stretch", templateId: "squash-stretch" },
  { n: 14, label: "Typewriter", templateId: "typewriter" },
  { n: 15, label: "Letter-by-letter reveal", templateId: "char-stagger" },
  { n: 16, label: "Rotating words", templateId: "word-rotation" },
  { n: 17, label: "Bouncy multiline captions", templateId: "bouncy-lines" },
  { n: 18, label: "Editorial serif titles", templateId: "editorial-serif" },
  { n: 19, label: "Minimal white typography", templateId: "minimal-white" },
  { n: 20, label: "Yellow active-word emphasis", templateId: "yellow-emphasis" },
  { n: 21, label: "Shadow pop", templateId: "soft-shadow-pop" },
  { n: 22, label: "Kinetic headline", templateId: "kinetic-multi-line" },
  { n: 23, label: "Glitch accent", templateId: "glitch-accent" },
  { n: 24, label: "Retro subtitles", templateId: "retro-subtitle" },
  { n: 25, label: "Animated pill highlighting", templateId: "background-pill" },
  { n: 26, label: "Vertical stacked words", templateId: "vertical-stack" },
  { n: 27, label: "Smooth word tracking", templateId: "smooth-tracking" },
  { n: 28, label: "Comic caption bounce", templateId: "comic-bounce" },
  { n: 29, label: "Bold cinematic typography", templateId: "bold-cinematic" },
  { n: 30, label: "Luxury minimal captions", templateId: "luxury-title" },
];

export const CORE_30_TEMPLATES: CaptionTemplate[] = CORE_30.map((p) => TEMPLATE_MAP[p.templateId]);
