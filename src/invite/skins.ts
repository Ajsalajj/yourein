import type { Template } from "@/data/templates";

/**
 * Signature designs restyle the shared sections in their own world (see skins.css).
 * Some also label their sections, shown above each title: Velvet Opera reads as a programme in acts.
 */
type Part = "message" | "events" | "count" | "venue" | "gallery" | "rsvp" | "wishes" | "closing";

const ACTS: Record<string, Partial<Record<Part, string>>> = {
  "velvet-opera": { message: "Act I · The Invitation", events: "Act II · The Ceremony", gallery: "Interlude", venue: "Act III · The Celebration", rsvp: "Act IV · Your Reply", closing: "Finale" },
  "moonlit-mahal": { events: "Beneath the moon", venue: "The palace", rsvp: "Kindly reply" },
};

/** A small label above a section's title, or undefined. */
export const actOf = (t: Template, part: Part) => (t.theme.skin ? ACTS[t.theme.skin]?.[part] : undefined);
