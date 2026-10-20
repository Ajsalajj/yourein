import fs from "node:fs/promises";
import path from "node:path";
import { route, HttpError } from "@/server/http";
import { ai } from "@/server/ai";
import { projectDir, readProject, safeProjectPath, writeProject } from "@/server/storage";
import { uid } from "@/lib/project";

type P = { id: string };

/** Start person segmentation (real neural matte, one PNG per frame under masks/<maskId>/). */
export const POST = route<P>(async (_req, { id }) => {
  const project = await readProject(id);
  const src = project.sourceAssetId ? project.assets[project.sourceAssetId] : null;
  if (!src || src.kind !== "video") throw new HttpError(400, "Upload a video first");
  const maskId = uid("m").toLowerCase();
  const outDir = path.join(projectDir(id), "masks", maskId);
  await fs.mkdir(outDir, { recursive: true });
  const job = await ai.startSegment({ path: await safeProjectPath(id, src.storageKey), out_dir: outDir, fps: project.fps });
  return { jobId: job.id, maskId };
});

export const GET = route<P>(async (req, { id }) => {
  const jobId = req.nextUrl.searchParams.get("jobId");
  const maskId = req.nextUrl.searchParams.get("maskId");
  if (!jobId || !/^[\w-]{6,64}$/.test(jobId) || !maskId || !/^[a-z0-9]{6,32}$/.test(maskId)) throw new HttpError(400, "jobId and maskId required");
  const job = await ai.visionJob(jobId);
  if (job.status !== "done" || !job.result) return { status: job.status, progress: job.progress, stage: job.stage, error: job.error ?? null };
  const project = await readProject(id);
  if (project.analysis.segmentation?.id !== maskId) {
    const r = job.result as { fps: number; width: number; height: number; frames: number; method: string };
    const old = project.analysis.segmentation?.id;
    await writeProject({ ...project, analysis: { ...project.analysis, segmentation: { id: maskId, fps: r.fps, width: r.width, height: r.height, frames: r.frames, method: r.method, sourceAssetId: project.sourceAssetId!, createdAt: new Date().toISOString() } } });
    if (old) await fs.rm(path.join(projectDir(id), "masks", old), { recursive: true, force: true });
  }
  return { status: "done", progress: 1, stage: "done", error: null };
});

export const DELETE = route<P>(async (_req, { id }) => {
  const project = await readProject(id);
  const old = project.analysis.segmentation?.id;
  await writeProject({ ...project, captionsBehindSubject: false, textLayers: project.textLayers.map((t) => ({ ...t, behind: false })), analysis: { ...project.analysis, segmentation: null } });
  if (old) await fs.rm(path.join(projectDir(id), "masks", old), { recursive: true, force: true });
  return { ok: true };
});
