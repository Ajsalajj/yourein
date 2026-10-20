/**
 * Versioned project format.
 *
 * Design rules:
 *  - Everything the user *authors* (captions, cuts, zooms) is stored in SOURCE time
 *    (milliseconds in the original video). The edit-decision list (cuts) is the only
 *    thing that maps source time to output time (see timeline.ts), so deleting caption
 *    text never removes footage and removing footage never rewrites caption text.
 *  - `transcript` is the raw, immutable ASR output. `captions` are editing decisions.
 *  - Media is referenced by asset id only; effects never contain file paths.
 */
import { z } from "zod";
import { customFontSchema, wordStyleSchema } from "./wordstyle";

export const SCHEMA_VERSION = 1 as const;
export const DEFAULT_FPS = 30;

export const ASPECTS = {
  "9:16": { width: 1080, height: 1920, label: "Vertical 9:16" },
  "16:9": { width: 1920, height: 1080, label: "Landscape 16:9" },
  "1:1": { width: 1080, height: 1080, label: "Square 1:1" },
} as const;
export type AspectId = keyof typeof ASPECTS;
export const aspectIdSchema = z.enum(["9:16", "16:9", "1:1"]);

const ms = z.number().finite().min(0);

export const assetSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["video", "audio", "image", "font"]),
  filename: z.string(),
  mime: z.string(),
  /** Path relative to the project directory. Never absolute, never contains "..". */
  storageKey: z.string().regex(/^[\w./-]+$/).refine((s) => !s.includes("..") && !s.startsWith("/")),
  sizeBytes: z.number().int().min(0),
  durationMs: ms,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  fps: z.number().positive().optional(),
  hasAudio: z.boolean().default(false),
  thumbnailKey: z.string().optional(),
  rotation: z.number().optional(),
});
export type Asset = z.infer<typeof assetSchema>;

export const timingSourceSchema = z.enum(["asr", "interpolated", "manual", "import"]);
export type TimingSource = z.infer<typeof timingSourceSchema>;

export const wordSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: ms,
  endMs: ms,
  confidence: z.number().min(0).max(1),
  timingSource: timingSourceSchema,
});
export type Word = z.infer<typeof wordSchema>;

/** Raw ASR result. Never edited after creation. */
export const transcriptSchema = z.object({
  jobId: z.string().optional(),
  engine: z.string(),
  model: z.string(),
  language: z.string(),
  languageProbability: z.number().min(0).max(1).nullable(),
  wordTimestampsNative: z.boolean(),
  createdAt: z.string(),
  durationMs: ms,
  warnings: z.array(z.string()).default([]),
  words: z.array(wordSchema),
});
export type Transcript = z.infer<typeof transcriptSchema>;

export const positionSchema = z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) });
export type Position = z.infer<typeof positionSchema>;

export const captionSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: ms,
  endMs: ms,
  confidence: z.number().min(0).max(1),
  speakerId: z.string().nullable().default(null),
  /** Template id override (null = project default). */
  styleId: z.string().nullable().default(null),
  /** Animation id override (null = the template's animation). */
  animationId: z.string().nullable().default(null),
  /** Position override (null = project default). */
  position: positionSchema.nullable().default(null),
  words: z.array(wordSchema),
});
export type Caption = z.infer<typeof captionSchema>;

export const shadowSchema = z.object({
  color: z.string(),
  blur: z.number().min(0),
  offsetX: z.number(),
  offsetY: z.number(),
});

