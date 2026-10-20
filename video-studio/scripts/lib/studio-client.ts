/** Shared helpers for validation scripts that drive the running app over HTTP. */
import fs from "node:fs";
import path from "node:path";
import type { Project } from "../../src/lib/project";

export const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
export const AI = process.env.AI_URL ?? "http://127.0.0.1:8100";
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function j(p: string, init?: RequestInit) {
  const r = await fetch(BASE + p, { ...init, headers: init?.body && typeof init.body === "string" ? { "Content-Type": "application/json" } : {} });
  const b: any = await r.json();
  if (!r.ok) throw new Error(`${p}: ${b.error}`);
  return b;
}

export async function createProject(name: string, files: { file: string; kind?: "video" | "audio" | "image" }[]): Promise<{ id: string; assets: any[] }> {
  const { project } = await j("/api/projects", { method: "POST", body: JSON.stringify({ name }) });
  const assets: any[] = [];
  for (const f of files) {
    const up = await j(`/api/projects/${project.id}/upload?filename=${encodeURIComponent(path.basename(f.file))}&kind=${f.kind ?? "video"}`, { method: "POST", body: fs.readFileSync(f.file) });
    assets.push(up.asset);
  }
  return { id: project.id, assets };
}
export const getProject = async (id: string): Promise<Project> => (await j(`/api/projects/${id}`)).project;
export const putProject = (id: string, p: Project) => j(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify(p) });

/** Save the project, run a real export and download the MP4 to `outFile`. Returns timing and the job. */
export async function renderProject(id: string, p: Project, outFile: string, quality: "standard" | "high" = "standard") {
  await putProject(id, p);
  let { job } = await j(`/api/projects/${id}/export`, { method: "POST", body: JSON.stringify({ quality }) });
  const s = Date.now();
  while (!["done", "failed", "cancelled"].includes(job.status)) { await sleep(1500); job = (await j(`/api/projects/${id}/export/${job.id}`)).job; }
  if (job.status !== "done") throw new Error(`export ${job.status}: ${job.error}`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, Buffer.from(await (await fetch(`${BASE}/api/projects/${id}/export/${job.id}/download`)).arrayBuffer()));
  return { seconds: (Date.now() - s) / 1000, job, bytes: fs.statSync(outFile).size };
}
