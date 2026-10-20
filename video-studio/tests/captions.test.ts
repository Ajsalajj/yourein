import test from "node:test";
import assert from "node:assert/strict";
import { groupWords, regroupCaptions, groupWithRemotionCaptions, toRemotionCaptions } from "../src/lib/captions/grouping";
import * as ops from "../src/lib/captions/ops";
import { cuesToCaptions, formatTimestamp, parseSubtitles, parseTimestamp, toSRT, toVTT } from "../src/lib/captions/subtitles";
import { balanceLines, graphemes, graphemeCount, isComplexScript, scriptOf } from "../src/lib/captions/text";
import type { Word } from "../src/lib/project";

const mk = (tokens: string[], start = 0, per = 400): Word[] => ops.distributeWords(tokens, start, start + tokens.length * per, 0.9).map((w) => ({ ...w, timingSource: "asr" as const }));

test("grouping respects words-per-group", () => {
  const g = groupWords(mk("one two three four five six seven eight nine ten".split(" ")), { wordsPerGroup: 4 });
  assert.deepEqual(g.map((c) => c.words.length), [4, 4, 2]);
});

test("grouping breaks on sentence end and on long silence", () => {
  const w = [...mk(["Hello", "there."]), ...mk(["How", "are", "you"], 900)];
  assert.equal(groupWords(w, { wordsPerGroup: 8 }).length, 2);
  const gap = [...mk(["alpha", "beta"]), ...mk(["gamma", "delta"], 5000)];
  assert.equal(groupWords(gap, { wordsPerGroup: 8, gapMs: 650 }).length, 2);
});

test("grouping prefers clause punctuation once half full", () => {
  const g = groupWords(mk(["okay", "well,", "so", "let's", "go", "now"]), { wordsPerGroup: 4 });
  assert.equal(g[0].words.length, 2); // breaks after the comma because the group is already half full
  const early = groupWords(mk(["well,", "okay", "so", "let's"]), { wordsPerGroup: 4 });
  assert.equal(early[0].words.length, 4); // a comma on the first word is not a good break
});

test("caption timing is always ordered and covers its words", () => {
  const g = groupWords(mk("a b c d e f g h".split(" ")), { wordsPerGroup: 3 });
  for (const c of g) {
    assert.ok(c.endMs > c.startMs);
    assert.equal(c.startMs, c.words[0].startMs);
    assert.equal(c.endMs, c.words[c.words.length - 1].endMs);
    for (let i = 1; i < c.words.length; i++) assert.ok(c.words[i].startMs >= c.words[i - 1].startMs);
  }
});

test("regroup keeps every word and its timing", () => {
  const g = groupWords(mk("a b c d e f g h".split(" ")), { wordsPerGroup: 2 });
  const r = regroupCaptions(g, { wordsPerGroup: 4 });
  assert.equal(r.flatMap((c) => c.words).length, 8);
  assert.deepEqual(r.flatMap((c) => c.words.map((w) => w.startMs)), g.flatMap((c) => c.words.map((w) => w.startMs)));
});

test("editing text with the same word count keeps timings", () => {
  const [c] = groupWords(mk(["helo", "wrold"]), { wordsPerGroup: 5 });
  const [e] = ops.editCaptionText([c], c.id, "hello world");
  assert.equal(e.text, "hello world");
  assert.deepEqual(e.words.map((w) => w.startMs), c.words.map((w) => w.startMs));
  assert.deepEqual(e.words.map((w) => w.timingSource), ["asr", "asr"]);
});

test("editing text with a different word count keeps unchanged edge words and interpolates the middle", () => {
  const [c] = groupWords(mk(["the", "quick", "fox"]), { wordsPerGroup: 5 });
  const [e] = ops.editCaptionText([c], c.id, "the very quick brown fox");
  assert.equal(e.words.length, 5);
  assert.equal(e.words[0].startMs, c.words[0].startMs);
  assert.equal(e.words[4].endMs, c.words[2].endMs);
  assert.equal(e.words[1].timingSource, "interpolated");
  for (let i = 1; i < 5; i++) assert.ok(e.words[i].startMs >= e.words[i - 1].startMs);
});

