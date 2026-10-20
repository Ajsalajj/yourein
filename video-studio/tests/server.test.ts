import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cadence-test-"));
process.env.DATA_DIR = tmp;

import { validateUpload } from "../src/lib/upload";
import { migrateProject, newProject, projectSchema, isSafeId, SCHEMA_VERSION } from "../src/lib/project";
import { silencesToCuts } from "../src/lib/silence";
import { suggestZooms } from "../src/lib/autozoom";
import { groupWords } from "../src/lib/captions/grouping";
import { distributeWords } from "../src/lib/captions/ops";

const head = (hex: string) => Uint8Array.from(Buffer.from(hex.padEnd(32, "0"), "hex"));

test("upload validation: extension, size and magic bytes", () => {
  assert.equal(validateUpload({ filename: "a.mp4", size: 10, kind: "video" }).ok, true);
  assert.equal(validateUpload({ filename: "a.MOV", size: 10, kind: "video" }).ok, true);
  assert.equal(validateUpload({ filename: "a.webm", size: 10, kind: "video" }).ok, true);
  assert.equal(validateUpload({ filename: "a.exe", size: 10, kind: "video" }).ok, false);
  assert.equal(validateUpload({ filename: "a.mp3", size: 10, kind: "video" }).ok, false, "audio is not a video");
  assert.equal(validateUpload({ filename: "a.mp4", size: 0, kind: "video" }).ok, false);
  assert.equal(validateUpload({ filename: "noext", size: 5, kind: "video" }).ok, false);
  assert.equal(validateUpload({ filename: "a.mp4.exe", size: 5, kind: "video" }).ok, false);
  const mp4 = head("00000018" + Buffer.from("ftypisom").toString("hex"));
  const webm = head("1a45dfa3");
  assert.equal(validateUpload({ filename: "a.mp4", size: 10, kind: "video", head: mp4 }).ok, true);
  assert.equal(validateUpload({ filename: "a.webm", size: 10, kind: "video", head: webm }).ok, true);
  assert.equal(validateUpload({ filename: "a.webm", size: 10, kind: "video", head: mp4 }).ok, false, "mp4 bytes with .webm name");
  assert.equal(validateUpload({ filename: "a.mp4", size: 10, kind: "video", head: head("4d5a9000") }).ok, false, "PE executable renamed to .mp4");
  assert.equal(validateUpload({ filename: "a.wav", size: 10, kind: "audio", head: Uint8Array.from(Buffer.from("RIFF\0\0\0\0WAVEfmt ")) }).ok, true);
  const r = validateUpload({ filename: "a.exe", size: 10, kind: "video" });
  assert.ok(!r.ok && r.status === 415);
});

test("ids are validated (path traversal)", () => {
  assert.ok(isSafeId("p1234567890"));
  for (const bad of ["../etc", "a/b", "", "short", "x".repeat(60), "a b c d e f", "..%2f..%2f1234"]) assert.ok(!isSafeId(bad), bad);
});

test("project schema round trip and versioning", () => {
  const p = newProject({ id: "proj123456", name: "T" });
  const again = migrateProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(again, p);
  assert.equal(p.schemaVersion, SCHEMA_VERSION);
  assert.throws(() => migrateProject({ ...p, schemaVersion: 99 }), /Unsupported/);
  assert.throws(() => migrateProject(null));
  assert.throws(() => projectSchema.parse({ ...p, aspect: "4:3" }));
});

test("asset storage keys cannot escape the project directory", () => {
  const p = newProject({ id: "proj123456", name: "T" });
  const base = { id: "a", kind: "video" as const, filename: "x.mp4", mime: "video/mp4", sizeBytes: 1, durationMs: 1000, hasAudio: false };
  for (const bad of ["../x.mp4", "/etc/passwd", "assets/../../x", "a b.mp4", "assets\\x.mp4"]) assert.throws(() => projectSchema.parse({ ...p, assets: { a: { ...base, storageKey: bad } } }));
  projectSchema.parse({ ...p, assets: { a: { ...base, storageKey: "assets/a.mp4" } } });
});

