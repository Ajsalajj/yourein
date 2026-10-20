import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFileSync } from "node:child_process";
import { sentencesOf, conceptsOf, suggestBroll, fitClipToSlot, brollOutputRange, placeBroll, panelProgress, splitLayout, activeSplit, fullBrollActive, clipFromSuggestion, overlappingBroll } from "../src/lib/broll";
import { brollSchema } from "../src/lib/edit-schema";
import { mapPexels, mapPixabay, pexels, pixabay } from "../src/server/broll/stock";
import { httpGenerator } from "../src/server/broll/generate";
import { isAllowedDownload } from "../src/server/broll/registry";
import { demoProject, segsOf } from "./helpers";

const SPEECH = "Hello everyone. Today I want to talk about money and the stock market. Last year I visited Tokyo and saw the ocean at sunrise. It was an amazing experience. Remember to subscribe for more.";
const proj = (cuts: [number, number][] = []) => demoProject(SPEECH, { cuts, durationMs: 40000 });

test("sentences split on terminal punctuation", () => {
  const s = sentencesOf(proj().captions);
  assert.equal(s.length, 5);
  assert.match(s[1].text, /money and the stock market\.$/);
  assert.ok(s.every((x, i) => i === 0 || x.startMs >= s[i - 1].endMs));
});

test("concepts: concrete nouns outrank abstractions, stop words never appear, proper nouns count", () => {
  const s = sentencesOf(proj().captions);
  const c1 = conceptsOf(s[1]).map((c) => c.keyword);
  assert.ok(c1.slice(0, 3).includes("money") && c1.includes("market"));
  assert.ok(!c1.includes("the") && !c1.includes("about"));
  const c2 = conceptsOf(s[2]);
  assert.ok(c2.some((c) => c.keyword === "ocean" && c.category === "nature"));
  assert.ok(c2.some((c) => c.keyword === "tokyo" && c.score >= 0.6), "capitalised mid-sentence word = proper noun");
  const abstract = conceptsOf(s[3]).find((c) => c.keyword === "experience");
  assert.ok(!abstract || abstract.score < 0.5);
});

test("suggestions: filmable sentences only, keyword-anchored, spaced, inside one kept segment, deterministic", () => {
  const p = proj();
  const segs = segsOf(p);
  const a = suggestBroll(p, segs, { skipFirstMs: 0 });
  assert.ok(a.length >= 2);
  assert.deepEqual(a.map((x) => [x.startMs, x.endMs, x.query]), suggestBroll(p, segs, { skipFirstMs: 0 }).map((x) => [x.startMs, x.endMs, x.query]));
  assert.ok(a.some((x) => /money|market/.test(x.query)) && a.some((x) => /ocean|tokyo/.test(x.query)));
  assert.ok(!a.some((x) => /subscribe/.test(x.query)), "no footage for a call to action");
  for (let i = 1; i < a.length; i++) assert.ok(a[i].startMs - a[i - 1].endMs >= 1500, "min gap");
  for (const x of a) assert.ok(x.endMs - x.startMs >= 900 && x.reason.length > 5 && x.keywords.length >= 1);
});

test("suggestions respect the opening hook, cuts and the coverage cap", () => {
  const p = proj([[3000, 9000]]);
  const segs = segsOf(p);
  const early = suggestBroll(p, segs, { skipFirstMs: 20000 });
  assert.ok(early.every((x) => x.startMs >= 20000));
  for (const x of suggestBroll(p, segs, { skipFirstMs: 0 })) {
    const seg = segs.find((g) => x.startMs >= g.srcStartMs && x.startMs < g.srcEndMs)!;
    assert.ok(seg && x.endMs <= seg.srcEndMs, "never straddles a cut");
    assert.ok(!(x.startMs < 9000 && x.endMs > 3000));
  }
  const tight = suggestBroll(p, segs, { skipFirstMs: 0, maxCoverage: 0.05 });
  const total = segs[segs.length - 1].outEndMs;
  assert.ok(tight.reduce((s, x) => s + x.endMs - x.startMs, 0) / total <= 0.05 + 1e-9);
});

test("fit: longer clips are trimmed (starting a little in), shorter ones shorten the slot, no stretching", () => {
  assert.deepEqual(fitClipToSlot(10000, 2500), { clipInMs: 1000, durationMs: 2500, slowed: false, trimmed: true });
  assert.deepEqual(fitClipToSlot(3000, 2500), { clipInMs: 250, durationMs: 2500, slowed: false, trimmed: true });
  assert.deepEqual(fitClipToSlot(1800, 2500), { clipInMs: 0, durationMs: 1800, slowed: false, trimmed: false });
  const sug = { startMs: 5000, endMs: 7500, keywords: ["ocean"], sentence: "I saw the ocean." };
  const c = clipFromSuggestion(sug, "a1", 1800);
  assert.equal(c.endMs - c.startMs, 1800);
  assert.equal(brollSchema.safeParse(c).success, true);
});

