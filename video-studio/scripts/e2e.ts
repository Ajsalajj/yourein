/**
 * End-to-end workflow against the RUNNING app (npm run dev + npm run ai):
 *   upload -> transcribe -> correct text -> choose style -> silence cuts -> smart zoom -> save -> export -> verify MP4
 * Usage: tsx scripts/e2e.ts [templateId]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { editCaptionText } from "../src/lib/captions/ops";
import { silencesToCuts } from "../src/lib/silence";
import { suggestZooms } from "../src/lib/autozoom";
import { getCompositionMeta } from "../src/lib/composition";
import type { Project } from "../src/lib/project";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const TEMPLATE = process.argv[2] ?? "bold-creator";
const OUT = process.env.E2E_OUT ?? path.resolve("data/e2e");
fs.mkdirSync(OUT, { recursive: true });
const SCRIPT = fs.readFileSync("data/samples/demo.txt", "utf8").trim();

const results: { step: string; ok: boolean; detail: string }[] = [];
const check = (step: string, ok: boolean, detail = "") => {
  results.push({ step, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${step}${detail ? " - " + detail : ""}`);
  if (!ok) throw new Error(`step failed: ${step}`);
};
async function api<T = any>(p: string, init?: RequestInit): Promise<{ status: number; body: T }> {
  const r = await fetch(BASE + p, { ...init, headers: { ...(init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {}), ...init?.headers } });
  const ct = r.headers.get("content-type") ?? "";
  return { status: r.status, body: (ct.includes("json") ? await r.json() : null) as T };
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // 1. project + validation
  const created = await api<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify({ name: "E2E demo" }) });
  check("create project", created.status === 200 && !!created.body.project.id);
  const id = created.body.project.id;

  const bad1 = await api(`/api/projects/${id}/upload?filename=evil.exe&kind=video`, { method: "POST", body: Buffer.from("MZ....") });
  check("reject wrong extension", bad1.status === 415, `status ${bad1.status}`);
  const bad2 = await api(`/api/projects/${id}/upload?filename=fake.mp4&kind=video`, { method: "POST", body: Buffer.from("this is definitely not a video file") });
  check("reject non-video content with .mp4 name", bad2.status === 415, `status ${bad2.status}`);
  const fakeHeader = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypisom"), Buffer.alloc(200, 1)]);
  const bad3 = await api(`/api/projects/${id}/upload?filename=broken.mp4&kind=video`, { method: "POST", body: fakeHeader });
  check("reject corrupt mp4 (ffprobe)", bad3.status === 422, `status ${bad3.status}`);
  const trav = await api(`/api/media/${id}/..%2F..%2Fproject.json`);
  check("media path traversal blocked", trav.status >= 400, `status ${trav.status}`);

  // 2. upload
  const file = fs.readFileSync("data/samples/demo.mp4");
  const up = await api<{ asset: any; project: Project }>(`/api/projects/${id}/upload?filename=demo.mp4&kind=video`, { method: "POST", body: file });
  check("upload video", up.status === 200 && up.body.asset.durationMs > 5000, `${up.body.asset?.width}x${up.body.asset?.height} ${up.body.asset?.durationMs}ms audio=${up.body.asset?.hasAudio}`);
  check("thumbnail served", (await fetch(`${BASE}/api/media/${id}/${up.body.asset.id}?thumb=1`)).headers.get("content-type") === "image/jpeg");
  const rng = await fetch(`${BASE}/api/media/${id}/${up.body.asset.id}`, { headers: { Range: "bytes=0-99" } });
  check("range request", rng.status === 206 && (await rng.arrayBuffer()).byteLength === 100);

  // 3. transcribe
  const tj = await api<{ jobId: string }>(`/api/projects/${id}/transcribe`, { method: "POST", body: JSON.stringify({ engine: "auto" }) });
  check("start transcription", tj.status === 200, JSON.stringify(tj.body));
  let st: any;
  for (let i = 0; i < 240; i++) {
    st = (await api(`/api/projects/${id}/transcribe?jobId=${tj.body.jobId}`)).body;
    if (st.status === "done" || st.status === "failed") break;
    await sleep(1000);
  }
  check("transcription finished", st.status === "done", JSON.stringify(st));
  let project = (await api<{ project: Project }>(`/api/projects/${id}`)).body.project;
  check("transcript stored with word timings", !!project.transcript && project.transcript.words.length > 3 && project.captions.length > 0, `engine=${project.transcript?.engine} words=${project.transcript?.words.length} captions=${project.captions.length}`);
  console.log("      ASR said:", project.transcript!.words.map((w) => w.text).join(" "));
  console.log("      warnings:", project.transcript!.warnings.join(" | ").slice(0, 200));

  // 4. correct the transcript with the real editing ops (ASR is imperfect: that is the point)
  const tokens = SCRIPT.split(/\s+/);
  const totalWords = project.captions.reduce((a, c) => a + c.words.length, 0);
  let cursor = 0;
  let caps = project.captions;
  for (const c of [...project.captions]) {
    const take = Math.round((c.words.length / totalWords) * tokens.length);
    const slice = tokens.slice(cursor, cursor + take).join(" ");
    cursor += take;
    if (slice) caps = editCaptionText(caps, c.id, slice);
  }
  if (cursor < tokens.length) caps = editCaptionText(caps, caps[caps.length - 1].id, caps[caps.length - 1].text + " " + tokens.slice(cursor).join(" "));
  project = { ...project, captions: caps };
  check("captions corrected", project.captions.map((c) => c.text).join(" ").length > SCRIPT.length * 0.8);

  // 5. style, silence cuts (EDL), smart zoom
  project.captionStyle = { templateId: TEMPLATE, overrides: {}, position: { x: 0.5, y: 0.72 } };
  const dur = project.assets[project.sourceAssetId!].durationMs;
  const sil = await api<{ silences: { startMs: number; endMs: number }[] }>(`/api/projects/${id}/analyze`, { method: "POST", body: JSON.stringify({ kind: "silence", noiseDb: -35, minSilenceMs: 500 }) });
  check("silence analysis", sil.status === 200, `${sil.body.silences.length} silences`);
  const cuts = silencesToCuts(sil.body.silences, dur, { minSilenceMs: 500, keepPadMs: 150 });
  project.cuts = cuts.map((c, i) => ({ id: `cut_e2e_${i}_aaaaaa`, ...c, reason: "silence" as const }));
  project.zooms = suggestZooms(project.captions, dur, { intensity: 1 });
  const meta = getCompositionMeta(project);
  console.log(`      cuts=${cuts.length} (removing ${Math.round(cuts.reduce((a, c) => a + c.endMs - c.startMs, 0))}ms) zooms=${project.zooms.length} output=${meta.durationInFrames}f`);
  const saved = await api<{ project: Project }>(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(project) });
  check("save project (persistence)", saved.status === 200);
  const reread = (await api<{ project: Project }>(`/api/projects/${id}`)).body.project;
  check("project reloads identically", JSON.stringify(reread.captions) === JSON.stringify(project.captions) && reread.cuts.length === project.cuts.length && reread.captionStyle.templateId === TEMPLATE);

  // 6. export (twice: with captions, and a control render without them for the pixel test)
  async function render(label: string, proj: Project) {
    await api(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(proj) });
    const t0 = Date.now();
    const j = await api<{ job: any }>(`/api/projects/${id}/export`, { method: "POST", body: JSON.stringify({ quality: "standard" }) });
    check(`${label}: export started`, j.status === 200, j.body.job?.id);
    let job = j.body.job;
    let early: number | null = null;
    for (let i = 0; i < 900; i++) {
      job = (await api(`/api/projects/${id}/export/${job.id}`)).body.job;
      if (job.status === "rendering" && job.progress > 0 && early === null) early = job.progress;
      if (["done", "failed", "cancelled"].includes(job.status)) break;
      await sleep(1000);
    }
    check(`${label}: export finished`, job.status === "done", `${job.status} ${job.error ?? ""} in ${Math.round((Date.now() - t0) / 1000)}s`);
    const dl = await fetch(`${BASE}/api/projects/${id}/export/${job.id}/download`);
    const file = path.join(OUT, `${label}.mp4`);
    fs.writeFileSync(file, Buffer.from(await dl.arrayBuffer()));
    check(`${label}: downloaded`, dl.status === 200 && fs.statSync(file).size > 10_000, `${fs.statSync(file).size} bytes`);
    return { file, job };
  }
  const withCaps = await render("with-captions", project);
  const probe = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", withCaps.file], { encoding: "utf8" }));
  const v = probe.streams.find((s: any) => s.codec_type === "video");
  const a = probe.streams.find((s: any) => s.codec_type === "audio");
  check("MP4 is H.264 1080x1920 30fps", v.codec_name === "h264" && v.width === 1080 && v.height === 1920 && v.avg_frame_rate === "30/1", `${v.codec_name} ${v.width}x${v.height} ${v.avg_frame_rate}`);
  check("MP4 has AAC audio", a?.codec_name === "aac");
  const expectMs = (meta.durationInFrames * 1000) / 30;
  const gotMs = Number(probe.format.duration) * 1000;
  check("duration respects the edit decision list", Math.abs(gotMs - expectMs) < 120 && gotMs < dur - 200, `expected ${Math.round(expectMs)}ms got ${Math.round(gotMs)}ms (source ${dur}ms)`);

  const noCaps = await render("no-captions", { ...project, captionsVisible: false });

  // 7. pixel proof that animated captions are in the video
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ captions: project.captions.map((c) => ({ s: c.startMs, e: c.endMs, t: c.text })), segments: meta.segments }, null, 1));
  const out = execFileSync("python3", ["-I", "scripts/dev/verify_captions.py", withCaps.file, noCaps.file, path.join(OUT, "meta.json"), OUT], { encoding: "utf8", env: { ...process.env, PATH: process.env.PATH } });
  console.log(out.trim());
  const verdict = JSON.parse(out.trim().split("\n").pop()!);
  check("captions visible: caption region differs from control render", verdict.captionVsControl > 4, `mean diff ${verdict.captionVsControl.toFixed(2)}`);
  check("control render without captions is clean", verdict.controlNoise < 2.5, `noise ${verdict.controlNoise.toFixed(2)}`);
  check("captions are animated: frames inside a group differ", verdict.animated > 1.5, `mean frame-to-frame ${verdict.animated.toFixed(2)}`);

  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ template: TEMPLATE, results }, null, 1));
  console.log(`\nALL ${results.length} CHECKS PASSED. Output: ${OUT}`);
}
main().catch((e) => { console.error("\nE2E FAILED:", e.message); fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify({ template: TEMPLATE, results, error: e.message }, null, 1)); process.exit(1); });
