/** Sound-effect engine: library, placement, word/zoom/transition sync, gain envelopes, music ducking, suggestions. Pure and deterministic. */
import manifest from "../../public/sfx/manifest.json";
import type { Project } from "./project";
import { uid } from "./project";
import { sourceToOutput, type Segment } from "./timeline";
import type { SfxClip } from "./edit-schema";

export interface SfxItem { id: string; name: string; category: string; durationMs: number; tags: string[] }
export const SFX_LIBRARY: SfxItem[] = manifest as SfxItem[];
export const sfxLibraryItem = (id: string) => SFX_LIBRARY.find((s) => s.id === id);
/** key used in the `mediaUrls` map handed to the composition for bundled sounds */
export const sfxKey = (libraryId: string) => `sfx:${libraryId}`;
export const sfxPublicPath = (libraryId: string) => `/sfx/${libraryId}.wav`;

/** mediaUrls entries for the bundled library, given the origin that serves /public ("" in the browser). */
export const sfxUrls = (origin: string): Record<string, string> => Object.fromEntries(SFX_LIBRARY.map((s) => [sfxKey(s.id), `${origin}${sfxPublicPath(s.id)}`]));

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export interface ResolvedSfx {
  id: string;
  /** key into mediaUrls */
  mediaKey: string;
  /** start in OUTPUT time (ms) and playable length after trims */
  outMs: number;
  durMs: number;
  offsetMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  duckMusic: boolean;
  /** true when the start came from a synced word / zoom / transition rather than a fixed time */
  synced: "word" | "transition" | null;
}

function wordSrcStart(project: Project, wordId: string): number | null {
  for (const c of project.captions) for (const w of c.words) if (w.id === wordId) return w.startMs;
  return null;
}

/** Source time at which a clip really starts (follows its word when synced). */
export function sfxSourceStart(project: Project, c: SfxClip): { srcMs: number; synced: boolean } {
  if (c.syncWordId) {
    const w = wordSrcStart(project, c.syncWordId);
    if (w !== null) return { srcMs: Math.max(0, w + c.syncOffsetMs), synced: true };
  }
  return { srcMs: c.srcMs, synced: false };
}

export function sfxLength(project: Project, c: SfxClip): number {
  const full = c.source.kind === "library" ? sfxLibraryItem(c.source.id)?.durationMs ?? 0 : project.assets[c.source.assetId]?.durationMs ?? 0;
  const avail = Math.max(0, full - c.offsetMs);
  return c.durationMs === null ? avail : Math.min(avail, c.durationMs);
}

/** Joins (boundaries between kept segments) as { srcMs, outMs } so transition sounds can sit exactly on them. */
export function joinsOf(segs: Segment[]): { srcMs: number; outMs: number }[] {
  const out: { srcMs: number; outMs: number }[] = [];
  for (let i = 0; i + 1 < segs.length; i++) out.push({ srcMs: segs[i].srcEndMs, outMs: segs[i].outEndMs });
  return out;
}

export function resolveSfx(project: Project, segs: Segment[]): ResolvedSfx[] {
  if (!project.sfxSettings.enabled) return [];
  const out: ResolvedSfx[] = [];
  for (const c of project.sfx) {
    const durMs = sfxLength(project, c);
    if (durMs <= 0) continue;
    if (c.source.kind === "asset" && !project.assets[c.source.assetId]) continue;
    const { srcMs, synced } = sfxSourceStart(project, c);
    out.push({
      id: c.id,
      mediaKey: c.source.kind === "library" ? sfxKey(c.source.id) : c.source.assetId,
      outMs: sourceToOutput(srcMs, segs, "start"),
      durMs,
      offsetMs: c.offsetMs,
      volume: c.volume,
      fadeInMs: c.fadeInMs,
      fadeOutMs: c.fadeOutMs,
      duckMusic: c.duckMusic,
      synced: synced ? "word" : null,
    });
  }
  // sounds attached to transitions sit on the matching join
  const joins = joinsOf(segs);
  for (const t of project.transitions) {
    if (!t.soundId || !sfxLibraryItem(t.soundId)) continue;
    const j = nearestJoin(joins, t.joinSrcMs);
    if (!j) continue;
    const item = sfxLibraryItem(t.soundId)!;
    // the whoosh peaks near the middle of its length: centre that on the join
    out.push({ id: `${t.id}:snd`, mediaKey: sfxKey(item.id), outMs: Math.max(0, j.outMs - item.durationMs * 0.45), durMs: item.durationMs, offsetMs: 0, volume: 0.9, fadeInMs: 0, fadeOutMs: 0, duckMusic: true, synced: "transition" });
  }
  return out.sort((a, b) => a.outMs - b.outMs);
}

export function nearestJoin<T extends { srcMs: number }>(joins: T[], srcMs: number, tolMs = 400): T | null {
  let best: T | null = null;
  let bd = tolMs + 1;
  for (const j of joins) { const d = Math.abs(j.srcMs - srcMs); if (d < bd) { bd = d; best = j; } }
  return bd <= tolMs ? best : null;
}