/** All user-tunable look & feel properties of a caption template. */
export const stylePropsSchema = z.object({
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(900),
  fontSize: z.number().min(16).max(260), // px on a 1080-wide canvas
  color: z.string(),
  highlightColor: z.string(),
  backgroundColor: z.string(), // "transparent" allowed
  strokeColor: z.string(),
  strokeWidth: z.number().min(0).max(30),
  shadow: shadowSchema.nullable(),
  letterSpacing: z.number().min(-0.2).max(1), // em
  lineHeight: z.number().min(0.7).max(2.2),
  uppercase: z.boolean(),
  italic: z.boolean(),
  align: z.enum(["left", "center", "right"]),
  animationDurationMs: z.number().min(60).max(2000),
  intensity: z.number().min(0).max(2),
  maxWordsPerLine: z.number().int().min(1).max(10),
  maxLines: z.number().int().min(1).max(5),
  wordsPerGroup: z.number().int().min(1).max(14),
  /** Casing. `uppercase` is kept for older projects; `textTransform` wins when set. Skipped for Indic scripts. */
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  /** --- motion tuning. All optional: unset = the preset's designed value. --- */
  /** Exit duration in ms (default: min(200, 25% of the caption)). */
  exitMs: z.number().min(0).max(1500).optional(),
  /** Spring overrides applied to every spring-driven motion of the preset. */
  springStiffness: z.number().min(20).max(600).optional(),
  springDamping: z.number().min(2).max(60).optional(),
  /** Multiplier on scale-based motion only (pop, squash, slam), independent of overall intensity. */
  scaleIntensity: z.number().min(0).max(2).optional(),
  /** Shifts all motion relative to the spoken timestamps (negative = animations lead the speech). */
  offsetMs: z.number().min(-500).max(500).optional(),
  /** How long the active-word highlight takes to ramp in. */
  highlightMs: z.number().min(0).max(1000).optional(),
  easing: z.enum(["cubic", "expo", "sine", "back", "linear"]).optional(),
  /** Base look applied to every word (gradient, glow, extrusion, multiple shadows, per-word typography ...). */
  look: wordStyleSchema.optional(),
  /** Extra look for the word being spoken. */
  activeLook: wordStyleSchema.optional(),
  /** Look for emphasised keywords (auto-picked per caption, or forced per word). */
  emphasisLook: wordStyleSchema.optional(),
  emphasis: z.object({ mode: z.enum(["off", "auto"]), maxPerGroup: z.number().int().min(1).max(4), minLength: z.number().int().min(2).max(12) }).optional(),
  /** Shutter fraction of real (sub-frame) motion blur on captions: 0 = off. Costs render time. */
  motionBlur: z.number().min(0).max(1).optional(),
});
export type StyleProps = z.infer<typeof stylePropsSchema>;

export const captionStyleSchema = z.object({
  templateId: z.string(),
  overrides: stylePropsSchema.partial().default({}),
  position: positionSchema,
});
export type CaptionStyleState = z.infer<typeof captionStyleSchema>;

export const cutSchema = z.object({
  id: z.string(),
  startMs: ms,
  endMs: ms,
  reason: z.enum(["manual", "silence", "transcript"]),
});
export type Cut = z.infer<typeof cutSchema>;

export const zoomSchema = z.object({
  id: z.string(),
  startMs: ms, // source time
  endMs: ms,
  scale: z.number().min(1).max(3),
  focusX: z.number().min(0).max(1).default(0.5),
  focusY: z.number().min(0).max(1).default(0.5),
  rampMs: z.number().min(0).max(2000).default(350),
  source: z.enum(["manual", "auto"]).default("manual"),
});
export type Zoom = z.infer<typeof zoomSchema>;

export const perspectiveSchema = z.object({
  rotateX: z.number().min(-80).max(80).default(0),
  rotateY: z.number().min(-80).max(80).default(0),
  rotateZ: z.number().min(-180).max(180).default(0),
  /** CSS perspective distance in px; smaller = stronger foreshortening */
  depth: z.number().min(200).max(4000).default(1200),
});
export type Perspective = z.infer<typeof perspectiveSchema>;

export const textLayerSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: ms, // output time
  endMs: ms,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  fontSize: z.number().min(12).max(600),
  color: z.string(),
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(900),
  backgroundColor: z.string().default("transparent"),
  strokeWidth: z.number().min(0).max(40).default(0),
  strokeColor: z.string().default("#000000"),
  letterSpacing: z.number().min(-0.2).max(2).default(0),
  italic: z.boolean().default(false),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).default("none"),
  /** Draw this layer BEHIND the segmented subject (needs subject masking to be analysed). */
  behind: z.boolean().default(false),
  /** Follow a motion track (project.analysis.tracks[trackId]); position/scale then move with the tracked region. */
  trackId: z.string().nullable().default(null),
  trackScale: z.boolean().default(false),
  perspective: perspectiveSchema.nullable().default(null),
  animation: z.enum(["none", "fade-up", "tracking-in", "scale-in", "mask-reveal"]).default("none"),
  animMs: z.number().min(100).max(3000).default(600),
});
export type TextLayer = z.infer<typeof textLayerSchema>;

export const audioSchema = z.object({
  originalVolume: z.number().min(0).max(2).default(1),
  fadeInMs: ms.default(0),
  fadeOutMs: ms.default(0),
  music: z
    .object({
      assetId: z.string(),
      volume: z.number().min(0).max(1).default(0.25),
      /** Lower the music while captions (speech) are on screen. */
      ducking: z.boolean().default(true),
      duckLevel: z.number().min(0).max(1).default(0.35),
      loop: z.boolean().default(true),
    })
    .nullable()
    .default(null),
});
export type AudioSettings = z.infer<typeof audioSchema>;

