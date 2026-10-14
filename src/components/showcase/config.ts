/** The six designs shown in the scroll-driven homepage showcase, in order. Names, art and prices come from the template data; this file holds only the showcase copy and colours. */
export type ShowcaseItem = {
  slug: string;
  /** Label under the name. */
  category: string;
  line: string;
  /** Section background while this design is on screen. */
  bg: string;
  dark: boolean;
  /** Colour of the wash that crosses the stage as the NEXT design arrives. */
  wash: string;
};

export const SHOWCASE: ShowcaseItem[] = [
  { slug: "ivory-wax-seal", category: "Wedding", line: "Timeless stationery, brought to life.", bg: "#F4EFE6", dark: false, wash: "#F1D9D6" },
  { slug: "rose-garden", category: "Wedding / Engagement", line: "A celebration that blooms as you scroll.", bg: "#F4E5E3", dark: false, wash: "#14213F" },
  { slug: "jasmine-moon", category: "Nikah", line: "A moonlit invitation made for unforgettable Nikah celebrations.", bg: "#0B162C", dark: true, wash: "#1B5A45" },
  { slug: "royal-emerald", category: "Wedding / Nikah", line: "Rich, regal and made to feel unforgettable.", bg: "#12362C", dark: true, wash: "#F0C777" },
  { slug: "golden-palace", category: "Wedding", line: "Grand celebration, crafted in gold.", bg: "#E7D6B9", dark: false, wash: "#FFF4DA" },
  { slug: "scenic-romance", category: "Wedding", line: "A cinematic love story, told one scroll at a time.", bg: "#EBCDB4", dark: false, wash: "#FFFFFF" },
];

/** Where each design's stretch of the master timeline begins and ends (progress 0 to 1). The last 10% is the outro. */
export const SEGMENTS: [number, number][] = [[0, 0.15], [0.15, 0.3], [0.3, 0.45], [0.45, 0.6], [0.6, 0.75], [0.75, 0.9]];
export const OUTRO_START = 0.9;
/** Background the section settles on at the end, matching the band that follows. */
export const OUTRO_BG = "#F3ECDD";

export const LIGHT = { ink: "#26231F", soft: "#5F574C", btnBg: "#26231F", btnFg: "#FBF8F1" };
export const DARK = { ink: "#F4ECD6", soft: "#C4BDA8", btnBg: "#F4ECD6", btnFg: "#0F1B2B" };

/** 0..SHOWCASE.length-1 for a design, SHOWCASE.length for the outro. */
export function indexAt(p: number): number {
  if (p >= OUTRO_START) return SHOWCASE.length;
  return Math.min(SHOWCASE.length - 1, Math.max(0, SEGMENTS.findIndex(([, e]) => p < e)));
}

export type Tier = "full" | "mid" | "light" | "low";
