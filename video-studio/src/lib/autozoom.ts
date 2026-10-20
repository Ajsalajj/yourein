/**
 * Smart Zoom suggestions from the transcript (no face detection: see docs/KNOWN_LIMITATIONS.md).
 * Candidate moments:
 *  - the first word after a sentence end or after a pause (a new thought)
 *  - words spoken noticeably slower than the speaker's median (emphasis)
 */
import { endsSentence } from "./captions/text";
import { uid, type Caption, type Word, type Zoom } from "./project";

export interface AutoZoomOptions {
  /** 0..2, scales the zoom factor (1 => ~1.2x) */
  intensity: number;
  minSpacingMs: number;
  durationMs: number;
  pauseMs: number;
}
export const DEFAULT_AUTOZOOM: AutoZoomOptions = { intensity: 1, minSpacingMs: 3500, durationMs: 2200, pauseMs: 450 };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export function suggestZooms(captions: Caption[], durationMs: number, opts: Partial<AutoZoomOptions> = {}): Zoom[] {
  const o = { ...DEFAULT_AUTOZOOM, ...opts };
  const words: Word[] = captions.flatMap((c) => c.words).sort((a, b) => a.startMs - b.startMs);
  if (!words.length) return [];
  const perChar = words.map((w) => (w.endMs - w.startMs) / Math.max(1, w.text.length));
  const med = median(perChar);

  const candidates: { t: number; score: number }[] = [];
  words.forEach((w, i) => {
    const prev = words[i - 1];
    const gap = prev ? w.startMs - prev.endMs : Infinity;
    if (!prev || endsSentence(prev.text) || gap >= o.pauseMs) candidates.push({ t: w.startMs, score: 2 + Math.min(2, gap / 1000) });
    else if (w.text.length >= 5 && perChar[i] > med * 1.5 && w.endMs - w.startMs > 350) candidates.push({ t: w.startMs, score: 1 });
  });

  candidates.sort((a, b) => b.score - a.score || a.t - b.t);
  const chosen: number[] = [];
  for (const c of candidates) if (chosen.every((t) => Math.abs(t - c.t) >= o.minSpacingMs)) chosen.push(c.t);
  chosen.sort((a, b) => a - b);

  const base = 1 + 0.2 * o.intensity;
  return chosen.map((t, i) => {
    const start = Math.max(0, t - 120);
    return {
      id: uid("z_"),
      startMs: start,
      endMs: Math.min(durationMs, start + o.durationMs),
      scale: Math.min(3, i % 2 === 0 ? base : base + 0.08 * o.intensity),
      focusX: 0.5,
      focusY: 0.42,
      rampMs: 350,
      source: "auto" as const,
    };
  }).filter((z) => z.endMs - z.startMs >= 600);
}
