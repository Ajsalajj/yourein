import type React from "react";
import type { Template } from "@/data/templates";

export type Anchor = "top" | "mid" | "bottom";

/** The artwork and opening choreography for one invitation design. */
export type ArtModule = {
  /** Layered scene behind the names: the first screen once the invitation is open. */
  Hero: React.FC<{ t: Template }>;
  /** Whatever seals the invitation before the first tap: envelope, doors, ribbon, veil. */
  Cover: React.FC<{ t: Template }>;
  /** Adds the opening animation to the timeline. `root` is the first screen. */
  open: (root: HTMLElement, tl: gsap.core.Timeline) => void;
  /** Where the names sit on the first screen (artboard y, and which edge they hold to). */
  /**
   * `width` is how much of the screen's width the lettering may span (0 to 1) before it is shrunk; set it for arches and plaques.
   * `widthTall` applies instead when long names take more than two lines and so reach further up and down the artwork.
   */
  names: { y: number; anchor: Anchor; scale?: number; width?: number; widthTall?: number };
  /** Names stay visible on the sealed cover (true) or appear only after opening. */
  namesOnCover?: boolean;
  /** Colour of the "tap to open" label on the sealed cover. */
  coverInk?: string;
};

/** CSS position for a point on the 390 x 844 artboard, matching how layers are cropped. */
export function artY(y: number, anchor: Anchor = "mid"): React.CSSProperties {
  if (anchor === "top") return { top: `calc(${y} * 100cqw / 390)` };
  if (anchor === "bottom") return { bottom: `calc(${844 - y} * 100cqw / 390)` };
  return { top: `calc(50% + ${y - 422} * 100cqw / 390)` };
}

export const SVG_ANCHOR = { top: "xMidYMin", mid: "xMidYMid", bottom: "xMidYMax" } as const;
