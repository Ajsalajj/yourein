/** Cinematic title compositions: ready-made text-layer setups that combine behind-subject depth, perspective and motion. */
import { newTextLayer, type TextLayer } from "./project";

export interface TitleComposition {
  id: string;
  name: string;
  description: string;
  needs: "none" | "mask" | "track";
  make: (o: { startMs: number; endMs: number; text: string; trackId?: string }) => TextLayer[];
}

export const TITLE_COMPOSITIONS: TitleComposition[] = [
  {
    id: "behind-headline",
    name: "Behind-the-subject headline",
    description: "Giant condensed title tracks in behind the person; the person stays in front of the letters.",
    needs: "mask",
    make: ({ startMs, endMs, text }) => [newTextLayer({ text, startMs, endMs, x: 0.5, y: 0.34, fontSize: 300, fontFamily: "Anton", fontWeight: 400, textTransform: "uppercase", color: "#ffffff", behind: true, animation: "tracking-in", animMs: 900, letterSpacing: 0.02 })],
  },
  {
    id: "floor-title",
    name: "Spatial floor title",
    description: "Wide gold title lying on the ground plane in 3D perspective, rising in with a soft fade.",
    needs: "none",
    make: ({ startMs, endMs, text }) => [newTextLayer({ text, startMs, endMs, x: 0.5, y: 0.86, fontSize: 130, fontFamily: "Montserrat", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.12, color: "#f2c46d", strokeWidth: 0, perspective: { rotateX: 62, rotateY: 0, rotateZ: 0, depth: 800 }, animation: "fade-up", animMs: 800 })],
  },
  {
    id: "serif-card",
    name: "Cinematic serif card",
    description: "Italic serif, slightly turned in perspective, behind the subject with a tracking-in reveal.",
    needs: "mask",
    make: ({ startMs, endMs, text }) => [newTextLayer({ text, startMs, endMs, x: 0.5, y: 0.3, fontSize: 190, fontFamily: "Cormorant Garamond", fontWeight: 700, italic: true, color: "#fff4e0", behind: true, perspective: { rotateX: 0, rotateY: -14, rotateZ: 0, depth: 1100 }, animation: "tracking-in", animMs: 1200, letterSpacing: 0.04 })],
  },
  {
    id: "tracked-callout",
    name: "Motion-tracked callout",
    description: "A label pinned above a tracked region; it follows the real motion (and scale) of that region.",
    needs: "track",
    make: ({ startMs, endMs, text, trackId }) => [newTextLayer({ text, startMs, endMs, x: 0.5, y: 0.5, fontSize: 56, fontFamily: "Poppins", fontWeight: 700, color: "#0b0b0f", backgroundColor: "#ffd60a", trackId: trackId ?? null, trackScale: true, animation: "scale-in", animMs: 500 })],
  },
];
