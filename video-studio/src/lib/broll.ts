/**
 * B-roll planning: which parts of a transcript can be illustrated, with what search query, where to place a clip, how to fit it.
 * Rule-based and deterministic (no model call): a "visualness" lexicon + proper nouns + sentence structure.
 * It suggests - it never inserts anything by itself; the user (or "Auto-fill") confirms each clip.
 */
import type { Caption, Project, Word } from "./project";
import { uid } from "./project";
import { sourceToOutput, type Segment } from "./timeline";
import type { BrollClip } from "./edit-schema";

const group = (cat: string, words: string) => words.split(/\s+/).filter(Boolean).map((w) => [w, cat] as const);
/** concrete, filmable things (category helps build better stock queries) */
const LEXICON = new Map<string, string>([
  ...group("money", "money cash dollars dollar coins coin bank investing investment stocks stock market profit revenue salary wallet credit card price budget"),
  ...group("business", "business startup office meeting team company boss client customer customers sales store shop shopping brand product products marketing"),
  ...group("tech", "computer laptop phone smartphone screen keyboard code coding software app website internet data robot ai chip server camera drone"),
  ...group("city", "city street traffic building skyscraper downtown car cars road highway train subway airport airplane plane bus bike bicycle bridge"),
  ...group("nature", "ocean sea beach wave waves mountain mountains forest tree trees river lake sunset sunrise sky clouds rain storm snow desert island waterfall flower flowers garden field"),
  ...group("food", "food coffee pizza burger cooking kitchen restaurant chef breakfast dinner lunch fruit vegetables cake bread wine beer tea"),
  ...group("people", "crowd friends family kids children baby dog cat dogs cats animals horse bird birds people audience students teacher doctor athlete runner dancer"),
  ...group("fitness", "gym workout running exercise yoga fitness muscle training sport sports football basketball soccer tennis swimming hiking"),
  ...group("home", "home house room bedroom bathroom sofa desk window door light lights candle mirror clock"),
  ...group("travel", "travel vacation hotel passport suitcase tourist adventure journey map compass"),
  ...group("science", "space planet earth moon stars galaxy rocket lab laboratory science microscope experiment energy electricity solar battery"),
  ...group("work", "writing notebook pen paper book books reading studying school university graduation presentation whiteboard"),
  ...group("emotion", "smile laughing crying celebration party win winning victory trophy fire explosion"),
]);
const STOP = new Set("a an the and or but if so to of in on at for from by with as is are was were be been being it its this that these those i you he she we they me my your our their not no do does did have has had will would can could should just very really then than too also into out up down over about what when where why how who which there here all any some many much more most other such only own same so than too s t don now get got going go like one two thing things way want need know think see say said make made let us them him her his hers theirs yours mine".split(/\s+/));
const ABSTRACT_SUFFIX = /(tion|sion|ness|ity|ment|ship|ance|ence|ism|hood|ing)$/;

export interface Concept {
  /** best single keyword */
  keyword: string;
  category: string | null;
  /** 0..1 how filmable the sentence is */
  score: number;
  words: Word[];
}
export interface Sentence { id: string; text: string; startMs: number; endMs: number; words: Word[] }

/** Split captions' words into sentences (terminal punctuation or a >900 ms gap). */
export function sentencesOf(captions: Caption[]): Sentence[] {
  const words = captions.flatMap((c) => c.words).sort((a, b) => a.startMs - b.startMs);
  const out: Sentence[] = [];
  let cur: Word[] = [];
  const flush = () => { if (cur.length) { out.push({ id: `s${out.length}`, text: cur.map((w) => w.text).join(" "), startMs: cur[0].startMs, endMs: cur[cur.length - 1].endMs, words: cur }); cur = []; } };
  for (const w of words) {
    if (cur.length && w.startMs - cur[cur.length - 1].endMs > 900) flush();
    cur.push(w);
    if (/[.!?…]$/.test(w.text)) flush();
  }
  flush();
  return out;
}

const bare = (w: string) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/'s$/, "");

/** Visual concepts of one sentence, best first. */
export function conceptsOf(s: Sentence): Concept[] {
  const found: Concept[] = [];
  s.words.forEach((w, i) => {
    const b = bare(w.text);
    if (b.length < 3 || STOP.has(b)) return;
    const cat = LEXICON.get(b) ?? LEXICON.get(b.replace(/s$/, "")) ?? null;
    const proper = i > 0 && /^\p{Lu}/u.test(w.text) && !/[.!?]$/.test(s.words[i - 1].text);
    let score = cat ? 1 : proper ? 0.6 : 0.2;
    if (!cat && ABSTRACT_SUFFIX.test(b)) score -= 0.15; // abstractions rarely have footage
    if (!cat && b.length >= 6) score += 0.05;
    found.push({ keyword: b, category: cat, score: Math.max(0, Math.min(1, score)), words: [w] });
  });
  return found.sort((a, b) => b.score - a.score || a.words[0].startMs - b.words[0].startMs);
}