/** Linear gain 0..2 for a sound at `localMs` after its start (fades are inside the playable length). */
export function sfxGain(r: Pick<ResolvedSfx, "durMs" | "volume" | "fadeInMs" | "fadeOutMs">, localMs: number, master = 1): number {
  if (localMs < 0 || localMs > r.durMs) return 0;
  const fi = r.fadeInMs > 0 ? clamp(localMs / r.fadeInMs) : 1;
  const fo = r.fadeOutMs > 0 ? clamp((r.durMs - localMs) / r.fadeOutMs) : 1;
  return r.volume * master * fi * fo;
}

/** 0..1: how strongly sound effects are "present" at an output time (attack 30 ms, release 260 ms) - drives music ducking. */
export function sfxActivity(list: ResolvedSfx[], ms: number): number {
  let v = 0;
  for (const r of list) {
    if (!r.duckMusic) continue;
    const a = 30, rel = 260;
    if (ms < r.outMs - a || ms > r.outMs + r.durMs + rel) continue;
    v = Math.max(v, Math.min(clamp((ms - (r.outMs - a)) / a), clamp((r.outMs + r.durMs + rel - ms) / rel)));
  }
  return v;
}

/* ───────── automatic suggestions ───────── */
const RULES: { id: string; re: RegExp; label: string; volume: number }[] = [
  { id: "ding", re: /^(\$?\d[\d,.]*%?|idea|solved|done|success|win(ner)?|perfect|nailed)$/i, label: "number / success word", volume: 0.7 },
  { id: "impact", re: /^(boom|stop|never|always|wow|crazy|insane|secret|free|huge|massive|biggest|worst|best|break(s|ing)?)$/i, label: "emphasis word", volume: 0.8 },
  { id: "click", re: /^(click|tap|press|subscribe|follow|link|button|download)$/i, label: "call to action", volume: 0.8 },
  { id: "shutter", re: /^(photo|picture|camera|snap|capture|screenshot)$/i, label: "photo word", volume: 0.8 },
  { id: "sparkle", re: /^(magic|magical|shine|sparkle|glow|amazing|beautiful)$/i, label: "sparkle word", volume: 0.6 },
  { id: "glitch", re: /^(glitch|error|bug|hack(ed|er)?|digital|ai)$/i, label: "tech word", volume: 0.6 },
];

export interface SuggestOptions { minGapMs?: number; maxPerMinute?: number; includeZooms?: boolean; includeJoins?: boolean; /** also put this library sound on the first word of every caption group (synced to its word animation) */ perCaption?: string | null }

/**
 * Rule-based suggestions anchored to real events: matched WORDS (synced to the word's start, so the sound follows it when captions change),
 * zoom starts (whoosh), and cut joins (soft whoosh). Spaced >= minGapMs apart and capped per minute so it never turns into noise.
 */
export function suggestSfx(project: Project, segs: Segment[], opts: SuggestOptions = {}): SfxClip[] {
  const minGap = opts.minGapMs ?? 1400;
  const perMin = opts.maxPerMinute ?? 14;
  const cand: { srcMs: number; clip: Omit<SfxClip, "id"> }[] = [];
  const mk = (libId: string, srcMs: number, label: string, volume: number, wordId: string | null, offset = 0): Omit<SfxClip, "id"> => ({
    source: { kind: "library", id: libId }, srcMs, syncWordId: wordId, syncOffsetMs: offset, offsetMs: 0, durationMs: null, volume, fadeInMs: 0, fadeOutMs: 0, duckMusic: true, label, auto: true,
  });
  for (const c of project.captions) {
    for (const w of c.words) {
      const bare = w.text.replace(/^[^\p{L}\p{N}$]+|[^\p{L}\p{N}%]+$/gu, "");
      const rule = RULES.find((r) => r.re.test(bare));
      if (rule) cand.push({ srcMs: w.startMs, clip: mk(rule.id, w.startMs, `${rule.label}: "${bare}"`, rule.volume, w.id) });
    }
  }
  if (opts.perCaption && sfxLibraryItem(opts.perCaption)) {
    for (const c of project.captions) if (c.words[0]) cand.push({ srcMs: c.words[0].startMs, clip: mk(opts.perCaption, c.words[0].startMs, "caption start", 0.45, c.words[0].id) });
  }
  if (opts.includeZooms !== false) for (const z of project.zooms) cand.push({ srcMs: z.startMs, clip: mk("whoosh-fast", z.startMs, "zoom in", 0.55, null, -120) });
  if (opts.includeJoins !== false) for (const j of joinsOf(segs)) cand.push({ srcMs: j.srcMs, clip: mk("whoosh-soft", j.srcMs, "cut", 0.5, null, -150) });
  cand.sort((a, b) => a.srcMs - b.srcMs);
  const out: SfxClip[] = [];
  let last = -1e9;
  const times: number[] = [];
  for (const k of cand) {
    if (k.srcMs - last < minGap) continue;
    const recent = times.filter((t) => k.srcMs - t < 60000).length;
    if (recent >= perMin) continue;
    last = k.srcMs;
    times.push(k.srcMs);
    out.push({ id: uid("sf_"), ...k.clip } as SfxClip);
  }
  return out;
}
