import type { ArtModule } from "./types";

/** Each design's artwork is its own chunk, fetched only when that design is previewed. */
export const ART: Record<string, () => Promise<{ default: ArtModule }>> = {
  "moonlit-mahal": () => import("./scenes/moonlit-mahal"),
  "velvet-opera": () => import("./scenes/velvet-opera"),
  "ivory-wax-seal": () => import("./scenes/ivory-wax-seal"),
  "rose-garden": () => import("./scenes/rose-garden"),
  "jasmine-moon": () => import("./scenes/jasmine-moon"),
  "silk-ribbon": () => import("./scenes/silk-ribbon"),
  "pearl-vellum": () => import("./scenes/pearl-vellum"),
  "royal-emerald": () => import("./scenes/royal-emerald"),
  "golden-palace": () => import("./scenes/golden-palace"),
  "garden-swing": () => import("./scenes/garden-swing"),
  "cherry-blossom": () => import("./scenes/cherry-blossom"),
  "marigold-celebration": () => import("./scenes/marigold-celebration"),
  "celestial-veil": () => import("./scenes/celestial-veil"),
  "botanical-vow": () => import("./scenes/botanical-vow"),
  "temple-heritage": () => import("./scenes/temple-heritage"),
  "kerala-ivory": () => import("./scenes/kerala-ivory"),
  "scenic-romance": () => import("./scenes/scenic-romance"),
};

export function loadArt(slug: string): Promise<ArtModule> {
  const load = ART[slug];
  if (!load) return Promise.reject(new Error(`No artwork registered for "${slug}"`));
  return load().then((m) => m.default);
}
