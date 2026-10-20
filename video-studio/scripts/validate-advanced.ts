/**
 * Advanced-effects validation against the running app + AI service:
 *   segmentation (neural) -> tracking (optical flow) -> composition with behind-subject title, perspective title,
 *   tracked callout and behind-subject captions -> real export -> pixel verification (scripts/dev/verify_advanced.py).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { TITLE_COMPOSITIONS } from "../src/lib/titles";
import { sourceToCanvas } from "../src/lib/tracking";
import { distributeWords } from "../src/lib/captions/ops";
import { groupWords } from "../src/lib/captions/grouping";
import type { Project } from "../src/lib/project";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation-advanced");
fs.mkdirSync(OUT, { recursive: true });
const j = async (p: string, init?: RequestInit) => {
  const r = await fetch(BASE + p, { ...init, headers: init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {} });
  const b: any = await r.json();
  if (!r.ok) throw new Error(`${p}: ${b.error}`);
  return b;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function poll(url: string) {
  for (;;) {
    const s = await j(url);
    if (s.status === "failed") throw new Error(s.error);
    if (s.status === "done") return;
    await sleep(700);
  }
}

async function main() {
  const { project } = await j("/api/projects", { method: "POST", body: JSON.stringify({ name: "Advanced effects validation" }) });
  const id = project.id;
  const up = await j(`/api/projects/${id}/upload?filename=person.mp4&kind=video`, { method: "POST", body: fs.readFileSync("data/samples/person.mp4") });
  console.log("uploaded", up.asset.width + "x" + up.asset.height, up.asset.durationMs + "ms");

  let t0 = Date.now();
  const seg = await j(`/api/projects/${id}/segment`, { method: "POST" });
  await poll(`/api/projects/${id}/segment?jobId=${seg.jobId}&maskId=${seg.maskId}`);
  console.log(`segmentation done in ${Date.now() - t0} ms`);

  // the mission patch on the suit (normalised source coordinates at t=0)
  const roi = { x: 0.26, y: 0.635, w: 0.15, h: 0.095 };
  t0 = Date.now();
  const trk = await j(`/api/projects/${id}/track`, { method: "POST", body: JSON.stringify({ roi, startMs: 0, label: "Mission patch" }) });
  await poll(`/api/projects/${id}/track?jobId=${trk.jobId}&trackId=${trk.trackId}&label=Mission%20patch`);
  console.log(`tracking done in ${Date.now() - t0} ms`);

  const p: Project = (await j(`/api/projects/${id}`)).project;
  const dur = p.assets[p.sourceAssetId!].durationMs;
  const track = p.analysis.tracks[trk.trackId];
  const A = p.assets[p.sourceAssetId!];
  const mk = (cid: string, text: string, extra: Record<string, unknown> = {}) => TITLE_COMPOSITIONS.find((c) => c.id === cid)!.make({ startMs: 300, endMs: dur - 300, text, trackId: trk.trackId, ...extra });
  const callout = mk("tracked-callout", "MISSION PATCH");
  const p0 = sourceToCanvas(track.points[0][0], track.points[0][1], A.width!, A.height!, 1080, 1920);
  callout[0] = { ...callout[0], x: p0.x, y: Math.max(0.05, p0.y - 0.09) };
  p.textLayers = [...mk("behind-headline", "Explorer"), ...mk("floor-title", "Space Age"), ...callout];
  const words = distributeWords("Meet the explorer. Titles sit behind her, labels follow her patch".split(" "), 600, dur - 800, 0.9);
  p.captions = groupWords(words, { wordsPerGroup: 4 });
  p.captionStyle = { templateId: "bold-cinematic", overrides: { fontSize: 66 }, position: { x: 0.5, y: 0.9 } };
  await j(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(p) });
  const saved: Project = (await j(`/api/projects/${id}`)).project;
  if (!saved.analysis.segmentation || !saved.analysis.tracks[trk.trackId]) throw new Error("analysis was lost on save");
  fs.writeFileSync(path.join(OUT, "truth.json"), JSON.stringify({ track: { start: track.points[0], n: track.points.length }, callout: { x: callout[0].x, y: callout[0].y }, patchRoi: roi }, null, 1));

  async function render(label: string, proj: Project) {
    await j(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(proj) });
    let { job } = await j(`/api/projects/${id}/export`, { method: "POST", body: JSON.stringify({ quality: "standard" }) });
    const s = Date.now();
    while (!["done", "failed", "cancelled"].includes(job.status)) { await sleep(2000); job = (await j(`/api/projects/${id}/export/${job.id}`)).job; }
    if (job.status !== "done") throw new Error(`${label}: ${job.status} ${job.error}`);
    const f = path.join(OUT, `${label}.mp4`);
    fs.writeFileSync(f, Buffer.from(await (await fetch(`${BASE}/api/projects/${id}/export/${job.id}/download`)).arrayBuffer()));
    console.log(`${label}: ${(fs.statSync(f).size / 1e6).toFixed(1)} MB in ${Math.round((Date.now() - s) / 1000)}s`);
    return f;
  }
  const full = await render("advanced", saved);
  // control: identical project but nothing is "behind" - titles drawn on top of the person
  const ctrl: Project = { ...saved, textLayers: saved.textLayers.map((t) => ({ ...t, behind: false })), captionsBehindSubject: false };
  const control = await render("control-front", ctrl);

  const out = execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_advanced.py", full, control, "data/samples/person.mp4", path.join(OUT, "truth.json"), OUT], { encoding: "utf8" });
  console.log(out);
}
main().catch((e) => { console.error("ADVANCED VALIDATION FAILED:", e.message); process.exit(1); });
