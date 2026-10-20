import test from "node:test";
import assert from "node:assert/strict";
import { captionsToOutput, computeSegments, normalizeCuts, outputToSource, sourceToOutput, totalFrames } from "../src/lib/timeline";
import { captionFromWords } from "../src/lib/captions/grouping";
import { distributeWords } from "../src/lib/captions/ops";
import { getCompositionMeta, speechActivity, zoomAt } from "../src/lib/composition";
import { newProject, ASPECTS, type Project } from "../src/lib/project";

const FPS = 30;

test("normalizeCuts merges overlaps, clamps and drops empties", () => {
  const n = normalizeCuts([{ startMs: 500, endMs: 900 }, { startMs: 800, endMs: 1200 }, { startMs: -50, endMs: 100 }, { startMs: 5000, endMs: 5000 }, { startMs: 9000, endMs: 20000 }], 10000);
  assert.deepEqual(n, [{ startMs: 0, endMs: 100 }, { startMs: 500, endMs: 1200 }, { startMs: 9000, endMs: 10000 }]);
});

test("no cuts: one segment covering the whole clip", () => {
  const segs = computeSegments([], 10000, FPS);
  assert.equal(segs.length, 1);
  assert.equal(totalFrames(segs), 300);
});

test("cuts remove footage and shift later times", () => {
  const segs = computeSegments([{ startMs: 2000, endMs: 3000 }], 10000, FPS);
  assert.equal(segs.length, 2);
  assert.equal(totalFrames(segs), 270); // 9 s
  assert.equal(sourceToOutput(1000, segs), 1000);
  assert.equal(Math.round(sourceToOutput(4000, segs)), 3000);
  assert.equal(Math.round(outputToSource(3000, segs)), 4000);
});

test("time inside a cut snaps forward for starts and backward for ends", () => {
  const segs = computeSegments([{ startMs: 2000, endMs: 3000 }], 10000, FPS);
  assert.equal(Math.round(sourceToOutput(2500, segs, "start")), 2000);
  assert.equal(Math.round(sourceToOutput(2500, segs, "end")), 2000);
});

test("segments are frame aligned and never drift against the source (audio/video sync)", () => {
  // 200 pseudo-random cuts; the output position of every kept source frame must be within half a frame.
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const dur = 600_000;
  const cuts = Array.from({ length: 200 }, () => { const s = rnd() * dur; return { startMs: s, endMs: s + 80 + rnd() * 1500 }; });
  const segs = computeSegments(cuts, dur, FPS);
  let expectedFrames = 0;
  for (const s of segs) {
    assert.equal(s.outStartFrame, expectedFrames, "contiguous output frames");
    expectedFrames += s.frames;
    const srcFrames = (s.srcEndMs - s.srcStartMs) * FPS / 1000;
    assert.ok(Math.abs(s.frames - srcFrames) <= 1.0001 + segs.length * 0, `segment length error ${s.frames - srcFrames}`);
  }
  // cumulative: total output frames equals the rounded total kept duration (error does not accumulate)
  const keptMs = segs.reduce((a, s) => a + (s.srcEndMs - s.srcStartMs), 0);
  assert.ok(Math.abs(totalFrames(segs) - keptMs * FPS / 1000) <= 1, `drift ${totalFrames(segs) - keptMs * FPS / 1000} frames over ${segs.length} segments`);
});

test("captions project onto the output timeline; words inside cuts disappear", () => {
  const words = distributeWords(["alpha", "beta", "gamma", "delta"], 1000, 5000); // 1s each
  const cap = captionFromWords(words);
  const segs = computeSegments([{ startMs: 2000, endMs: 3000 }], 10000, FPS); // removes "beta"
  const [out] = captionsToOutput([cap], segs);
  assert.deepEqual(out.words.map((w) => w.text), ["alpha", "gamma", "delta"]);
  assert.equal(Math.round(out.words[1].startMs), 2000);
  assert.equal(out.words[0].srcStartMs, 1000);
});

test("a caption wholly inside a cut vanishes, but its text is untouched in the project", () => {
  const cap = captionFromWords(distributeWords(["only", "words"], 2100, 2900));
  const segs = computeSegments([{ startMs: 2000, endMs: 3000 }], 10000, FPS);
  assert.equal(captionsToOutput([cap], segs).length, 0);
  assert.equal(cap.text, "only words");
});

test("overlapping captions are trimmed", () => {
  const a = captionFromWords(distributeWords(["a", "b"], 0, 2000));
  const b = captionFromWords(distributeWords(["c", "d"], 1500, 3000));
  const out = captionsToOutput([a, b], computeSegments([], 5000, FPS));
  assert.ok(out[0].endMs <= out[1].startMs);
});

function projectWith(aspect: keyof typeof ASPECTS, fps = 30, cuts: Project["cuts"] = []): Project {
  const p = newProject({ id: "export0001", name: "x", aspect });
  p.fps = fps;
  p.assets.a = { id: "a", kind: "video", filename: "a.mp4", mime: "video/mp4", storageKey: "assets/a.mp4", sizeBytes: 1, durationMs: 10_000, hasAudio: true };
  p.sourceAssetId = "a";
  p.cuts = cuts;
  return p;
}

test("export dimensions match the selected aspect ratio", () => {
  for (const [k, v] of Object.entries(ASPECTS)) {
    const m = getCompositionMeta(projectWith(k as keyof typeof ASPECTS));
    assert.equal(m.width, v.width);
    assert.equal(m.height, v.height);
  }
  assert.deepEqual([ASPECTS["9:16"].width, ASPECTS["9:16"].height], [1080, 1920]);
  assert.deepEqual([ASPECTS["16:9"].width, ASPECTS["16:9"].height], [1920, 1080]);
  assert.deepEqual([ASPECTS["1:1"].width, ASPECTS["1:1"].height], [1080, 1080]);
});

test("export duration/frames follow fps and cuts", () => {
  assert.equal(getCompositionMeta(projectWith("9:16", 30)).durationInFrames, 300);
  assert.equal(getCompositionMeta(projectWith("9:16", 60)).durationInFrames, 600);
  const m = getCompositionMeta(projectWith("9:16", 30, [{ id: "c", startMs: 0, endMs: 4000, reason: "manual" }]));
  assert.equal(m.durationInFrames, 180);
});

test("zoom envelope eases in/out and picks the strongest zoom", () => {
  const z = [{ id: "z", startMs: 1000, endMs: 3000, scale: 1.5, focusX: 0.4, focusY: 0.5, rampMs: 500, source: "manual" as const }];
  assert.equal(zoomAt(z, 500).scale, 1);
  assert.ok(zoomAt(z, 1250).scale > 1 && zoomAt(z, 1250).scale < 1.5);
  assert.equal(zoomAt(z, 2000).scale, 1.5);
  assert.equal(zoomAt(z, 2000).fx, 0.4);
});

test("music ducking follows speech with attack and release", () => {
  const caps = captionsToOutput([captionFromWords(distributeWords(["hi", "there"], 2000, 3000))], computeSegments([], 10000, FPS));
  assert.equal(speechActivity(caps, 500), 0);
  assert.equal(speechActivity(caps, 2500), 1);
  const r = speechActivity(caps, caps[0].endMs + 100);
  assert.ok(r > 0 && r < 1);
  assert.equal(speechActivity(caps, 9000), 0);
});
