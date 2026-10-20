/**
 * Pure caption editing operations. Each returns a new array and never mutates its input.
 * None of them touch the edit-decision list: editing caption text never removes footage.
 */
import { type Caption, type Word, uid } from "../project";
import { captionFromWords } from "./grouping";
import { graphemeCount, tokenize } from "./text";

const MIN_WORD_MS = 40;

export function recomputeCaption(c: Caption): Caption {
  if (!c.words.length) return { ...c, text: "" };
  const confidence = c.words.reduce((a, w) => a + w.confidence, 0) / c.words.length;
  return {
    ...c,
    text: c.words.map((w) => w.text).join(" "),
    startMs: Math.min(c.startMs, c.words[0].startMs),
    endMs: Math.max(c.endMs, c.words[c.words.length - 1].endMs),
    confidence,
  };
}

/** Spread tokens across [startMs,endMs] proportionally to their length. Timing is marked `interpolated`. */
export function distributeWords(tokens: string[], startMs: number, endMs: number, confidence = 0.5): Word[] {
  const weights = tokens.map((t) => Math.max(1, graphemeCount(t)));
  const total = weights.reduce((a, b) => a + b, 0);
  const span = Math.max(endMs - startMs, tokens.length * MIN_WORD_MS);
  let t = startMs;
  return tokens.map((text, i) => {
    const d = (span * weights[i]) / total;
    const w: Word = { id: uid("w_"), text, startMs: Math.round(t), endMs: Math.round(t + d), confidence, timingSource: "interpolated" };
    t += d;
    return w;
  });
}

/**
 * Replace the caption's text. Same word count -> 1:1 replacement keeping the original timings.
 * Different word count -> unchanged leading/trailing words keep their timings, the changed middle
 * is re-spread (interpolated) over the time span those words occupied.
 */
export function editCaptionText(captions: Caption[], id: string, newText: string): Caption[] {
  return captions.map((c) => {
    if (c.id !== id) return c;
    const tokens = tokenize(newText);
    if (!tokens.length) return { ...c, words: [], text: "" };
    const old = c.words;
    if (tokens.length === old.length) {
      return recomputeCaption({ ...c, words: old.map((w, i) => (w.text === tokens[i] ? w : { ...w, text: tokens[i] })) });
    }
    let pre = 0;
    while (pre < old.length && pre < tokens.length && old[pre].text === tokens[pre]) pre++;
    let suf = 0;
    while (suf < old.length - pre && suf < tokens.length - pre && old[old.length - 1 - suf].text === tokens[tokens.length - 1 - suf]) suf++;
    const midTokens = tokens.slice(pre, tokens.length - suf);
    const oldMid = old.slice(pre, old.length - suf);
    const startMs = oldMid.length ? oldMid[0].startMs : pre > 0 ? old[pre - 1].endMs : c.startMs;
    const endMs = oldMid.length ? oldMid[oldMid.length - 1].endMs : suf > 0 ? old[old.length - suf].startMs : c.endMs;
    const mid = midTokens.length ? distributeWords(midTokens, startMs, Math.max(endMs, startMs + midTokens.length * MIN_WORD_MS), c.confidence) : [];
    const words = [...old.slice(0, pre), ...mid, ...old.slice(old.length - suf)];
    return recomputeCaption({ ...c, words });
  });
}

export function setWordText(captions: Caption[], capId: string, wordId: string, text: string): Caption[] {
  const tokens = tokenize(text);
  if (!tokens.length) return deleteWord(captions, capId, wordId);
  return captions.map((c) =>
    c.id !== capId
      ? c
      : recomputeCaption({
          ...c,
          words: c.words.flatMap((w) => {
            if (w.id !== wordId) return [w];
            if (tokens.length === 1) return [{ ...w, text: tokens[0] }];
            return distributeWords(tokens, w.startMs, w.endMs, w.confidence);
          }),
        }),
  );
}

/** Remove a word from the *subtitles only*. The footage is untouched. */
export function deleteWord(captions: Caption[], capId: string, wordId: string): Caption[] {
  return captions
    .map((c) => (c.id !== capId ? c : recomputeCaption({ ...c, words: c.words.filter((w) => w.id !== wordId) })))
    .filter((c) => c.words.length > 0);
}

export function deleteCaption(captions: Caption[], capId: string): Caption[] {
  return captions.filter((c) => c.id !== capId);
}

