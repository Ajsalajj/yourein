import test from "node:test";
import assert from "node:assert/strict";
import { followTrack, sourceToCanvas, trackAt } from "../src/lib/tracking";
import { migrateProject, newProject, newTextLayer, projectSchema, trackSchema, SCHEMA_VERSION, type Track } from "../src/lib/project";
import { TITLE_COMPOSITIONS } from "../src/lib/titles";

const track: Track = {
  id: "k1234567", label: "t", fps: 30, startFrame: 30, method: "lk", roi: { x: 0, y: 0, w: 0.1, h: 0.1 }, sourceAssetId: "a", createdAt: "x",
  points: [[0.5, 0.5, 1], [0.6, 0.5, 1.1], [0.7, 0.6, 1.2], [0.8, 0.6, 1.3]],
};

test("trackAt interpolates between frames and clamps outside the tracked range", () => {
  assert.deepEqual(trackAt(track, 0), { x: 0.5, y: 0.5, scale: 1 });            // before start -> first sample
  const mid = trackAt(track, 1000 + 1000 / 30 / 2);                              // half-way between sample 0 and 1
  assert.ok(Math.abs(mid.x - 0.55) < 1e-9 && Math.abs(mid.scale - 1.05) < 1e-9);
  assert.deepEqual(trackAt(track, 60000), { x: 0.8, y: 0.6, scale: 1.3 });       // after end -> last sample
});

test("source->canvas mapping is identity for equal aspect and crops for object-fit: cover", () => {
  const same = sourceToCanvas(0.3, 0.7, 720, 1280, 1080, 1920);
  assert.ok(Math.abs(same.x - 0.3) < 1e-9 && Math.abs(same.y - 0.7) < 1e-9);
  // landscape 1920x1080 source into a 1080x1920 canvas: centre stays centre, left/right edges are cropped away
  const c = sourceToCanvas(0.5, 0.5, 1920, 1080, 1080, 1920);
  assert.ok(Math.abs(c.x - 0.5) < 1e-9 && Math.abs(c.y - 0.5) < 1e-9);
  assert.ok(sourceToCanvas(0.1, 0.5, 1920, 1080, 1080, 1920).x < 0, "a point near the left edge is cropped off-canvas");
});

test("followTrack moves a layer by the tracked delta and reports scale change", () => {
  const f = followTrack(track, 60000, { x: 0.5, y: 0.2 }, { w: 720, h: 1280 }, { w: 1080, h: 1920 });
  assert.ok(Math.abs(f.x - 0.8) < 1e-9 && Math.abs(f.y - 0.3) < 1e-9 && Math.abs(f.scale - 1.3) < 1e-9);
  const start = followTrack(track, 0, { x: 0.5, y: 0.2 }, { w: 720, h: 1280 }, { w: 1080, h: 1920 });
  assert.ok(Math.abs(start.x - 0.5) < 1e-9 && Math.abs(start.y - 0.2) < 1e-9, "at the first frame the layer sits where it was placed");
});

test("projects saved before the advanced effects still load (defaults fill the new fields)", () => {
  const old: any = JSON.parse(JSON.stringify(newProject({ id: "legacy0001", name: "old" })));
  delete old.analysis; delete old.captionsBehindSubject;
  old.textLayers = [{ id: "t1", text: "hi", startMs: 0, endMs: 1000, x: 0.5, y: 0.5, fontSize: 80, color: "#fff", fontFamily: "Inter", fontWeight: 700, backgroundColor: "transparent" }];
  const p = migrateProject(old);
  assert.equal(p.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(p.analysis, { faces: null, segmentation: null, tracks: {} });
  assert.equal(p.captionsBehindSubject, false);
  assert.equal(p.textLayers[0].behind, false);
  assert.equal(p.textLayers[0].trackId, null);
  assert.equal(p.textLayers[0].perspective, null);
  assert.equal(p.textLayers[0].animation, "none");
});

test("schema validation of tracks, perspective and text layers", () => {
  assert.throws(() => trackSchema.parse({ ...track, points: [] }));
  assert.throws(() => newTextLayer({ text: "x", startMs: 0, endMs: 1, perspective: { rotateX: 120, rotateY: 0, rotateZ: 0, depth: 1000 } }));
  const l = newTextLayer({ text: "x", startMs: 0, endMs: 1000 });
  assert.equal(l.behind, false);
  const p = newProject({ id: "adv0000001", name: "a" });
  projectSchema.parse({ ...p, textLayers: [l], analysis: { segmentation: null, tracks: { k1234567: track } } });
});

test("title compositions build valid layers and declare what they need", () => {
  assert.ok(TITLE_COMPOSITIONS.length >= 4);
  for (const c of TITLE_COMPOSITIONS) {
    const layers = c.make({ startMs: 100, endMs: 3000, text: "Hello", trackId: "k1234567" });
    assert.ok(layers.length >= 1, c.id);
    for (const l of layers) { assert.equal(l.startMs, 100); assert.ok(l.fontSize > 0); }
    if (c.needs === "mask") assert.ok(layers.every((l) => l.behind), `${c.id} should draw behind the subject`);
    if (c.needs === "track") assert.ok(layers.every((l) => l.trackId === "k1234567"));
  }
  const floor = TITLE_COMPOSITIONS.find((c) => c.id === "floor-title")!.make({ startMs: 0, endMs: 1000, text: "x" })[0];
  assert.ok(floor.perspective && floor.perspective.rotateX > 30, "spatial title must use real perspective");
});
