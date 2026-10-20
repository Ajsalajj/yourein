import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SFX_LIBRARY, sfxGain, sfxActivity, resolveSfx, suggestSfx, sfxSourceStart, nearestJoin, joinsOf, sfxLength } from "../src/lib/sfx";
import { editCaptionText, shiftCaption } from "../src/lib/captions/ops";
import { sfxClipSchema } from "../src/lib/edit-schema";
import { demoProject, segsOf } from "./helpers";

const clip = (over: Record<string, unknown> = {}) => sfxClipSchema.parse({ id: "s1", source: { kind: "library", id: "impact" }, srcMs: 3000, ...over });

test("library: every manifest entry has a real, well-formed 44.1 kHz mono WAV whose length matches", () => {
  assert.ok(SFX_LIBRARY.length >= 12);
  for (const s of SFX_LIBRARY) {
    const f = fs.readFileSync(`public/sfx/${s.id}.wav`);
    assert.equal(f.toString("ascii", 0, 4), "RIFF");
    assert.equal(f.readUInt16LE(22), 1, "mono");
    assert.equal(f.readUInt32LE(24), 44100);
    const dataBytes = f.readUInt32LE(40);
    assert.ok(Math.abs((dataBytes / 2 / 44100) * 1000 - s.durationMs) < 5, `${s.id} duration`);
    // not silent
    let peak = 0;
    for (let i = 44; i < f.length; i += 2) peak = Math.max(peak, Math.abs(f.readInt16LE(i)));
    assert.ok(peak > 8000, `${s.id} is audible (peak ${peak})`);
  }
});

test("placement: source time maps through cuts; a sound inside removed footage lands on the join", () => {
  const p = demoProject(undefined, { cuts: [[2000, 4000]] });
  p.sfx = [clip({ srcMs: 5000 }), clip({ id: "s2", srcMs: 3000 })];
  const r = resolveSfx(p, segsOf(p));
  assert.equal(Math.round(r.find((x) => x.id === "s1")!.outMs), 3000, "5000 - 2000 removed");
  assert.equal(Math.round(r.find((x) => x.id === "s2")!.outMs), 2000, "removed footage -> the join");
});

test("sync: a word-synced sound follows the word when captions are retimed or edited", () => {
  const p = demoProject();
  const w = p.captions[0].words[1];
  p.sfx = [clip({ srcMs: 0, syncWordId: w.id, syncOffsetMs: -50 })];
  assert.equal(sfxSourceStart(p, p.sfx[0]).srcMs, w.startMs - 50);
  const moved = { ...p, captions: shiftCaption(p.captions, p.captions[0].id, 400) };
  const nw = moved.captions[0].words[1];
  assert.equal(nw.id, w.id);
  assert.equal(sfxSourceStart(moved, moved.sfx[0]).srcMs, nw.startMs - 50);
  assert.ok(nw.startMs > w.startMs);
  const edited = { ...p, captions: editCaptionText(p.captions, p.captions[0].id, "this is a really remarkable") };
  assert.equal(sfxSourceStart(edited, edited.sfx[0]).synced, true);
  // word deleted -> falls back to the stored time instead of crashing
  const gone = { ...p, captions: p.captions.map((c) => ({ ...c, words: c.words.filter((x) => x.id !== w.id) })) };
  assert.deepEqual(sfxSourceStart(gone, gone.sfx[0]), { srcMs: 0, synced: false });
});

test("trim and gain: offset/duration limit the length, fades are linear and the master gain applies", () => {
  const p = demoProject();
  const full = SFX_LIBRARY.find((s) => s.id === "impact")!.durationMs;
  p.sfx = [clip({ offsetMs: 200, durationMs: 500 }), clip({ id: "s2" })];
  assert.equal(sfxLength(p, p.sfx[0]), 500);
  assert.equal(sfxLength(p, p.sfx[1]), full);
  const r = { durMs: 1000, volume: 0.8, fadeInMs: 200, fadeOutMs: 400 };
  assert.equal(sfxGain(r, -1), 0);
  assert.equal(sfxGain(r, 1001), 0);
  assert.ok(Math.abs(sfxGain(r, 100) - 0.4) < 1e-9, "half-way through the fade-in");
  assert.ok(Math.abs(sfxGain(r, 500) - 0.8) < 1e-9);
  assert.ok(Math.abs(sfxGain(r, 800) - 0.4) < 1e-9, "half-way through the fade-out");
  assert.ok(Math.abs(sfxGain(r, 500, 0.5) - 0.4) < 1e-9, "master gain");
});

test("disabled track, missing assets and zero-length clips produce nothing", () => {
  const p = demoProject();
  p.sfx = [clip(), clip({ id: "s2", source: { kind: "asset", assetId: "nope" } }), clip({ id: "s3", offsetMs: 99999 })];
  assert.equal(resolveSfx(p, segsOf(p)).length, 1);
  assert.equal(resolveSfx({ ...p, sfxSettings: { ...p.sfxSettings, enabled: false } }, segsOf(p)).length, 0);
});

