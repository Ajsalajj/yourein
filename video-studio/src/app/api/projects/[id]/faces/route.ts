import { route, HttpError } from "@/server/http";
import { ai } from "@/server/ai";
import { readProject, safeProjectPath, writeProject } from "@/server/storage";
import { uid } from "@/lib/project";

type P = { id: string };

/** Start face detection + subject tracking on the source video (real neural detector, ~10 samples per second). */
export const POST = route<P>(async (_req, { id }) => {
  const project = await readProject(id);
  const src = project.sourceAssetId ? project.assets[project.sourceAssetId] : null;
  if (!src || src.kind !== "video") throw new HttpError(400, "Upload a video first");
  const job = await ai.startFaces({ path: await safeProjectPath(id, src.storageKey), sample_fps: 10 });
  return { jobId: job.id, facesId: uid("f").toLowerCase() };
});

interface Sample { t: number; primary: { x: number; y: number; w: number; h: number; score: number } | null }
export const GET = route<P>(async (req, { id }) => {
  const jobId = req.nextUrl.searchParams.get("jobId");
  const facesId = req.nextUrl.searchParams.get("facesId");
  if (!jobId || !/^[\w-]{6,64}$/.test(jobId) || !facesId || !/^[a-z0-9]{6,32}$/.test(facesId)) throw new HttpError(400, "jobId and facesId required");
  const job = await ai.visionJob(jobId);
  if (job.status !== "done" || !job.result) return { status: job.status, progress: job.progress, stage: job.stage, error: job.error ?? null };
  const project = await readProject(id);
  if (project.analysis.faces?.id !== facesId) {
    const r = job.result as { fps: number; width: number; height: number; method: string; samples: Sample[]; detected: number; total: number };
    const samples = r.samples.map((s) => (s.primary ? ([s.t, s.primary.x, s.primary.y, s.primary.w, s.primary.h, s.primary.score] as [number, number, number, number, number, number]) : ([s.t] as [number])));
    await writeProject({ ...project, analysis: { ...project.analysis, faces: { id: facesId, fps: r.fps, width: r.width, height: r.height, method: r.method, sourceAssetId: project.sourceAssetId!, createdAt: new Date().toISOString(), detected: r.detected, total: r.total, samples } } });
  }
  return { status: "done", progress: 1, stage: "done", error: null };
});

export const DELETE = route<P>(async (_req, { id }) => {
  const project = await readProject(id);
  await writeProject({ ...project, reframe: { ...project.reframe, mode: "off" }, analysis: { ...project.analysis, faces: null } });
  return { ok: true };
});
