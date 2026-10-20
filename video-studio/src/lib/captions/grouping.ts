import { type Caption, type Word, uid } from "../project";
import { endsClause, endsSentence } from "./text";

export interface GroupingOptions {
  wordsPerGroup: number;
  /** Silence between words that always starts a new caption. */
  gapMs: number;
  /** Hard cap on how long one caption may stay on screen. */
  maxDurationMs: number;
}
export const DEFAULT_GROUPING: GroupingOptions = { wordsPerGroup: 5, gapMs: 650, maxDurationMs: 4500 };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function captionFromWords(words: Word[], extra: Partial<Caption> = {}): Caption {
  return {
    id: uid("c_"),
    text: words.map((w) => w.text).join(" "),
    startMs: words[0].startMs,
    endMs: words[words.length - 1].endMs,
    confidence: mean(words.map((w) => w.confidence)),
    speakerId: null,
    styleId: null,
    animationId: null,
    position: null,
    words,
    ...extra,
  };
}

/**
 * Split a flat word stream into display groups. Breaks on: sentence end, long silence,
 * max duration, max words; prefers clause punctuation when the group is already at least
 * half full, so groups follow phrasing rather than a hard count.
 */
export function groupWords(words: Word[], opts: Partial<GroupingOptions> = {}): Caption[] {
  const o = { ...DEFAULT_GROUPING, ...opts };
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const prev = cur[cur.length - 1];
    if (prev) {
      const gap = w.startMs - prev.endMs;
      const dur = w.endMs - cur[0].startMs;
      const full = cur.length >= o.wordsPerGroup;
      if (gap >= o.gapMs || full || dur > o.maxDurationMs) {
        groups.push(cur);
        cur = [];
      }
    }
    cur.push(w);
    const last = cur[cur.length - 1];
    const half = cur.length >= Math.ceil(o.wordsPerGroup / 2);
    if (endsSentence(last.text) || (half && endsClause(last.text))) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return groups.map((g) => captionFromWords(g));
}

/** Re-group existing (possibly edited) captions, keeping every word's text and timing. */
export function regroupCaptions(captions: Caption[], opts: Partial<GroupingOptions> = {}): Caption[] {
  const words = [...captions].sort((a, b) => a.startMs - b.startMs).flatMap((c) => c.words);
  return groupWords(words, opts);
}

/* ───────── @remotion/captions integration ───────── */
import { createTikTokStyleCaptions, type Caption as RemotionCaption } from "@remotion/captions";

/** Our word timing -> Remotion's `Caption` (a leading space marks the start of a new word, as the package expects). */
export function toRemotionCaptions(words: Word[]): RemotionCaption[] {
  return words.map((w) => ({ text: ` ${w.text}`, startMs: w.startMs, endMs: w.endMs, timestampMs: (w.startMs + w.endMs) / 2, confidence: w.confidence }));
}

/**
 * Group words into time-window "pages" with Remotion's own TikTok-style algorithm: tokens are combined until
 * `combineTokensWithinMilliseconds` has elapsed. Complements `groupWords` (phrase-aware, count based).
 */
export function groupWithRemotionCaptions(words: Word[], combineTokensWithinMilliseconds = 1200): Caption[] {
  if (!words.length) return [];
  const { pages } = createTikTokStyleCaptions({ captions: toRemotionCaptions(words), combineTokensWithinMilliseconds });
  let cursor = 0;
  const out: Caption[] = [];
  for (const page of pages) {
    const slice = words.slice(cursor, cursor + page.tokens.length);
    cursor += page.tokens.length;
    if (slice.length) out.push(captionFromWords(slice));
  }
  return out;
}
