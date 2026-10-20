/**
 * Font registry. All fonts are SIL OFL 1.1 (via @fontsource), bundled locally - nothing is fetched at
 * render time. Every stack ends with Noto Sans Malayalam / Devanagari / Tamil so Indic text always
 * has glyph coverage (the browser falls back per glyph).
 */
export const INDIC_FALLBACK = `"Noto Sans Malayalam", "Noto Sans Devanagari", "Noto Sans Tamil", "Inter", sans-serif`;
export const stack = (primary: string) => `"${primary}", ${INDIC_FALLBACK}`;

export interface FontOption {
  family: string;
  label: string;
  weights: number[];
  scripts: ("latin" | "malayalam" | "devanagari" | "tamil")[];
}

export const FONT_OPTIONS: FontOption[] = [
  { family: "Inter", label: "Inter", weights: [400, 700, 800, 900], scripts: ["latin"] },
  { family: "Poppins", label: "Poppins", weights: [500, 700, 800], scripts: ["latin"] },
  { family: "Montserrat", label: "Montserrat", weights: [700, 800], scripts: ["latin"] },
  { family: "Anton", label: "Anton", weights: [400], scripts: ["latin"] },
  { family: "Bebas Neue", label: "Bebas Neue", weights: [400], scripts: ["latin"] },
  { family: "Archivo Black", label: "Archivo Black", weights: [400], scripts: ["latin"] },
  { family: "Oswald", label: "Oswald", weights: [500, 700], scripts: ["latin"] },
  { family: "Space Grotesk", label: "Space Grotesk", weights: [500, 700], scripts: ["latin"] },
  { family: "JetBrains Mono", label: "JetBrains Mono", weights: [500, 700], scripts: ["latin"] },
  { family: "Playfair Display", label: "Playfair Display", weights: [400, 700], scripts: ["latin"] },
  { family: "Cormorant Garamond", label: "Cormorant Garamond", weights: [500, 700], scripts: ["latin"] },
  { family: "DM Serif Display", label: "DM Serif Display", weights: [400], scripts: ["latin"] },
  { family: "Cinzel", label: "Cinzel", weights: [500, 700], scripts: ["latin"] },
  { family: "Bangers", label: "Bangers", weights: [400], scripts: ["latin"] },
  { family: "Permanent Marker", label: "Permanent Marker", weights: [400], scripts: ["latin"] },
  { family: "VT323", label: "VT323 (pixel)", weights: [400], scripts: ["latin"] },
  { family: "Orbitron", label: "Orbitron", weights: [700, 900], scripts: ["latin"] },
  { family: "Anek Malayalam", label: "Anek Malayalam", weights: [600, 800], scripts: ["malayalam", "latin"] },
  { family: "Noto Sans Malayalam", label: "Noto Sans Malayalam", weights: [500, 700, 900], scripts: ["malayalam"] },
  { family: "Noto Sans Devanagari", label: "Noto Sans Devanagari", weights: [500, 700, 900], scripts: ["devanagari"] },
  { family: "Noto Sans Tamil", label: "Noto Sans Tamil", weights: [500, 700, 900], scripts: ["tamil"] },
];

/** Extract the primary family from a CSS stack produced by `stack()`. */
export function primaryFamily(fontStack: string): string {
  const m = fontStack.match(/^\s*"?([^",]+)"?/);
  return m ? m[1].trim() : "Inter";
}
