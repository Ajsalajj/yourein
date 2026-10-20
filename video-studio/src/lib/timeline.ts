/**
 * Source-time <-> output-time mapping driven by the edit-decision list (cuts).
 * Pure functions; shared by the preview, the exporter, the timeline UI and tests.
 */
import type { Caption, Cut, Project, Word, Zoom } from "./project";

export interface Segment {
  srcStartMs: number;
  srcEndMs: number;
  /** Output position, frame-aligned so audio/video never drift against each other. */
  outStartFrame: number;
  frames: number;
  srcStartFrame: number;
  outStartMs: number;
  outEndMs: number;
}

export const msToFrame = (ms: number, fps: number) => Math.round((ms * fps) / 1000);
export const frameToMs = (frame: number, fps: number) => (frame * 1000) / fps;

export function normalizeCuts(cuts: Pick<Cut, "startMs" | "endMs">[], durationMs: number) {
  const sorted = cuts
    .map((c) => ({ startMs: Math.max(0, Math.min(c.startMs, c.endMs)), endMs: Math.min(durationMs, Math.max(c.startMs, c.endMs)) }))
    .filter((c) => c.endMs > c.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  const merged: { startMs: number; endMs: number }[] = [];
  for (const c of sorted) {
    const last = merged[merged.length - 1];
    if (last && c.startMs <= last.endMs) last.endMs = Math.max(last.endMs, c.endMs);
    else merged.push({ ...c });
  }
  return merged;
}

/** Complement of the cuts, with frame-exact output positions. Segments shorter than one frame are dropped. */
export function computeSegments(cuts: Pick<Cut, "startMs" | "endMs">[], durationMs: number, fps: number): Segment[] {
  const merged = normalizeCuts(cuts, durationMs);
  const kept: { s: number; e: number }[] = [];
  let cursor = 0;
  for (const c of merged) {
    if (c.startMs > cursor) kept.push({ s: cursor, e: c.startMs });
    cursor = Math.max(cursor, c.endMs);
  }
  if (cursor < durationMs) kept.push({ s: cursor, e: durationMs });

  const minMs = 1000 / fps;
  const segs: Segment[] = [];
  let cumMs = 0;
  let outFrameCursor = 0;
  for (const k of kept) {
    if (k.e - k.s < minMs) continue;
    const cumStart = cumMs;
    cumMs += k.e - k.s;
    const startFrame = outFrameCursor;
    const endFrame = Math.max(startFrame + 1, msToFrame(cumMs, fps));
    outFrameCursor = endFrame;
    segs.push({
      srcStartMs: k.s,
      srcEndMs: k.e,
      srcStartFrame: msToFrame(k.s, fps),
      outStartFrame: startFrame,
      frames: endFrame - startFrame,
      outStartMs: frameToMs(startFrame, fps),
      outEndMs: frameToMs(endFrame, fps),
    });
    void cumStart;
  }
  return segs;
}

export function totalFrames(segs: Segment[]): number {
  const last = segs[segs.length - 1];
  return last ? last.outStartFrame + last.frames : 0;
}

/**
 * Map a source timestamp to output time.
 * Inside a cut: bias "start" snaps forward to the next kept footage, bias "end" snaps back.
 */
export function sourceToOutput(tMs: number, segs: Segment[], bias: "start" | "end" = "start"): number {
  if (segs.length === 0) return 0;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (tMs >= s.srcStartMs && tMs <= s.srcEndMs) {
      // A boundary shared with a following segment is the same output instant; fine either way.
      return s.outStartMs + Math.min(tMs - s.srcStartMs, s.outEndMs - s.outStartMs);
    }
    if (tMs < s.srcStartMs) return bias === "start" ? s.outStartMs : i === 0 ? 0 : segs[i - 1].outEndMs;
  }
  return segs[segs.length - 1].outEndMs;
}

export function outputToSource(outMs: number, segs: Segment[]): number {
  if (segs.length === 0) return 0;
  for (const s of segs) {
    if (outMs >= s.outStartMs && outMs < s.outEndMs) return s.srcStartMs + (outMs - s.outStartMs);
  }
  const last = segs[segs.length - 1];
  return outMs < segs[0].outStartMs ? segs[0].srcStartMs : last.srcEndMs;
}

export function isRemoved(tMs: number, cuts: Pick<Cut, "startMs" | "endMs">[]): boolean {
  return cuts.some((c) => tMs >= c.startMs && tMs < c.endMs);
}

export interface OutWord extends Word {
  /** original source timing, kept for editing UI */
  srcStartMs: number;
  srcEndMs: number;
}
export interface OutCaption {
  id: string;
  startMs: number;
  endMs: number;
  words: OutWord[];
  styleId: string | null;
  animationId: string | null;
  position: Caption["position"];
  speakerId: string | null;
}

/**
 * Project the captions onto the output timeline: words inside cut footage disappear, others shift.
 * Overlap between consecutive captions is resolved by trimming the earlier one.
 */
export function captionsToOutput(captions: Caption[], segs: Segment[]): OutCaption[] {
  const out: OutCaption[] = [];
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  for (const c of sorted) {
    const words: OutWord[] = [];
    for (const w of c.words) {
      const s = sourceToOutput(w.startMs, segs, "start");
      const e = sourceToOutput(w.endMs, segs, "end");
      if (e - s < 1) continue; // word lies entirely in removed footage
      words.push({ ...w, srcStartMs: w.startMs, srcEndMs: w.endMs, startMs: s, endMs: e });
    }
    if (!words.length) continue;
    const start = Math.min(sourceToOutput(c.startMs, segs, "start"), words[0].startMs);
    const end = Math.max(sourceToOutput(c.endMs, segs, "end"), words[words.length - 1].endMs);
    out.push({ id: c.id, startMs: start, endMs: end, words, styleId: c.styleId, animationId: c.animationId, position: c.position, speakerId: c.speakerId });
  }
  for (let i = 0; i < out.length - 1; i++) {
    if (out[i].endMs > out[i + 1].startMs) out[i].endMs = Math.max(out[i].words[out[i].words.length - 1].startMs + 1, out[i + 1].startMs);
  }
  return out;
}

export interface OutZoom extends Omit<Zoom, "startMs" | "endMs"> {
  startMs: number;
  endMs: number;
}
export function zoomsToOutput(zooms: Zoom[], segs: Segment[]): OutZoom[] {
  return zooms
    .map((z) => ({ ...z, startMs: sourceToOutput(z.startMs, segs, "start"), endMs: sourceToOutput(z.endMs, segs, "end") }))
    .filter((z) => z.endMs - z.startMs > 50);
}

export interface CompositionMeta {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  segments: Segment[];
}

export function getVideoDurationMs(project: Project): number {
  const a = project.sourceAssetId ? project.assets[project.sourceAssetId] : undefined;
  return a?.durationMs ?? 0;
}
