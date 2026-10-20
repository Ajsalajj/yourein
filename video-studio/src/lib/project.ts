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
  kind: z.enum(["video", "audio", "image"]),
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

export const textLayerSchema = z.object({
  id: z.string(),
  text: z.string(),
  startMs: ms, // output time
  endMs: ms,
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  fontSize: z.number().min(12).max(300),
  color: z.string(),
  fontFamily: z.string(),
  fontWeight: z.number().int().min(100).max(900),
  backgroundColor: z.string().default("transparent"),
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
  audio: audioSchema.default({ originalVolume: 1, fadeInMs: 0, fadeOutMs: 0, music: null }),
});
export type Project = z.infer<typeof projectSchema>;

export function uid(prefix = ""): string {
  const r = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(16).slice(2) + Date.now().toString(16)).replace(/-/g, "");
  return prefix + r.slice(0, 10);
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