/** Split before word index `at` (1..n-1). */
export function splitCaption(captions: Caption[], capId: string, at: number): Caption[] {
  const out: Caption[] = [];
  for (const c of captions) {
    if (c.id !== capId || at <= 0 || at >= c.words.length) {
      out.push(c);
      continue;
    }
    const a = c.words.slice(0, at);
    const b = c.words.slice(at);
    out.push(
      { ...captionFromWords(a, { styleId: c.styleId, animationId: c.animationId, position: c.position, speakerId: c.speakerId }), id: c.id, startMs: c.startMs },
      captionFromWords(b, { styleId: c.styleId, animationId: c.animationId, position: c.position, speakerId: c.speakerId, endMs: c.endMs }),
    );
  }
  return out;
}

/** Split a caption at a time (e.g. the playhead). Returns the same array if the time is not inside the caption's words. */
export function splitCaptionAtTime(captions: Caption[], tMs: number): Caption[] {
  const c = captions.find((x) => tMs > x.startMs && tMs < x.endMs);
  if (!c) return captions;
  const at = c.words.findIndex((w) => w.startMs >= tMs);
  if (at <= 0) return captions;
  return splitCaption(captions, c.id, at);
}

/** Merge a caption with the one that follows it in time. */
export function mergeWithNext(captions: Caption[], capId: string): Caption[] {
  const sorted = [...captions].sort((a, b) => a.startMs - b.startMs);
  const i = sorted.findIndex((c) => c.id === capId);
  if (i < 0 || i >= sorted.length - 1) return captions;
  const a = sorted[i];
  const b = sorted[i + 1];
  const merged = recomputeCaption({ ...a, endMs: Math.max(a.endMs, b.endMs), words: [...a.words, ...b.words] });
  return [...sorted.slice(0, i), merged, ...sorted.slice(i + 2)];
}

/** Move a whole caption (and its words) in time. */
export function shiftCaption(captions: Caption[], capId: string, deltaMs: number): Caption[] {
  return captions.map((c) => {
    if (c.id !== capId) return c;
    const d = Math.max(deltaMs, -c.startMs);
    return {
      ...c,
      startMs: c.startMs + d,
      endMs: c.endMs + d,
      words: c.words.map((w) => ({ ...w, startMs: w.startMs + d, endMs: w.endMs + d, timingSource: "manual" as const })),
    };
  });
}

/** Resize a caption edge; words are re-spaced proportionally inside the new span. */
export function resizeCaption(captions: Caption[], capId: string, edge: "start" | "end", tMs: number): Caption[] {
  return captions.map((c) => {
    if (c.id !== capId) return c;
    const oldS = c.startMs;
    const oldE = c.endMs;
    let s = oldS;
    let e = oldE;
    if (edge === "start") s = Math.max(0, Math.min(tMs, oldE - MIN_WORD_MS * c.words.length));
    else e = Math.max(tMs, oldS + MIN_WORD_MS * c.words.length);
    const k = (e - s) / Math.max(1, oldE - oldS);
    return {
      ...c,
      startMs: s,
      endMs: e,
      words: c.words.map((w) => ({
        ...w,
        startMs: Math.round(s + (w.startMs - oldS) * k),
        endMs: Math.round(s + (w.endMs - oldS) * k),
        timingSource: "manual" as const,
      })),
    };
  });
}

/** Manual correction of one word's timing. Clamped so words stay ordered and non-negative. */
export function setWordTiming(captions: Caption[], capId: string, wordId: string, startMs: number, endMs: number): Caption[] {
  return captions.map((c) => {
    if (c.id !== capId) return c;
    const i = c.words.findIndex((w) => w.id === wordId);
    if (i < 0) return c;
    const lo = i > 0 ? c.words[i - 1].startMs + MIN_WORD_MS : 0;
    const hi = i < c.words.length - 1 ? c.words[i + 1].endMs - MIN_WORD_MS : Infinity;
    const s = Math.max(lo, Math.min(startMs, endMs - MIN_WORD_MS));
    const e = Math.min(hi, Math.max(endMs, s + MIN_WORD_MS));
    const words = c.words.map((w, j) => {
      if (j === i) return { ...w, startMs: Math.round(s), endMs: Math.round(e), timingSource: "manual" as const };
      if (j === i - 1 && w.endMs > s) return { ...w, endMs: Math.round(s) };
      if (j === i + 1 && w.startMs < e) return { ...w, startMs: Math.round(e) };
      return w;
    });
    return recomputeCaption({ ...c, words });
  });
}

export function findCaptionAt(captions: Caption[], tMs: number): Caption | undefined {
  return captions.find((c) => tMs >= c.startMs && tMs < c.endMs);
}

export function searchCaptions(captions: Caption[], query: string): Caption[] {
  const q = query.trim().toLocaleLowerCase();
  if (!q) return [];
  return captions.filter((c) => c.text.toLocaleLowerCase().includes(q));
}