test("persistence: create, save, reload, duplicate, delete on disk", async () => {
  const s = await import("../src/server/storage");
  const p = await s.createProject("Persist me", "16:9");
  assert.ok(fs.existsSync(path.join(tmp, "projects", p.id, "project.json")));
  const words = distributeWords("saved across refresh".split(" "), 0, 1500, 0.9);
  const edited = { ...p, captions: groupWords(words), cuts: [{ id: "cut_aaaaaa", startMs: 100, endMs: 400, reason: "manual" as const }], captionStyle: { templateId: "karaoke", overrides: { fontSize: 77 }, position: { x: 0.4, y: 0.6 } } };
  await s.writeProject(edited);
  const back = await s.readProject(p.id);
  assert.equal(back.captions[0].text, "saved across refresh");
  assert.equal(back.cuts.length, 1);
  assert.equal(back.captionStyle.overrides.fontSize, 77);
  assert.equal(back.aspect, "16:9");
  const list = await s.listProjects();
  assert.ok(list.some((x) => x.id === p.id && x.captionCount === 1));
  const copy = await s.duplicateProject(p.id);
  assert.notEqual(copy.id, p.id);
  assert.equal((await s.readProject(copy.id)).captions[0].text, "saved across refresh");
  await s.deleteProject(copy.id);
  await assert.rejects(() => s.readProject(copy.id));
  await assert.rejects(() => s.readProject("../../etc"), /Invalid project id/);
  await assert.rejects(() => s.safeProjectPath(p.id, "../../secret"), /Invalid path/);
  await assert.rejects(() => s.safeProjectPath(p.id, "/etc/passwd"), /Invalid path/);
  // no temp files left behind by atomic writes
  assert.deepEqual(fs.readdirSync(path.join(tmp, "projects", p.id)).filter((f) => f.endsWith(".tmp")), []);
});

test("a corrupt project file is reported, not crashed on", async () => {
  const s = await import("../src/server/storage");
  const p = await s.createProject("Corrupt");
  fs.writeFileSync(path.join(tmp, "projects", p.id, "project.json"), "{not json");
  await assert.rejects(() => s.readProject(p.id), /corrupt/);
});

test("silence removal keeps natural pauses", () => {
  const cuts = silencesToCuts([{ startMs: 1000, endMs: 3000 }, { startMs: 5000, endMs: 5400 }], 10000, { minSilenceMs: 700, keepPadMs: 200 });
  assert.deepEqual(cuts, [{ startMs: 1200, endMs: 2800 }]);
  assert.deepEqual(silencesToCuts([{ startMs: 0, endMs: 600 }], 10000), []);
  assert.deepEqual(silencesToCuts([{ startMs: 1000, endMs: 1800 }], 10000, { minSilenceMs: 700, keepPadMs: 400 }), [], "padding eats short silences");
});

test("smart zoom: suggests at sentence starts/pauses, spaced apart, inside the video", () => {
  const w = [...distributeWords("Hello and welcome.".split(" "), 0, 2000), ...distributeWords("Today we learn editing.".split(" "), 3500, 6000), ...distributeWords("Thanks for watching".split(" "), 9000, 11000)].map((x) => ({ ...x, timingSource: "asr" as const }));
  const caps = groupWords(w, { wordsPerGroup: 6 });
  const zooms = suggestZooms(caps, 12000, { intensity: 1 });
  assert.ok(zooms.length >= 2);
  for (const z of zooms) { assert.ok(z.startMs >= 0 && z.endMs <= 12000 && z.endMs > z.startMs && z.scale > 1 && z.scale <= 3); assert.equal(z.source, "auto"); }
  for (let i = 1; i < zooms.length; i++) assert.ok(zooms[i].startMs - zooms[i - 1].startMs >= 3500 - 120, "spacing measured between candidate moments (zoom lead-in is 120 ms)");
  assert.deepEqual(suggestZooms([], 1000), []);
  assert.ok(suggestZooms(caps, 12000, { intensity: 2 })[0].scale > zooms[0].scale);
});
