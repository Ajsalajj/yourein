import type { FlowerKind, GreenColor, PetalColor } from "./art/kit";

type Flora = { mix: [FlowerKind, PetalColor][]; greens: GreenColor[]; petal: PetalColor; dress: [string, string]; sprigs?: number };

/** Which flowers and foliage each design carries through its inner sections. */
export const FLORA: Record<string, Flora> = {
  "ivory-wax-seal": { mix: [["rose", "ivory"], ["rose", "white"], ["blossom", "white"], ["rose", "peach"]], greens: ["sage", "olive"], petal: "ivory", dress: ["#FBF3E4", "#E3CFA8"] },
  "rose-garden": { mix: [["rose", "blush"], ["rose", "rose"], ["rose", "ivory"], ["blossom", "ivory"]], greens: ["sage", "leaf"], petal: "rose", dress: ["#F8D3CF", "#DFA09E"] },
  "jasmine-moon": { mix: [["jasmine", "white"], ["bud", "white"], ["blossom", "night"]], greens: ["night", "deep"], petal: "white", dress: ["#E9DDBD", "#C2A76B"] },
  "royal-emerald": { mix: [["jasmine", "white"], ["rose", "ivory"], ["bud", "white"]], greens: ["emerald", "gilt"], petal: "gold", dress: ["#B5383C", "#7C1D25"] },
  "silk-ribbon": { mix: [["rose", "blush"], ["blossom", "ivory"], ["cherry", "pink"], ["rose", "peach"]], greens: ["sage"], petal: "blush", dress: ["#F6CFC8", "#DC9F99"] },
  "pearl-vellum": { mix: [["orchid", "white"], ["bud", "ivory"], ["orchid", "white"]], greens: ["sage", "gilt"], petal: "white", dress: ["#FBF8F0", "#DDD3BD"] },
  "golden-palace": { mix: [["rose", "peach"], ["rose", "ivory"], ["marigold", "marigold"], ["cherry", "pink"]], greens: ["olive", "gilt"], petal: "rose", dress: ["#C94A4A", "#8E2530"] },
  "garden-swing": { mix: [["rose", "blush"], ["rose", "ivory"], ["blossom", "ivory"], ["rose", "peach"], ["cherry", "pink"]], greens: ["leaf", "sage"], petal: "blush", dress: ["#FBE3DC", "#E3A9A2"] },
  "cherry-blossom": { mix: [["cherry", "pink"], ["cherry", "blush"], ["bud", "pink"]], greens: ["sage"], petal: "pink", dress: ["#FBDDE5", "#E79DB3"] },
  "marigold-celebration": { mix: [["marigold", "marigold"], ["marigold", "saffron"], ["jasmine", "white"]], greens: ["deep", "leaf"], petal: "marigold", dress: ["#C8343A", "#8A1B26"] },
  "celestial-veil": { mix: [["jasmine", "white"], ["bud", "white"], ["blossom", "night"]], greens: ["night", "deep"], petal: "night", dress: ["#E6E0F2", "#A9A6CF"] },
  "botanical-vow": { mix: [["blossom", "white"], ["bud", "ivory"]], greens: ["sage", "moss", "leaf"], petal: "white", dress: ["#FBF8EF", "#D6D9C4"], sprigs: 9 },
  "temple-heritage": { mix: [["marigold", "marigold"], ["jasmine", "white"], ["marigold", "saffron"]], greens: ["deep", "leaf"], petal: "marigold", dress: ["#B5383C", "#7C1D25"] },
  "kerala-ivory": { mix: [["jasmine", "white"], ["bud", "ivory"], ["jasmine", "white"]], greens: ["deep", "leaf"], petal: "white", dress: ["#FBF4DF", "#D9C078"] },
  "scenic-romance": { mix: [["rose", "peach"], ["rose", "blush"], ["blossom", "ivory"]], greens: ["olive", "moss"], petal: "blush", dress: ["#F6D3CB", "#DDA29C"] },
};

/** Blend two hex colours. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}
