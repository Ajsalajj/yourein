/**
 * Phase-2 visual validation: five style families on one project (real MP4 export), a no-caption control render of the
 * same project, then pixel analysis per caption (scripts/dev/verify_phase2.py): before / entry / peak / settled / exit
 * frames, overshoot ratio, bbox containment (clipping), per-word style independence and contact sheets.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { distributeWords } from "../src/lib/captions/ops";
import { recomputeCaption } from "../src/lib/captions/ops";
import type { Caption, Project } from "../src/lib/project";
import { uid } from "../src/lib/project";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation-phase2");
const ASPECT = (process.env.ASPECT ?? "9:16") as Project["aspect"];
fs.mkdirSync(OUT, { recursive: true });
const j = async (p: string, init?: RequestInit) => {
  const r = await fetch(BASE + p, { ...init, headers: init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {} });
  const b: any = await r.json();
  if (!r.ok) throw new Error(`${p}: ${b.error}`);
  return b;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** one caption per family; window = [start, end) in ms */
const PLAN = [
  { key: "white-kinetic", template: "bold-white-kinetic", text: "STOP SCROLLING NOW", start: 100, end: 1300 },
  { key: "green-italic", template: "green-italic-impact", text: "this is growth", start: 1600, end: 2800 },
  { key: "purple-3d", template: "purple-3d-punch", text: "BUILD IT BIG", start: 3100, end: 4300 },
  { key: "neon-glow", template: "neon-cyan-glow", text: "feel the glow", start: 4600, end: 5800 },
  { key: "cinematic-yellow", template: "cinematic-giant-headline", text: "FUTURE IS HERE", start: 6100, end: 7300 },
];

async function main() {
  const { project } = await j("/api/projects", { method: "POST", body: JSON.stringify({ name: "Phase 2 comparison" }) });
  const id = project.id;
  await j(`/api/projects/${id}/upload?filename=person.mp4&kind=video`, { method: "POST", body: fs.readFileSync("data/samples/person.mp4") });
  const p: Project = (await j(`/api/projects/${id}`)).project;
  const captions: Caption[] = PLAN.map((c) => recomputeCaption({ id: uid("c_"), text: c.text, startMs: c.start, endMs: c.end, words: distributeWords(c.text.split(" "), c.start, c.start + (c.end - c.start) * 0.5, 0.95).map((w) => ({ ...w, timingSource: "asr" as const })), styleId: c.template, animationId: null, confidence: 0.95 } as Caption));
  // per-word independence: restyle the 2nd word of caption 1 only
  const target = captions[0].words[1].id;
  p.aspect = ASPECT;
  p.captions = captions;
  p.captionStyle = { templateId: "bold-white-kinetic", overrides: {}, position: { x: 0.5, y: 0.5 } };
  p.wordStyles = { [target]: { color: "#ff2d55", sizeScale: 1.15 } };
  const render = async (label: string, proj: Project) => {
    await j(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(proj) });
    let { job } = await j(`/api/projects/${id}/export`, { method: "POST", body: JSON.stringify({ quality: "standard" }) });
    const s = Date.now();
    while (!["done", "failed", "cancelled"].includes(job.status)) { await sleep(2000); job = (await j(`/api/projects/${id}/export/${job.id}`)).job; }
    if (job.status !== "done") throw new Error(`${label}: ${job.status} ${job.error}`);
    const f = path.join(OUT, `${label}.mp4`);
    fs.writeFileSync(f, Buffer.from(await (await fetch(`${BASE}/api/projects/${id}/export/${job.id}/download`)).arrayBuffer()));
    console.log(`${label}: ${(fs.statSync(f).size / 1e6).toFixed(1)} MB in ${Math.round((Date.now() - s) / 1000)}s`);
    return f;
  };
  const full = await render("captioned", p);
  const control = await render("control", { ...p, captionsVisible: false });
  fs.writeFileSync(path.join(OUT, "plan.json"), JSON.stringify({ plan: PLAN, targetWordIndex: 1, captions: captions.map((c) => c.words.map((w) => ({ id: w.id, text: w.text, startMs: w.startMs, endMs: w.endMs }))) }, null, 1));
  console.log(execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_phase2.py", full, control, path.join(OUT, "plan.json"), OUT], { encoding: "utf8" }));
}
main().catch((e) => { console.error("PHASE2 VALIDATION FAILED:", e.message); process.exit(1); });
