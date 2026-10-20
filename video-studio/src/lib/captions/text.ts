/** Unicode-aware text helpers (Malayalam, Devanagari, Tamil use combining marks and conjuncts). */

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** Split into user-perceived characters so conjuncts / vowel signs are never torn apart. */
export function graphemes(text: string): string[] {
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), (s) => s.segment);
  return Array.from(text);
}

export function graphemeCount(text: string): number {
  return graphemes(text).length;
}

const INDIC = /[ऀ-ॿঀ-৿਀-੿઀-૿଀-୿஀-௿ఀ-౿ಀ-೿ഀ-ൿ]/;
/** Scripts that rely on joining/ligatures: letter-spacing and case transforms must not be applied. */
export function isComplexScript(text: string): boolean {
  return INDIC.test(text);
}

export function scriptOf(text: string): "malayalam" | "devanagari" | "tamil" | "latin" | "other" {
  if (/[ഀ-ൿ]/.test(text)) return "malayalam";
  if (/[ऀ-ॿ]/.test(text)) return "devanagari";
  if (/[஀-௿]/.test(text)) return "tamil";
  if (/[A-Za-z]/.test(text)) return "latin";
  return "other";
}

export function tokenize(text: string): string[] {
  return text.split(/\s+/).filter(Boolean);
}

/** Does the token end a sentence? (Latin, Devanagari danda, full stop variants.) */
export function endsSentence(token: string): boolean {
  return /[.!?…।॥]["')\]]*$/.test(token);
}
export function endsClause(token: string): boolean {
  return /[,;:–—]["')\]]*$/.test(token);
}

/**
 * Greedy line breaking that balances line widths (by grapheme weight) instead of filling the first line.
 * Returns arrays of word indices per line. Deterministic and independent of animation state, so
 * layout never jumps while words appear.
 */
export function balanceLines(words: string[], maxWordsPerLine: number, maxLines: number): number[][] {
  const n = words.length;
  if (n === 0) return [];
  const minLines = Math.ceil(n / Math.max(1, maxWordsPerLine));
  const lineCount = Math.min(Math.max(1, maxLines), Math.max(minLines, 1));
  const weights = words.map((w) => graphemeCount(w) + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  const target = total / lineCount;
  const lines: number[][] = [];
  let cur: number[] = [];
  let curW = 0;
  for (let i = 0; i < n; i++) {
    const remainingLines = lineCount - lines.length;
    const remainingWords = n - i;
    const mustBreak = cur.length >= maxWordsPerLine;
    const wouldOvershoot = curW + weights[i] / 2 > target && cur.length > 0 && remainingLines > 1;
    const needForLater = remainingWords <= remainingLines - 1; // keep at least 1 word per remaining line
    if (cur.length && (mustBreak || wouldOvershoot || needForLater) && lines.length < lineCount - 1) {
      lines.push(cur);
      cur = [];
      curW = 0;
    }
    cur.push(i);
    curW += weights[i];
  }
  if (cur.length) lines.push(cur);
  return lines;
}
