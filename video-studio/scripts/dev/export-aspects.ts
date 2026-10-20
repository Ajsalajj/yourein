/** Exports the newest "E2E demo" project in 16:9 and 1:1 and verifies the real file dimensions with ffprobe. */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const BASE = "http://127.0.0.1:3100";
const j = async (p: string, init?: RequestInit) => (await fetch(BASE + p, { ...init, headers: init?.body ? { "Content-Type": "application/json" } : {} })).json() as Promise<any>;
async function main() {
const { projects } = await j("/api/projects");
const meta = projects.find((p: any) => p.name === "E2E demo" && p.captionCount > 0);
const { project } = await j(`/api/projects/${meta.id}`);
for (const [aspect, w, h] of [["16:9", 1920, 1080], ["1:1", 1080, 1080]] as const) {
  await j(`/api/projects/${meta.id}`, { method: "PUT", body: JSON.stringify({ ...project, aspect }) });
  let { job } = await j(`/api/projects/${meta.id}/export`, { method: "POST", body: JSON.stringify({ quality: "standard" }) });
  while (!["done", "failed", "cancelled"].includes(job.status)) { await new Promise((r) => setTimeout(r, 1500)); job = (await j(`/api/projects/${meta.id}/export/${job.id}`)).job; }
  if (job.status !== "done") throw new Error(`${aspect}: ${job.status} ${job.error}`);
  const file = `data/e2e/aspect-${aspect.replace(":", "x")}.mp4`;
  fs.writeFileSync(file, Buffer.from(await (await fetch(`${BASE}/api/projects/${meta.id}/export/${job.id}/download`)).arrayBuffer()));
  const out = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,codec_name,avg_frame_rate", "-of", "csv=p=0", file], { encoding: "utf8" }).trim().replace(/,$/, "");
  console.log(`${out === `h264,${w},${h},30/1` ? "PASS" : "FAIL"}  ${aspect} export -> ${out} (expected h264,${w},${h},30/1)`);
}
}
main().catch((e) => { console.error(e.message); process.exit(1); });