/** Server-produced vision results. Written only by the analysis jobs, never accepted from the client. */
export const segmentationSchema = z.object({
  id: z.string(),
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  frames: z.number().int().positive(),
  method: z.string(),
  sourceAssetId: z.string(),
  createdAt: z.string(),
});
export type Segmentation = z.infer<typeof segmentationSchema>;

export const trackSchema = z.object({
  id: z.string(),
  label: z.string().max(80),
  fps: z.number().positive(),
  startFrame: z.number().int().min(0),
  /** per frame from startFrame: [centreX, centreY (normalised 0..1 of the SOURCE frame), scale relative to the first frame] */
  points: z.array(z.tuple([z.number(), z.number(), z.number()])).min(1),
  method: z.string(),
  roi: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
  sourceAssetId: z.string(),
  createdAt: z.string(),
});
export type Track = z.infer<typeof trackSchema>;

export const analysisSchema = z.object({
  segmentation: segmentationSchema.nullable().default(null),
  tracks: z.record(z.string(), trackSchema).default({}),
});
export type Analysis = z.infer<typeof analysisSchema>;

export const projectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string(),
  name: z.string().min(1).max(120),
  createdAt: z.string(),
  updatedAt: z.string(),
  aspect: aspectIdSchema,
  fps: z.number().int().min(15).max(60).default(DEFAULT_FPS),
  sourceAssetId: z.string().nullable(),
  assets: z.record(z.string(), assetSchema),
  transcript: transcriptSchema.nullable(),
  captions: z.array(captionSchema),
  captionStyle: captionStyleSchema,
  captionsVisible: z.boolean().default(true),
  cuts: z.array(cutSchema).default([]),
  zooms: z.array(zoomSchema).default([]),
  textLayers: z.array(textLayerSchema).default([]),
  /** Draw the captions behind the segmented subject (needs analysis.segmentation). */
  captionsBehindSubject: z.boolean().default(false),
  /** Per-word overrides keyed by stable word id (see wordstyle.ts). */
  wordStyles: z.record(z.string(), wordStyleSchema).default({}),
  /** Fonts uploaded by the user (asset kind "font"). */
  fonts: z.array(customFontSchema).default([]),
  analysis: analysisSchema.default({ segmentation: null, tracks: {} }),
  audio: audioSchema.default({ originalVolume: 1, fadeInMs: 0, fadeOutMs: 0, music: null }),
});
export type Project = z.infer<typeof projectSchema>;

export function uid(prefix = ""): string {
  const r = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2) + Date.now().toString(16)).replace(/-/g, "");
  return prefix + r.slice(0, 10);
}

export function newTextLayer(p: Partial<TextLayer> & { text: string; startMs: number; endMs: number }): TextLayer {
  return textLayerSchema.parse({ id: uid("t_"), x: 0.5, y: 0.2, fontSize: 90, color: "#ffffff", fontFamily: "Poppins", fontWeight: 700, ...p });
}

export function newProject(opts: { id: string; name: string; aspect?: AspectId; now?: string }): Project {
  const now = opts.now ?? new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: opts.id,
    name: opts.name,
    createdAt: now,
    updatedAt: now,
    aspect: opts.aspect ?? "9:16",
    fps: DEFAULT_FPS,
    sourceAssetId: null,
    assets: {},
    transcript: null,
    captions: [],
    captionStyle: { templateId: "word-pop", overrides: {}, position: { x: 0.5, y: 0.72 } },
    captionsVisible: true,
    cuts: [],
    zooms: [],
    textLayers: [],
    captionsBehindSubject: false,
    wordStyles: {},
    fonts: [],
    analysis: { segmentation: null, tracks: {} },
    audio: { originalVolume: 1, fadeInMs: 0, fadeOutMs: 0, music: null },
  };
}

/** Upgrade any stored project to the current schema, then validate it. Throws on invalid data. */
export function migrateProject(raw: unknown): Project {
  if (typeof raw !== "object" || raw === null) throw new Error("Project file is not an object");
  const r = raw as Record<string, unknown>;
  const v = r.schemaVersion;
  if (v !== SCHEMA_VERSION) {
    // Future: chain migrations v1 -> v2 here.
    throw new Error(`Unsupported project schemaVersion ${String(v)} (this build reads ${SCHEMA_VERSION})`);
  }
  return projectSchema.parse(raw);
}

export const SAFE_ID = /^[a-z0-9][a-z0-9_-]{5,40}$/i;
export function isSafeId(id: unknown): id is string {
  return typeof id === "string" && SAFE_ID.test(id);
}
