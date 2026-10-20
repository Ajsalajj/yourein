/** Creates a project from samples/: uploads demo-input.mp4 and applies the saved captions, cuts, zooms and style. */
import fs from "node:fs";
import { projectSchema } from "../src/lib/project";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const j = async (p: string, init?: RequestInit) => {
  const r = await fetch(BASE + p, { ...init, headers: init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {} });
  const b = await r.json();
  if (!r.ok) throw new Error(`${p}: ${b.error}`);
  return b;
};
async function main() {
const sample = JSON.parse(fs.readFileSync("samples/sample.project.json", "utf8"));
const { project } = await j("/api/projects", { method: "POST", body: JSON.stringify({ name: "Sample project (Bold Creator)", aspect: sample.aspect }) });
const up = await j(`/api/projects/${project.id}/upload?filename=demo-input.mp4&kind=video`, { method: "POST", body: fs.readFileSync("samples/demo-input.mp4") });
const merged = projectSchema.parse({ ...up.project, captions: sample.captions, cuts: sample.cuts, zooms: sample.zooms, captionStyle: sample.captionStyle, audio: sample.audio, textLayers: sample.textLayers });
await j(`/api/projects/${project.id}`, { method: "PUT", body: JSON.stringify(merged) });
console.log(`Sample project ready: ${BASE}/editor/${project.id}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
