/** Phase-3 edit data (sound effects, transitions, B-roll, reframing). Pure zod; imported by project.ts. All times are SOURCE time (ms) like captions/zooms. */
import { z } from "zod";

const ms = z.number().finite().min(0);

/* ───────── sound effects ───────── */
export const sfxClipSchema = z.object({
  id: z.string(),
  /** bundled library item (public/sfx) or an uploaded audio asset */
  source: z.discriminatedUnion("kind", [z.object({ kind: z.literal("library"), id: z.string() }), z.object({ kind: z.literal("asset"), assetId: z.string() })]),
  /** where the sound starts, in source time */
  srcMs: ms,
  /** If set, the start follows this word (stable id) + syncOffsetMs, so retiming/editing captions moves the sound with the animation. */
  syncWordId: z.string().nullable().default(null),
  syncOffsetMs: z.number().min(-2000).max(2000).default(0),
  /** trim: skip this much of the sound / play at most this long (null = to the end) */
  offsetMs: ms.default(0),
  durationMs: ms.nullable().default(null),
  volume: z.number().min(0).max(2).default(1),
  fadeInMs: ms.default(0),
  fadeOutMs: ms.default(0),
  /** lower the music track while this sound plays */
  duckMusic: z.boolean().default(true),
  label: z.string().max(80).default(""),
  /** created by "Suggest sounds" (so the user can tell and clear them) */
  auto: z.boolean().default(false),
});
export type SfxClip = z.infer<typeof sfxClipSchema>;

export const sfxSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  /** master gain for the whole track */
  volume: z.number().min(0).max(2).default(1),
  /** reduce effects while speech is present (0 = off, 1 = silence them) - keeps dialogue intelligible */
  duckUnderSpeech: z.number().min(0).max(1).default(0),
});
export type SfxSettings = z.infer<typeof sfxSettingsSchema>;

/* ───────── transitions ───────── */
export const TRANSITION_TYPES = ["smooth-zoom", "radial-zoom-blur", "directional-blur", "whip-pan", "motion-blur", "camera-push", "flash", "mask-reveal", "slide", "cinematic-fade"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];
export const transitionSchema = z.object({
  id: z.string(),
  type: z.enum(TRANSITION_TYPES),
  /** source time of the join (end of the clip before the cut). Matched to the nearest join within 400 ms. */
  joinSrcMs: ms,
  durationMs: z.number().min(120).max(2000).default(500),
  direction: z.enum(["left", "right", "up", "down"]).default("left"),
  intensity: z.number().min(0).max(1).default(0.7),
  /** also play this library sound at the join */
  soundId: z.string().nullable().default(null),
});
export type TransitionSpec = z.infer<typeof transitionSchema>;

/* ───────── B-roll ───────── */
export const BROLL_MODES = ["full", "overlay", "split-top", "split-bottom", "split-left", "split-right", "pip"] as const;
export type BrollMode = (typeof BROLL_MODES)[number];
export const brollSchema = z.object({
  id: z.string(),
  /** project asset (video or image) holding the clip */
  assetId: z.string(),
  startMs: ms,
  endMs: ms,
  /** where in the clip playback starts (video only) */
  clipInMs: ms.default(0),
  mode: z.enum(BROLL_MODES).default("full"),
  /** overlay mode: opacity of the B-roll over the speaker */
  opacity: z.number().min(0.1).max(1).default(1),
  fit: z.enum(["cover", "contain"]).default("cover"),
  /** how it comes in/out; null = hard cut */
  transitionIn: z.enum(TRANSITION_TYPES).nullable().default(null),
  transitionOut: z.enum(TRANSITION_TYPES).nullable().default(null),
  transitionMs: z.number().min(120).max(1500).default(350),
  /** why it was placed (concept/keywords from the transcript) */
  keywords: z.array(z.string().max(40)).max(12).default([]),
  note: z.string().max(200).default(""),
  /** attribution/licence of the stock clip (kept for credits) */
  credit: z.object({ provider: z.string(), id: z.string(), author: z.string().default(""), url: z.string().default(""), license: z.string().default("") }).nullable().default(null),
  auto: z.boolean().default(false),
});
export type BrollClip = z.infer<typeof brollSchema>;

/* ───────── face-aware reframing ───────── */
export const reframeSchema = z.object({
  /** "off" keeps the old behaviour (centre-weighted zooms) */
  mode: z.enum(["off", "face"]).default("off"),
  /** how tightly to frame the face: face height as a fraction of the output height (0.25 = loose, 0.5 = tight) */
  tightness: z.number().min(0.1).max(0.9).default(0.3),
  /** smoothing time constant of the virtual camera in ms (larger = calmer) */
  smoothMs: z.number().min(100).max(3000).default(700),
  /** manual override: fixed focus (normalised source coords) over a time range; wins over the tracker */
  overrides: z.array(z.object({ id: z.string(), startMs: ms, endMs: ms, x: z.number().min(0).max(1), y: z.number().min(0).max(1), scale: z.number().min(1).max(3).default(1) })).default([]),
});
export type ReframeSettings = z.infer<typeof reframeSchema>;