export interface BrollSuggestion {
  id: string;
  startMs: number;
  endMs: number;
  /** search query for stock libraries */
  query: string;
  keywords: string[];
  score: number;
  sentence: string;
  reason: string;
}

export interface SuggestOptions {
  minScore?: number;
  clipMs?: number;
  minGapMs?: number;
  maxCoverage?: number;
  /** keep the opening hook on the speaker's face */
  skipFirstMs?: number;
}

/**
 * Suggestions: one per filmable sentence, anchored on the keyword's start, ~clipMs long, kept inside ONE kept segment of the edit
 * (so it never straddles a cut), spaced >= minGapMs and limited to maxCoverage of the output.
 */
export function suggestBroll(project: Project, segs: Segment[], opts: SuggestOptions = {}): BrollSuggestion[] {
  const minScore = opts.minScore ?? 0.5, clipMs = opts.clipMs ?? 2600, gap = opts.minGapMs ?? 1500, cov = opts.maxCoverage ?? 0.4, skip = opts.skipFirstMs ?? 1500;
  const totalOut = segs.length ? segs[segs.length - 1].outEndMs : 0;
  const cand: BrollSuggestion[] = [];
  for (const s of sentencesOf(project.captions)) {
    const cs = conceptsOf(s).filter((c) => c.score >= minScore);
    if (!cs.length) continue;
    const top = cs[0];
    const second = cs.find((c) => c.keyword !== top.keyword && c.category === top.category) ?? cs.find((c) => c.keyword !== top.keyword);
    const keywords = [top.keyword, ...(second ? [second.keyword] : [])];
    const seg = segs.find((g) => top.words[0].startMs >= g.srcStartMs && top.words[0].startMs < g.srcEndMs);
    if (!seg) continue;
    const start = Math.max(seg.srcStartMs, top.words[0].startMs - 150);
    if (start < skip) continue;
    const end = Math.min(seg.srcEndMs, start + clipMs);
    if (end - start < 900) continue;
    cand.push({ id: uid("bs_"), startMs: Math.round(start), endMs: Math.round(end), query: keywords.join(" "), keywords, score: top.score, sentence: s.text, reason: top.category ? `“${top.keyword}” is a concrete ${top.category} subject` : `“${top.keyword}” looks like a named/visual subject` });
  }
  // best first, then enforce spacing and coverage, finally restore time order
  const chosen: BrollSuggestion[] = [];
  let covered = 0;
  for (const c of [...cand].sort((a, b) => b.score - a.score || a.startMs - b.startMs)) {
    if (chosen.some((x) => c.startMs < x.endMs + gap && c.endMs > x.startMs - gap)) continue;
    const len = c.endMs - c.startMs;
    if (totalOut > 0 && (covered + len) / totalOut > cov) continue;
    chosen.push(c); covered += len;
  }
  return chosen.sort((a, b) => a.startMs - b.startMs);
}

export interface Fit { clipInMs: number; durationMs: number; slowed: boolean; trimmed: boolean }
/**
 * Fit a clip of `clipMs` into a slot of `slotMs` with no stretching: longer clips are trimmed (starting a little in, since the first
 * second of stock footage is often a settling camera move), shorter ones shorten the slot so the clip never freezes or loops.
 */
export function fitClipToSlot(clipMs: number, slotMs: number): Fit {
  if (clipMs <= slotMs) return { clipInMs: 0, durationMs: Math.max(0, Math.floor(clipMs)), slowed: false, trimmed: false };
  const spare = clipMs - slotMs;
  const clipInMs = Math.min(spare, Math.min(1000, spare / 2));
  return { clipInMs: Math.round(clipInMs), durationMs: Math.round(slotMs), slowed: false, trimmed: true };
}

/** Output-time frame range of a B-roll clip (source range mapped through the cuts). */
export function brollOutputRange(c: Pick<BrollClip, "startMs" | "endMs">, segs: Segment[], fps: number): { from: number; frames: number } | null {
  if (!segs.length) return null;
  const a = sourceToOutput(c.startMs, segs, "start");
  const b = sourceToOutput(c.endMs, segs, "end");
  const from = Math.round((a * fps) / 1000);
  const frames = Math.round((b * fps) / 1000) - from;
  return frames >= 1 ? { from, frames } : null;
}

