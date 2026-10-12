/**
 * The built-in music library: the one place track details live.
 *
 * The audio files in public/audio/builtin/ are original compositions made by
 * scripts/make-music.mjs (app-owned, no third-party recordings). They are
 * DEVELOPMENT PLACEHOLDERS: to ship produced tracks, replace the files (same names)
 * and update `duration` here. To add, retire or reorder a track, edit this list:
 * `active: false` hides a track from the editor while invitations that already use it keep playing.
 */

export type MusicFilter = "Romantic" | "Elegant" | "Traditional" | "Cinematic" | "Minimal";

export type Track = {
  id: string;
  title: string;
  mood: string;
  style: string;
  /** Short label shown on the row, e.g. the occasions it suits. */
  label: string;
  filters: MusicFilter[];
  duration: string;
  url: string;
  active: boolean;
};

export const MUSIC_FILTERS: MusicFilter[] = ["Romantic", "Elegant", "Traditional", "Cinematic", "Minimal"];

const t = (id: string, title: string, mood: string, style: string, label: string, filters: MusicFilter[], duration: string): Track => ({
  id, title, mood, style, label, filters, duration, url: `/audio/builtin/${id}.m4a`, active: true,
});

/** In display order. */
export const TRACKS: Track[] = [
  t("golden-vows", "Golden Vows", "Romantic", "Piano & Strings", "Wedding · Engagement", ["Romantic", "Elegant"], "1:22"),
  t("moonlit-promise", "Moonlit Promise", "Dreamy", "Piano, Pads & Strings", "Nikah · Wedding", ["Romantic", "Cinematic"], "1:30"),
  t("ivory-morning", "Ivory Morning", "Calm", "Light Piano & Acoustic", "Minimal", ["Minimal", "Elegant"], "1:16"),
  t("jasmine-night", "Jasmine Night", "Spiritual", "Oud-inspired & Strings", "Nikah", ["Traditional", "Elegant"], "1:27"),
  t("royal-celebration", "Royal Celebration", "Regal", "Strings, Flute & Percussion", "Indian wedding", ["Traditional", "Cinematic"], "1:20"),
  t("garden-in-bloom", "Garden in Bloom", "Fresh", "Guitar, Piano & Strings", "Floral · Garden", ["Romantic"], "1:16"),
  t("forever-starts-here", "Forever Starts Here", "Warm", "Cinematic Piano & Strings", "Wedding · Anniversary", ["Romantic", "Cinematic"], "1:25"),
  t("velvet-evening", "Velvet Evening", "Sophisticated", "Piano, Cello & Ambience", "Reception", ["Elegant", "Cinematic"], "1:33"),
  t("lotus-sunrise", "Lotus Sunrise", "Peaceful", "Piano, Flute & Light Percussion", "Traditional", ["Traditional", "Minimal"], "1:20"),
  t("our-story", "Our Story", "Emotional", "Minimal Piano", "Any invitation", ["Minimal", "Romantic"], "1:18"),
];

export const getTrack = (id: string | null | undefined) => (id ? TRACKS.find((x) => x.id === id) : undefined);

/** Tracks suggested first for each design. */
export const RECOMMENDED: Record<string, string[]> = {
  "moonlit-mahal": ["moonlit-promise", "jasmine-night"],
  "velvet-opera": ["velvet-evening", "forever-starts-here"],
  "ivory-wax-seal": ["golden-vows", "ivory-morning"],
  "rose-garden": ["golden-vows", "garden-in-bloom", "forever-starts-here"],
  "jasmine-moon": ["jasmine-night", "moonlit-promise"],
  "royal-emerald": ["royal-celebration", "jasmine-night"],
  "scenic-romance": ["our-story", "forever-starts-here"],
  "botanical-vow": ["garden-in-bloom", "ivory-morning"],
  "celestial-veil": ["moonlit-promise", "velvet-evening"],
  "cherry-blossom": ["garden-in-bloom", "golden-vows"],
  "garden-swing": ["garden-in-bloom", "our-story"],
  "golden-palace": ["royal-celebration", "lotus-sunrise"],
  "kerala-ivory": ["lotus-sunrise", "ivory-morning"],
  "marigold-celebration": ["royal-celebration", "lotus-sunrise"],
  "pearl-vellum": ["ivory-morning", "velvet-evening"],
  "silk-ribbon": ["velvet-evening", "forever-starts-here"],
  "temple-heritage": ["lotus-sunrise", "royal-celebration"],
};

/** Host-facing volume steps; the number is what the invitation fades up to (out of 100). */
export const MUSIC_VOLUMES: [string, number][] = [["Low", 22], ["Medium", 35], ["High", 55]];