test("deleting a word only changes subtitles", () => {
  const [c] = groupWords(mk(["a", "b", "c"]), { wordsPerGroup: 5 });
  const out = ops.deleteWord([c], c.id, c.words[1].id);
  assert.equal(out[0].text, "a c");
  assert.equal(ops.deleteWord(out, c.id, out[0].words[0].id).length, 1);
  assert.equal(ops.deleteWord([{ ...c, words: [c.words[0]], text: "a" }], c.id, c.words[0].id).length, 0, "empty captions disappear");
});

test("split and merge are inverse operations", () => {
  const [c] = groupWords(mk(["a", "b", "c", "d"]), { wordsPerGroup: 5 });
  const split = ops.splitCaption([c], c.id, 2);
  assert.equal(split.length, 2);
  assert.equal(split[0].text, "a b");
  assert.equal(split[1].text, "c d");
  const merged = ops.mergeWithNext(split, split[0].id);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].text, "a b c d");
});

test("split at playhead time", () => {
  const [c] = groupWords(mk(["a", "b", "c", "d"], 0, 500), { wordsPerGroup: 5 });
  const s = ops.splitCaptionAtTime([c], 1000);
  assert.equal(s.length, 2);
  assert.equal(ops.splitCaptionAtTime([c], 99999).length, 1);
});

test("shifting and resizing captions move words consistently", () => {
  const [c] = groupWords(mk(["a", "b"], 1000, 500), { wordsPerGroup: 5 });
  const [m] = ops.shiftCaption([c], c.id, 250);
  assert.equal(m.startMs, c.startMs + 250);
  assert.equal(m.words[1].endMs, c.words[1].endMs + 250);
  assert.equal(ops.shiftCaption([c], c.id, -99999)[0].startMs, 0, "cannot go before 0");
  const [r] = ops.resizeCaption([c], c.id, "end", c.endMs + 1000);
  assert.equal(r.endMs, c.endMs + 1000);
  assert.equal(r.words[1].endMs, r.endMs);
});

test("manual word timing is clamped and marked manual", () => {
  const [c] = groupWords(mk(["a", "b", "c"], 0, 500), { wordsPerGroup: 5 });
  const [e] = ops.setWordTiming([c], c.id, c.words[1].id, 100, 99999);
  const w = e.words[1];
  assert.equal(w.timingSource, "manual");
  assert.ok(w.startMs >= e.words[0].startMs);
  assert.ok(w.endMs <= e.words[2].endMs, "stays before the following word");
});

test("search finds spoken text", () => {
  const caps = groupWords(mk("hello world this is a test".split(" ")), { wordsPerGroup: 3 });
  assert.equal(ops.searchCaptions(caps, "WORLD").length, 1);
  assert.equal(ops.searchCaptions(caps, "").length, 0);
});

test("SRT round trip", () => {
  const srt = "1\n00:00:01,000 --> 00:00:03,500\nHello <i>world</i>\n\n2\n00:01:00,250 --> 00:01:02,000\nSecond line\nwraps\n";
  const cues = parseSubtitles(srt);
  assert.equal(cues.length, 2);
  assert.deepEqual(cues[0], { startMs: 1000, endMs: 3500, text: "Hello world" });
  assert.equal(cues[1].text, "Second line wraps");
  assert.equal(toSRT(cues), srt.replace("<i>", "").replace("</i>", "").replace("Second line\nwraps", "Second line wraps"));
});

test("VTT parse/serialise and timestamps", () => {
  const vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000 align:start\nHi\n\n01:02.500 --> 01:04.000\nShort form\n";
  const cues = parseSubtitles(vtt);
  assert.equal(cues.length, 2);
  assert.equal(cues[1].startMs, 62500);
  assert.ok(toVTT(cues).startsWith("WEBVTT\n\n00:00:01.000 --> 00:00:02.000"));
  assert.equal(formatTimestamp(3723456, ","), "01:02:03,456");
  assert.equal(parseTimestamp("garbage"), null);
});