test("timing: B-roll maps through cuts to frame-exact output ranges and never gets a negative length", () => {
  const p = proj([[1000, 3000]]);
  const segs = segsOf(p);
  const c = brollSchema.parse({ id: "b1", assetId: "a1", startMs: 5000, endMs: 7000 });
  const r = brollOutputRange(c, segs, 30)!;
  assert.equal(r.from, Math.round(((5000 - 2000) * 30) / 1000));
  assert.equal(r.frames, 60);
  // a clip entirely inside removed footage collapses and is dropped
  assert.equal(brollOutputRange(brollSchema.parse({ id: "b2", assetId: "a1", startMs: 1200, endMs: 2800 }), segs, 30), null);
  const placed = placeBroll([c, brollSchema.parse({ id: "b0", assetId: "a1", startMs: 3500, endMs: 4500 })], segs, 30);
  assert.deepEqual(placed.map((x) => x.clip.id), ["b0", "b1"]);
  assert.deepEqual(overlappingBroll([c, brollSchema.parse({ id: "b3", assetId: "a1", startMs: 6000, endMs: 8000 })]), ["b3"]);
});

test("panel progress eases in and out; split layouts tile the frame without overlap; speaker box shrinks as the panel arrives", () => {
  const fps = 30;
  let prev = 0;
  for (let k = 0; k < 10; k++) { const p = panelProgress(k, 90, 350, fps); assert.ok(p >= prev && p <= 1); prev = p; }
  assert.equal(panelProgress(45, 90, 350, fps), 1);
  assert.ok(panelProgress(89, 90, 350, fps) < 0.5);
  for (const mode of ["split-top", "split-bottom", "split-left", "split-right"] as const) {
    const L = splitLayout(mode, 1);
    const vert = mode === "split-top" || mode === "split-bottom";
    const bs = vert ? L.broll.height : L.broll.width, ss = vert ? L.base.height : L.base.width;
    assert.ok(Math.abs(bs + ss - 1) < 1e-9, `${mode} tiles the frame`);
    const half = splitLayout(mode, 0.5);
    assert.ok((vert ? half.base.height : half.base.width) > ss, "base shrinks monotonically");
    const gone = splitLayout(mode, 0);
    assert.ok((vert ? gone.base.height : gone.base.width) === 1 && Math.abs(gone.slide.x) + Math.abs(gone.slide.y) === 1, "panel fully outside at p=0");
  }
  const p = proj();
  const segs = segsOf(p);
  const placed = placeBroll([brollSchema.parse({ id: "s", assetId: "a1", startMs: 2000, endMs: 4000, mode: "split-top" }), brollSchema.parse({ id: "f", assetId: "a1", startMs: 6000, endMs: 7000, mode: "full" })], segs, 30);
  assert.equal(activeSplit(placed, 30, 30), null);
  assert.equal(activeSplit(placed, 75, 30)?.clip.id, "s");
  assert.equal(fullBrollActive(placed, 75), false);
  assert.equal(fullBrollActive(placed, 190), true);
});

test("stock mapping: Pexels and Pixabay responses (documented shapes) -> usable, oriented, MP4 results", () => {
  const px = mapPexels({ videos: [{ id: 7, url: "https://www.pexels.com/video/ocean-waves-7/", image: "https://images.pexels.com/t.jpg", duration: 12, width: 1920, height: 1080, user: { name: "Ann" }, video_files: [
    { quality: "sd", file_type: "video/mp4", width: 640, height: 360, link: "https://videos.pexels.com/sd.mp4" },
    { quality: "hd", file_type: "video/mp4", width: 1080, height: 1920, link: "https://videos.pexels.com/portrait.mp4" },
    { quality: "uhd", file_type: "video/mp4", width: 3840, height: 2160, link: "https://videos.pexels.com/uhd.mp4" },
    { quality: "hls", file_type: "application/x-mpegURL", width: 1080, height: 1920, link: "https://videos.pexels.com/x.m3u8" }] }] }, "portrait");
  assert.equal(px.length, 1);
  assert.equal(px[0].downloadUrl, "https://videos.pexels.com/portrait.mp4");
  assert.equal(px[0].author, "Ann");
  assert.match(px[0].license, /Pexels/);
  const pb = mapPixabay({ hits: [{ id: 3, pageURL: "https://pixabay.com/videos/x-3/", tags: "ocean, wave", duration: 9, user: "Bo", videos: { large: { url: "https://cdn.pixabay.com/l.mp4", width: 1920, height: 1080 }, medium: { url: "https://cdn.pixabay.com/m.mp4", width: 1280, height: 720 }, tiny: { url: "https://cdn.pixabay.com/t.mp4", width: 640, height: 360 } } }] }, "landscape");
  assert.equal(pb[0].downloadUrl, "https://cdn.pixabay.com/l.mp4");
  assert.equal(pb[0].previewUrl, "https://cdn.pixabay.com/t.mp4");
  assert.deepEqual(mapPexels({}, "portrait"), []);
});

