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
  /** SPDX id taken from each font package's own package.json (checked at build time by tests). */
  license: "OFL-1.1" | "Apache-2.0";
  /** npm package that ships the (unmodified) font files */
  source: string;
}

export const FONT_OPTIONS: FontOption[] = [
  { family: "Inter", label: "Inter", weights: [400, 700, 800, 900], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/inter" },
  { family: "Poppins", label: "Poppins", weights: [500, 700, 800], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/poppins" },
  { family: "Montserrat", label: "Montserrat", weights: [700, 800], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/montserrat" },
  { family: "Abril Fatface", label: "Abril Fatface", weights: [400], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/abril-fatface" },
  { family: "Anton", label: "Anton", weights: [400], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/anton" },
  { family: "Bebas Neue", label: "Bebas Neue", weights: [400], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/bebas-neue" },
  { family: "Archivo Black", label: "Archivo Black", weights: [400], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/archivo-black" },
  { family: "Oswald", label: "Oswald", weights: [500, 700], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/oswald" },
  { family: "Space Grotesk", label: "Space Grotesk", weights: [500, 700], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/space-grotesk" },
  { family: "JetBrains Mono", label: "JetBrains Mono", weights: [500, 700], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/jetbrains-mono" },
  { family: "Playfair Display", label: "Playfair Display", weights: [400, 700], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/playfair-display" },
  { family: "Cormorant Garamond", label: "Cormorant Garamond", weights: [500, 700], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/cormorant-garamond" },
  { family: "DM Serif Display", label: "DM Serif Display", weights: [400], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/dm-serif-display" },
  { family: "Cinzel", label: "Cinzel", weights: [500, 700], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/cinzel" },
  { family: "Bangers", label: "Bangers", weights: [400], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/bangers" },
  { family: "Permanent Marker", label: "Permanent Marker", weights: [400], scripts: ["latin"], license: "Apache-2.0", source: "@fontsource/permanent-marker" },
  { family: "VT323", label: "VT323 (pixel)", weights: [400], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/vt323" },
  { family: "Orbitron", label: "Orbitron", weights: [700, 900], scripts: ["latin"], license: "OFL-1.1", source: "@fontsource/orbitron" },
  { family: "Anek Malayalam", label: "Anek Malayalam", weights: [600, 800], scripts: ["malayalam", "latin"], license: "OFL-1.1", source: "@fontsource/anek-malayalam" },
  { family: "Noto Sans Malayalam", label: "Noto Sans Malayalam", weights: [500, 700, 900], scripts: ["malayalam"], license: "OFL-1.1", source: "@fontsource/noto-sans-malayalam" },
  { family: "Noto Sans Devanagari", label: "Noto Sans Devanagari", weights: [500, 700, 900], scripts: ["devanagari"], license: "OFL-1.1", source: "@fontsource/noto-sans-devanagari" },
  { family: "Noto Sans Tamil", label: "Noto Sans Tamil", weights: [500, 700, 900], scripts: ["tamil"], license: "OFL-1.1", source: "@fontsource/noto-sans-tamil" },
];

/** Extract the primary family from a CSS stack produced by `stack()`. */
export function primaryFamily(fontStack: string): string {
  const m = fontStack.match(/^\s*"?([^",]+)"?/);
  return m ? m[1].trim() : "Inter";
}