test("music ducking: attack before, release after, only for clips that duck", () => {
  const p = demoProject();
  p.sfx = [clip({ srcMs: 5000 }), clip({ id: "q", srcMs: 9000, duckMusic: false })];
  const r = resolveSfx(p, segsOf(p));
  assert.equal(sfxActivity(r, 4000), 0);
  assert.equal(sfxActivity(r, 5200), 1);
  const after = r[0].outMs + r[0].durMs;
  assert.ok(sfxActivity(r, after + 130) > 0.3 && sfxActivity(r, after + 130) < 0.7, "mid-release");
  assert.equal(sfxActivity(r, after + 400), 0);
  assert.equal(sfxActivity(r, 9200), 0, "non-ducking clip");
});

test("transition sounds are placed on the join, centred on the whoosh", () => {
  const p = demoProject(undefined, { cuts: [[6000, 8000]] });
  p.transitions = [{ id: "t1", type: "whip-pan", joinSrcMs: 6000, durationMs: 400, direction: "left", intensity: 0.7, soundId: "whoosh-fast" }];
  const segs = segsOf(p);
  const r = resolveSfx(p, segs);
  assert.equal(r.length, 1);
  const j = joinsOf(segs)[0];
  assert.equal(j.outMs, 6000);
  const item = SFX_LIBRARY.find((s) => s.id === "whoosh-fast")!;
  assert.ok(Math.abs(r[0].outMs - (6000 - item.durationMs * 0.45)) < 1);
  assert.equal(r[0].synced, "transition");
  assert.equal(nearestJoin(joinsOf(segs), 6200)?.srcMs, 6000);
  assert.equal(nearestJoin(joinsOf(segs), 9000), null);
});

test("suggestions: keyword rules fire on the right words, are synced to word ids, spaced out and deterministic", () => {
  const p = demoProject("we got 100 percent success and then boom stop right there click the button now amazing");
  p.zooms = [{ id: "z1", startMs: 12000, endMs: 13500, scale: 1.3, focusX: 0.5, focusY: 0.5, rampMs: 300, source: "auto" }];
  const a = suggestSfx(p, segsOf(p));
  const b = suggestSfx(p, segsOf(p));
  assert.deepEqual(a.map((c) => [c.source, c.srcMs, c.syncWordId]), b.map((c) => [c.source, c.srcMs, c.syncWordId]));
  assert.ok(a.length >= 3);
  assert.ok(a.every((c) => c.auto));
  for (let i = 1; i < a.length; i++) assert.ok(a[i].srcMs - a[i - 1].srcMs >= 1400 - 1, "min spacing");
  const words = Object.fromEntries(p.captions.flatMap((c) => c.words).map((w) => [w.id, w.text]));
  for (const c of a) if (c.syncWordId) {
    const t = words[c.syncWordId];
    const id = c.source.kind === "library" ? c.source.id : "";
    if (id === "ding") assert.match(t, /100|success/i);
    if (id === "impact") assert.match(t, /boom|stop/i);
  }
  assert.ok(a.some((c) => c.source.kind === "library" && c.source.id === "whoosh-fast" && c.syncWordId === null), "zoom whoosh");
  // rate cap
  const dense = suggestSfx(p, segsOf(p), { minGapMs: 0, maxPerMinute: 2 });
  assert.ok(dense.length <= 2);
});

test("project round-trip: old projects without sfx/transitions/broll parse with empty defaults", async () => {
  const { projectSchema } = await import("../src/lib/project");
  const p = demoProject();
  const old: Record<string, unknown> = JSON.parse(JSON.stringify(p));
  for (const k of ["sfx", "sfxSettings", "transitions", "broll", "reframe"]) delete old[k];
  const q = projectSchema.parse(old);
  assert.deepEqual([q.sfx, q.transitions, q.broll, q.reframe.mode, q.sfxSettings.enabled], [[], [], [], "off", true]);
});

test("per-caption sounds sit on each caption's first word (word-synced) and respect spacing", () => {
  const p = demoProject("one two three four five six seven eight nine ten eleven twelve");
  const out = suggestSfx(p, segsOf(p), { perCaption: "pop", minGapMs: 700, includeJoins: false, includeZooms: false, maxPerMinute: 99 });
  const firsts = new Set(p.captions.map((c) => c.words[0].id));
  const pops = out.filter((c) => c.source.kind === "library" && c.source.id === "pop");
  assert.ok(pops.length >= 2 && pops.every((c) => c.syncWordId && firsts.has(c.syncWordId)));
  assert.equal(suggestSfx(p, segsOf(p), { perCaption: "nope", includeJoins: false, includeZooms: false }).filter((c) => c.label === "caption start").length, 0);
});