test("importing cues makes word-timed captions (marked import) that stay inside the cue", () => {
  const [c] = cuesToCaptions([{ startMs: 1000, endMs: 3000, text: "one two three" }]);
  assert.equal(c.words.length, 3);
  assert.equal(c.startMs, 1000);
  assert.ok(c.words.every((w) => w.timingSource === "import" && w.startMs >= 1000 && w.endMs <= 3000 + 1));
});

test("malformed subtitle files do not crash the parser", () => {
  assert.deepEqual(parseSubtitles("not a subtitle file"), []);
  assert.deepEqual(parseSubtitles("1\n00:00:05,000 --> 00:00:01,000\nbackwards"), []);
});

/* ───────── complex scripts ───────── */
const MALAYALAM = "ക്ഷേത്രം"; // contains the ക്ഷ conjunct and vowel signs
const HINDI = "क्षत्रिय";
const TAMIL = "தமிழ்நாடு";

test("grapheme clusters are never split in Malayalam, Hindi and Tamil", () => {
  for (const s of [MALAYALAM, HINDI, TAMIL]) {
    const g = graphemes(s);
    assert.equal(g.join(""), s, "lossless");
    assert.ok(g.length < Array.from(s).length, `${s}: clusters (${g.length}) must be fewer than code points (${Array.from(s).length})`);
    // no cluster may start with a combining mark/virama/vowel sign
    for (const c of g) assert.ok(!/^[ാ-്ा-्ா-்]/.test(c), `cluster ${c} starts with a dependent sign`);
  }
  // ICU >= 74 treats virama conjuncts as one cluster (2); older ICU gives 4. Never the 7 raw code points.
  assert.ok(graphemeCount(MALAYALAM) >= 2 && graphemeCount(MALAYALAM) <= 4);
});

test("script detection controls letter-spacing/uppercase safety", () => {
  assert.equal(scriptOf(MALAYALAM), "malayalam");
  assert.equal(scriptOf(HINDI), "devanagari");
  assert.equal(scriptOf(TAMIL), "tamil");
  assert.equal(scriptOf("hello"), "latin");
  assert.ok(isComplexScript(MALAYALAM) && isComplexScript(HINDI) && isComplexScript(TAMIL));
  assert.ok(!isComplexScript("hello"));
});

test("line balancing: honours max words/lines and keeps all words in order", () => {
  const words = "ഇത് ഒരു നല്ല വീഡിയോ ആണ് നിങ്ങൾ കാണൂ".split(" ");
  const lines = balanceLines(words, 3, 2);
  assert.equal(lines.flat().length, words.length);
  assert.deepEqual(lines.flat(), words.map((_, i) => i));
  assert.ok(lines.length <= 2 && lines.every((l) => l.length <= 4));
  assert.equal(balanceLines(["a"], 3, 2).length, 1);
  assert.deepEqual(balanceLines([], 3, 2), []);
  const single = balanceLines(["x", "y", "z"], 1, 1);
  assert.equal(single.length, 1, "maxLines wins over maxWordsPerLine");
});

test("line balancing avoids a lone orphan word", () => {
  const lines = balanceLines("the quick brown fox jumps".split(" "), 4, 2);
  assert.ok(lines.every((l) => l.length >= 2), JSON.stringify(lines));
});

test("@remotion/captions: words convert to Remotion captions and group by time window", () => {
  const words = mk("one two three four five six seven eight".split(" "), 0, 500);
  const rc = toRemotionCaptions(words);
  assert.equal(rc.length, 8);
  assert.ok(rc.every((c) => c.text.startsWith(" ") && c.endMs > c.startMs));
  const pages = groupWithRemotionCaptions(words, 1200);
  assert.ok(pages.length >= 2 && pages.length < 8);
  assert.equal(pages.flatMap((p) => p.words).length, 8, "no word lost or duplicated");
  assert.deepEqual(pages.flatMap((p) => p.words.map((w) => w.text)), words.map((w) => w.text));
  assert.ok(groupWithRemotionCaptions(words, 100).length > groupWithRemotionCaptions(words, 3000).length);
  assert.deepEqual(groupWithRemotionCaptions([], 1000), []);
});
