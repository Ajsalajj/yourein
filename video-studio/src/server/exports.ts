import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { uid, type Project } from "../lib/project";
import { getCompositionMeta } from "../lib/composition";
import { config } from "./config";
import { HttpError } from "./http";
import { projectDir, readProject } from "./storage";

export type ExportStatus = "queued" | "bundling" | "preparing" | "rendering" | "verifying" | "done" | "failed" | "cancelled";
export interface ExportJob {
  id: string;
  projectId: string;
  status: ExportStatus;
  progress: number;
  createdAt: string;
  finishedAt?: string;
  error?: string;
  quality: "standard" | "high";
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  outputBytes?: number;
  verification?: Record<string, unknown>;
  filename?: string;
}

const g = globalThis as unknown as { __exportProcs?: Map<string, ChildProcess> };
const procs = (g.__exportProcs ??= new Map());

const jobDir = (projectId: string, jobId: string) => {
  if (!/^[a-z0-9]{6,32}$/i.test(jobId)) throw new HttpError(400, "Invalid job id");
  return path.join(projectDir(projectId), "exports", jobId);
};

async function save(job: ExportJob) {
  const file = path.join(jobDir(job.projectId, job.id), "job.json");
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(job, null, 1));
  await fs.rename(tmp, file); // atomic: pollers never see a half-written file
}

export async function getJob(projectId: string, jobId: string): Promise<ExportJob> {
  try {
    const job = JSON.parse(await fs.readFile(path.join(jobDir(projectId, jobId), "job.json"), "utf8")) as ExportJob;
    // A job that claims to run but has no live process (server restarted) is dead.
    if (!["done", "failed", "cancelled"].includes(job.status) && !procs.has(jobId)) {
      job.status = "failed";
      job.error = "Render process is no longer running (server restarted?)";
      await save(job);
    }
    return job;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError(404, "Export not found");
  }
}

export async function listJobs(projectId: string): Promise<ExportJob[]> {
  const dir = path.join(projectDir(projectId), "exports");
  if (!existsSync(dir)) return [];
  const out: ExportJob[] = [];
  for (const n of await fs.readdir(dir)) {
    try {
      out.push(await getJob(projectId, n));
    } catch {
      /* ignore */
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function outputPath(job: ExportJob) {
  return path.join(jobDir(job.projectId, job.id), "output.mp4");
}

export function mediaUrls(project: Project): Record<string, string> {
  const q = config.accessToken ? `?token=${encodeURIComponent(config.accessToken)}` : "";
  return Object.fromEntries(Object.values(project.assets).map((a) => [a.id, `${config.internalBaseUrl}/api/media/${project.id}/${a.id}${q}`]));
}

export async function startExport(projectId: string, opts: { quality: "standard" | "high" }): Promise<ExportJob> {
  const project = await readProject(projectId);
  const src = project.sourceAssetId ? project.assets[project.sourceAssetId] : null;
  if (!src) throw new HttpError(400, "This project has no video yet");
  const meta = getCompositionMeta(project);
  if (meta.segments.length === 0) throw new HttpError(400, "Nothing to export: every part of the video has been cut");

  const id = uid("e").toLowerCase();
  const dir = jobDir(projectId, id);
  await fs.mkdir(dir, { recursive: true });
  const job: ExportJob = { id, projectId, status: "queued", progress: 0, createdAt: new Date().toISOString(), quality: opts.quality, width: meta.width, height: meta.height, fps: meta.fps, durationInFrames: meta.durationInFrames };
  await save(job);
  await fs.writeFile(
    path.join(dir, "input.json"),
    JSON.stringify({
      props: { project, mediaUrls: mediaUrls(project) },
      options: { crf: opts.quality === "high" ? 16 : 20, browserExecutable: config.browserExecutable || undefined, gl: config.renderGl, concurrency: config.renderConcurrency },
      expected: { width: meta.width, height: meta.height, fps: meta.fps, durationInFrames: meta.durationInFrames, hasAudio: src.hasAudio || !!project.audio.music },
      ffprobe: config.ffprobe,
    }),
  );

  const child = spawn(process.execPath, ["--import", "tsx", path.join(process.cwd(), "scripts/render-worker.ts"), dir], { cwd: process.cwd(), detached: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "production" } });
  procs.set(id, child);
  let buf = "";
  let stderr = "";
  let chain: Promise<void> = Promise.resolve();
  const update = (fn: (j: ExportJob) => void) => {
    chain = chain.then(async () => {
      const cur = JSON.parse(await fs.readFile(path.join(dir, "job.json"), "utf8")) as ExportJob;
      if (["cancelled", "done", "failed"].includes(cur.status)) return;
      fn(cur);
      await save(cur);
    });
    return chain;
  };
  child.stdout!.on("data", (d: Buffer) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      try {
        const m = JSON.parse(line);
        if (m.type === "stage") void update((j) => void (j.status = m.stage));
        else if (m.type === "progress") void update((j) => { j.status = "rendering"; j.progress = Math.min(0.99, m.progress); });
        else if (m.type === "done") void update((j) => { j.status = m.verification.ok ? "done" : "failed"; j.progress = 1; j.outputBytes = m.bytes; j.verification = m.verification; j.finishedAt = new Date().toISOString(); j.filename = `${safeName(project.name)}.mp4`; if (!m.verification.ok) j.error = `Output failed verification: ${m.verification.problems.join("; ")}`; });
        else if (m.type === "error") void update((j) => { j.status = "failed"; j.error = m.message; j.finishedAt = new Date().toISOString(); });
      } catch {
        /* non-JSON noise from Chromium/webpack */
      }
    }
  });
  child.stderr!.on("data", (d: Buffer) => (stderr = (stderr + d.toString()).slice(-4000)));
  child.on("close", (code) => {
    procs.delete(id);
    void update((j) => {
      j.status = "failed";
      j.error = `Render process exited with code ${code}. ${stderr.split("\n").filter((l) => !/memory|cgroup|docker/i.test(l)).slice(-6).join(" ").slice(0, 500)}`;
      j.finishedAt = new Date().toISOString();
    });
  });
  return job;
}

export async function cancelJob(projectId: string, jobId: string): Promise<ExportJob> {
  const job = await getJob(projectId, jobId);
  const child = procs.get(jobId);
  if (child?.pid) {
    job.status = "cancelled";
    job.finishedAt = new Date().toISOString();
    job.error = "Cancelled by user";
    await save(job);
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      /* already gone */
    }
    await fs.rm(outputPath(job), { force: true });
  }
  return getJob(projectId, jobId);
}

function safeName(n: string) {
  return n.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "video";
}