test("providers call the documented endpoints with credentials, filter by duration, and report missing configuration", async () => {
  const seen: { url: string; auth?: string }[] = [];
  const server = http.createServer((req, res) => {
    seen.push({ url: req.url!, auth: req.headers.authorization });
    res.setHeader("content-type", "application/json");
    if (req.url!.startsWith("/videos/search")) res.end(JSON.stringify({ videos: [{ id: 1, url: "https://www.pexels.com/video/a-1/", image: "", duration: 3, width: 1080, height: 1920, video_files: [{ file_type: "video/mp4", width: 1080, height: 1920, link: "https://videos.pexels.com/a.mp4" }] }, { id: 2, url: "https://www.pexels.com/video/b-2/", image: "", duration: 30, width: 1080, height: 1920, video_files: [{ file_type: "video/mp4", width: 1080, height: 1920, link: "https://videos.pexels.com/b.mp4" }] }] }));
    else res.end(JSON.stringify({ hits: [{ id: 9, pageURL: "p", duration: 5, videos: { medium: { url: "https://cdn.pixabay.com/m.mp4", width: 1280, height: 720 } } }] }));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const env = { PEXELS_API_KEY: "K1", PEXELS_API_BASE: base, PIXABAY_API_KEY: "K2", PIXABAY_API_BASE: base };
  const f = (u: string, i?: RequestInit) => fetch(u, i);
  const r = await pexels(f, env).search({ query: "ocean waves", orientation: "portrait", maxDurationSec: 10 });
  assert.deepEqual(r.map((x) => x.id), ["1"]);
  assert.match(seen[0].url, /query=ocean%20waves&orientation=portrait/);
  assert.equal(seen[0].auth, "K1");
  const r2 = await pixabay(f, env).search({ query: "ocean", orientation: "landscape" });
  assert.equal(r2[0].id, "9");
  assert.match(seen[1].url, /key=K2&q=ocean/);
  server.close();
  const st = await pexels(f, {}).status();
  assert.equal(st.ok, false);
  assert.match(String(st.hint), /PEXELS_API_KEY/);
  await assert.rejects(pexels(f, { PEXELS_API_KEY: "x", PEXELS_API_BASE: "http://127.0.0.1:1" }).search({ query: "a", orientation: "portrait" }));
});

test("download allowlist: https only, declared hosts or their subdomains, no look-alikes", () => {
  const hosts = ["videos.pexels.com", "pexels.com"];
  assert.ok(isAllowedDownload("https://videos.pexels.com/a.mp4", hosts));
  assert.ok(isAllowedDownload("https://cdn.pexels.com/a.mp4", hosts));
  assert.ok(!isAllowedDownload("http://videos.pexels.com/a.mp4", hosts));
  assert.ok(!isAllowedDownload("https://videos.pexels.com.evil.io/a.mp4", hosts));
  assert.ok(!isAllowedDownload("https://evilpexels.com/a.mp4", hosts));
  assert.ok(!isAllowedDownload("file:///etc/passwd", hosts));
  assert.ok(!isAllowedDownload("https://127.0.0.1/a.mp4", hosts));
  assert.ok(!isAllowedDownload("not a url", hosts));
});

test("generator adapter: immediate result, polling result, failure and timeout paths", async () => {
  const env = { BROLL_GEN_ENDPOINT: "https://gen.example.com/v1/jobs", BROLL_GEN_TOKEN: "T" };
  const calls: string[] = [];
  const seq = [{ statusUrl: "https://gen.example.com/s/1" }, { status: "running" }, { status: "done", downloadUrl: "https://gen.example.com/out.mp4" }];
  let i = 0;
  const fakeFetch = async (u: string, init?: RequestInit) => { calls.push(`${init?.method ?? "GET"} ${u} ${(init?.headers as Record<string, string>)?.Authorization ?? ""}`); return new Response(JSON.stringify(seq[i++]), { status: i === 1 ? 202 : 200 }); };
  const g = httpGenerator(fakeFetch as never, env, async () => undefined);
  const out = await g.generate({ prompt: "a wave", durationSec: 4, aspect: "9:16" });
  assert.equal(out.downloadUrl, "https://gen.example.com/out.mp4");
  assert.deepEqual(calls.map((c) => c.split(" ")[0]), ["POST", "GET", "GET"]);
  assert.ok(calls.every((c) => c.endsWith("Bearer T")));
  assert.ok(g.allowedHosts.includes("gen.example.com"));
  const failing = httpGenerator((async () => new Response(JSON.stringify({ statusUrl: "u" }))) as never, env, async () => undefined);
  await assert.rejects(failing.generate({ prompt: "x y z", durationSec: 3, aspect: "1:1" }), /timed out|failure|neither/);
  assert.equal(httpGenerator(fetch, {}).status().ok, false);
});

