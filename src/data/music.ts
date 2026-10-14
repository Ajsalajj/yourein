/**
 * The built-in music library: the one place track details live.
 *
 * The audio files in public/audio/builtin/ are 90-second clips (fades in and out) of
 * licensed songs. To add, retire or reorder a track, edit this list: `active: false`
 * hides a track from the editor while invitations that already use it keep playing,
 * so a retired track's file must stay in place.
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

const r = (...a: Parameters<typeof t>): Track => ({ ...t(...a), active: false });

/** In display order. */
export const TRACKS: Track[] = [
  t("her", "Her", "Romantic", "Pop Ballad · JVKE", "Wedding · Engagement", ["Romantic", "Minimal"], "1:30"),
  t("pesamale", "Pesamale", "Dreamy", "Tamil Indie Pop · Siri Xander", "Wedding · Engagement", ["Romantic", "Traditional"], "1:30"),
  t("sahiba", "Sahiba", "Passionate", "Hindi Pop · Jasleen Royal", "Indian wedding", ["Romantic", "Traditional"], "1:30"),
  t("taaj", "Taaj", "Regal", "Instrumental · Lost Stories", "Nikah · Reception", ["Elegant", "Cinematic"], "1:30"),
  t("lover-remix", "Lover (Remix)", "Warm", "Pop · Taylor Swift ft. Shawn Mendes", "Wedding · Anniversary", ["Romantic"], "1:30"),
  t("ordinary", "Ordinary", "Heartfelt", "Pop Ballad · Alex Warren", "Wedding · Engagement", ["Romantic", "Minimal"], "1:30"),
  t("golden-hour-violin", "Golden Hour (Violin)", "Elegant", "Cinematic Violin Cover · ItsAMoney", "Wedding · Reception", ["Elegant", "Romantic", "Cinematic"], "1:30"),
  t("love-story-violin", "Love Story (Violin)", "Timeless", "Instrumental Violin · ViOLiNiA", "Wedding · Anniversary", ["Elegant", "Cinematic", "Romantic"], "1:30"),
  t("hoor", "Hoor", "Dreamy", "Indian Electronica · Lost Stories", "Nikah · Reception", ["Traditional", "Cinematic"], "1:30"),
  t("inaam", "Inaam", "Joyful", "Punjabi Pop · Jasleen Royal ft. Badshah", "Sangeet · Celebration", ["Traditional"], "1:30"),
  /* Retired: kept so invitations that already use them keep playing. */
  r("golden-vows", "Golden Vows", "Romantic", "Piano & Strings", "Wedding · Engagement", ["Romantic", "Elegant"], "1:22"),
  r("moonlit-promise", "Moonlit Promise", "Dreamy", "Piano, Pads & Strings", "Nikah · Wedding", ["Romantic", "Cinematic"], "1:30"),
  r("ivory-morning", "Ivory Morning", "Calm", "Light Piano & Acoustic", "Minimal", ["Minimal", "Elegant"], "1:16"),
  r("jasmine-night", "Jasmine Night", "Spiritual", "Oud-inspired & Strings", "Nikah", ["Traditional", "Elegant"], "1:27"),
  r("royal-celebration", "Royal Celebration", "Regal", "Strings, Flute & Percussion", "Indian wedding", ["Traditional", "Cinematic"], "1:20"),
  r("garden-in-bloom", "Garden in Bloom", "Fresh", "Guitar, Piano & Strings", "Floral · Garden", ["Romantic"], "1:16"),
  r("forever-starts-here", "Forever Starts Here", "Warm", "Cinematic Piano & Strings", "Wedding · Anniversary", ["Romantic", "Cinematic"], "1:25"),
  r("velvet-evening", "Velvet Evening", "Sophisticated", "Piano, Cello & Ambience", "Reception", ["Elegant", "Cinematic"], "1:33"),
  r("lotus-sunrise", "Lotus Sunrise", "Peaceful", "Piano, Flute & Light Percussion", "Traditional", ["Traditional", "Minimal"], "1:20"),
  r("our-story", "Our Story", "Emotional", "Minimal Piano", "Any invitation", ["Minimal", "Romantic"], "1:18"),
];

export const getTrack = (id: string | null | undefined) => (id ? TRACKS.find((x) => x.id === id) : undefined);

/** Tracks suggested first for each design. */
export const RECOMMENDED: Record<string, string[]> = {
  "moonlit-mahal": ["taaj", "hoor", "pesamale"],
  "velvet-opera": ["taaj", "love-story-violin", "lover-remix"],
  "ivory-wax-seal": ["her", "ordinary"],
  "rose-garden": ["her", "ordinary", "lover-remix"],
  "jasmine-moon": ["hoor", "taaj"],
  "royal-emerald": ["taaj", "hoor", "sahiba"],
  "scenic-romance": ["ordinary", "her"],
  "botanical-vow": ["lover-remix", "golden-hour-violin"],
  "celestial-veil": ["love-story-violin", "taaj"],
  "cherry-blossom": ["golden-hour-violin", "lover-remix"],
  "garden-swing": ["lover-remix", "pesamale"],
  "golden-palace": ["sahiba", "inaam"],
  "kerala-ivory": ["pesamale", "her"],
  "marigold-celebration": ["inaam", "sahiba"],
  "pearl-vellum": ["golden-hour-violin", "her"],
  "silk-ribbon": ["love-story-violin", "lover-remix"],
  "temple-heritage": ["pesamale", "hoor", "sahiba"],
};

/** Host-facing volume steps; the number is what the invitation fades up to (out of 100). */
export const MUSIC_VOLUMES: [string, number][] = [["Low", 22], ["Medium", 35], ["High", 55]];