/** B-roll clips that overlap in time (mode "full"/overlay compete for the same pixels); returns ids of the later ones. */
export function overlappingBroll(list: BrollClip[]): string[] {
  const s = [...list].sort((a, b) => a.startMs - b.startMs);
  const bad: string[] = [];
  for (let i = 1; i < s.length; i++) if (s[i].startMs < s[i - 1].endMs) bad.push(s[i].id);
  return bad;
}

/** Create a placed clip from a suggestion + imported asset, fitted to the slot. */
export function clipFromSuggestion(sug: Pick<BrollSuggestion, "startMs" | "endMs" | "keywords" | "sentence">, assetId: string, assetDurationMs: number, extra: Partial<BrollClip> = {}): BrollClip {
  const fit = fitClipToSlot(assetDurationMs, sug.endMs - sug.startMs);
  return {
    id: uid("br_"), assetId, startMs: sug.startMs, endMs: sug.startMs + fit.durationMs, clipInMs: fit.clipInMs, mode: "full", opacity: 1, fit: "cover",
    transitionIn: null, transitionOut: null, transitionMs: 350, keywords: sug.keywords, note: sug.sentence.slice(0, 200), credit: null, auto: false, ...extra,
  };
}

/* ───────── layout of split / PiP modes (pure; shared by the composition and tests) ───────── */
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

/** 0..1 presence of a B-roll panel at local frame `k` of a clip lasting `frames` (slides in/out over transitionMs). */
export function panelProgress(k: number, frames: number, transitionMs: number, fps: number): number {
  const t = Math.max(1, Math.round((transitionMs * fps) / 1000));
  return easeOutCubic(Math.min(1, (k + 1) / t)) * easeOutCubic(Math.min(1, (frames - k) / t));
}

export interface Box { left: number; top: number; width: number; height: number }
/** Rectangles (fractions of the frame) for the B-roll panel and for the speaker footage at presence p. Panels fill half the frame. */
export function splitLayout(mode: BrollClip["mode"], p: number): { broll: Box; base: Box; /** translate of the panel as a fraction of its own size while sliding in */ slide: { x: number; y: number } } {
  const q = clamp01(p);
  switch (mode) {
    case "split-top": return { broll: { left: 0, top: 0, width: 1, height: 0.5 }, base: { left: 0, top: 0.5 * q, width: 1, height: 1 - 0.5 * q }, slide: { x: 0, y: -(1 - q) } };
    case "split-bottom": return { broll: { left: 0, top: 0.5, width: 1, height: 0.5 }, base: { left: 0, top: 0, width: 1, height: 1 - 0.5 * q }, slide: { x: 0, y: 1 - q } };
    case "split-left": return { broll: { left: 0, top: 0, width: 0.5, height: 1 }, base: { left: 0.5 * q, top: 0, width: 1 - 0.5 * q, height: 1 }, slide: { x: -(1 - q), y: 0 } };
    case "split-right": return { broll: { left: 0.5, top: 0, width: 0.5, height: 1 }, base: { left: 0, top: 0, width: 1 - 0.5 * q, height: 1 }, slide: { x: 1 - q, y: 0 } };
    case "pip": return { broll: { left: 0.52, top: 0.05, width: 0.43, height: 0.43 * (9 / 16) * 1.6 }, base: { left: 0, top: 0, width: 1, height: 1 }, slide: { x: 0, y: -(1 - q) * 1.2 } };
    default: return { broll: { left: 0, top: 0, width: 1, height: 1 }, base: { left: 0, top: 0, width: 1, height: 1 }, slide: { x: 0, y: 0 } };
  }
}

export interface PlacedBroll { clip: BrollClip; from: number; frames: number }
export function placeBroll(list: BrollClip[], segs: Segment[], fps: number): PlacedBroll[] {
  const out: PlacedBroll[] = [];
  for (const clip of list) { const r = brollOutputRange(clip, segs, fps); if (r) out.push({ clip, ...r }); }
  return out.sort((a, b) => a.from - b.from);
}

/** The split/PiP clip active at output frame f (the later-starting one wins), with its panel presence. */
export function activeSplit(placed: PlacedBroll[], f: number, fps: number): { clip: BrollClip; k: number; p: number } | null {
  let hit: { clip: BrollClip; k: number; p: number } | null = null;
  for (const b of placed) {
    if (b.clip.mode === "full" || b.clip.mode === "overlay" || f < b.from || f >= b.from + b.frames) continue;
    const k = f - b.from;
    hit = { clip: b.clip, k, p: panelProgress(k, b.frames, b.clip.transitionMs, fps) };
  }
  return hit;
}
/** True while a full-frame B-roll hides the speaker (so a subject cut-out must not be drawn over it). */
export function fullBrollActive(placed: PlacedBroll[], f: number): boolean {
  return placed.some((b) => b.clip.mode === "full" && f >= b.from && f < b.from + b.frames);
}
