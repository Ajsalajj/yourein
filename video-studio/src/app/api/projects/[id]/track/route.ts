import { z } from "zod";
import { route, HttpError } from "@/server/http";
import { ai } from "@/server/ai";
import { readProject, safeProjectPath, writeProject } from "@/server/storage";
import { uid } from "@/lib/project";

type P = { id: string };

const startSchema = z.object({
  roi: z.object({ x: z.number().min(0).max(0.99), y: z.number().min(0).max(0.99), w: z.number().min(0.02).max(1), h: z.number().min(0.02).max(1) }),
  startMs: z.number().min(0),
  endMs: z.number().min(0).nullable().optional(),
  label: z.string().trim().min(1).max(80).default("Tracked region"),
});

/** Start Lucas-Kanade tracking of a user-selected region. */
export const POST = route<P>(async (req, { id }) => {
  const body = startSchema.parse(await req.json());
  const project = await readProject(id);
  const src = project.sourceAssetId ? project.assets[project.sourceAssetId] : null;
  if (!src || src.kind !== "video") throw new HttpError(400, "Upload a video first");
  if (body.startMs >= src.durationMs) throw new HttpError(400, "Start time is beyond the end of the video");
  const job = await ai.startTrack({ path: await safeProjectPath(id, src.storageKey), fps: project.fps, start_ms: Math.round(body.startMs), end_ms: body.endMs ?? null, roi: body.roi });
  return { jobId: job.id, trackId: uid("k").toLowerCase(), label: body.label, roi: body.roi };
});

export const GET = route<P>(async (req, { id }) => {
  const q = req.nextUrl.searchParams;
  const jobId = q.get("jobId");
  const trackId = q.get("trackId");
  if (!jobId || !/^[\w-]{6,64}$/.test(jobId) || !trackId || !/^[a-z0-9]{6,32}$/.test(trackId)) throw new HttpError(400, "jobId and trackId required");
  const job = await ai.visionJob(jobId);
  if (job.status !== "done" || !job.result) return { status: job.status, progress: job.progress, stage: job.stage, error: job.error ?? null };
  const project = await readProject(id);
  if (!project.analysis.tracks[trackId]) {
    const r = job.result as { fps: number; startFrame: number; points: [number, number, number][]; method: string; roi: { x: number; y: number; w: number; h: number } };
    const label = (q.get("label") ?? "Tracked region").slice(0, 80);
    await writeProject({ ...project, analysis: { ...project.analysis, tracks: { ...project.analysis.tracks, [trackId]: { id: trackId, label, fps: r.fps, startFrame: r.startFrame, points: r.points, method: r.method, roi: r.roi, sourceAssetId: project.sourceAssetId!, createdAt: new Date().toISOString() } } } });
  }
  return { status: "done", progress: 1, stage: "done", error: null };
});

export const DELETE = route<P>(async (req, { id }) => {
  const trackId = req.nextUrl.searchParams.get("trackId") ?? "";
  const project = await readProject(id);
  const { [trackId]: _gone, ...rest } = project.analysis.tracks;
  void _gone;
  await writeProject({ ...project, textLayers: project.textLayers.map((t) => (t.trackId === trackId ? { ...t, trackId: null } : t)), analysis: { ...project.analysis, tracks: rest } });
  return { ok: true };
});
