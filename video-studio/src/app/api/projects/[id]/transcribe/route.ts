import { z } from "zod";
import { route, HttpError } from "@/server/http";
import { ai, type AiResult } from "@/server/ai";
import { readProject, safeProjectPath, writeProject } from "@/server/storage";
import { groupWords } from "@/lib/captions/grouping";
import { uid, type Transcript, type Word } from "@/lib/project";
import { getTemplate } from "@/remotion/templates/registry";

type P = { id: string };

const startSchema = z.object({
  language: z.string().regex(/^[a-z]{2,3}$/).nullable().optional(),
  engine: z.enum(["auto", "faster-whisper", "pocketsphinx"]).default("auto"),
  model: z.string().regex(/^[\w.\-/]{1,80}$/).optional(),
});

export const POST = route<P>(async (req, { id }) => {
  const body = startSchema.parse(await req.json().catch(() => ({})));
  const project = await readProject(id);
  const src = project.sourceAssetId ? project.assets[project.sourceAssetId] : null;
  if (!src) throw new HttpError(400, "Upload a video first");
  if (!src.hasAudio) throw new HttpError(400, "This video has no audio track to transcribe");
  const file = await safeProjectPath(id, src.storageKey);
  const job = await ai.startTranscribe({ path: file, language: body.language ?? null, engine: body.engine, model: body.model });
  return { jobId: job.id };
});

/** Poll. When the job is done the result is written into the project exactly once (keyed by jobId). */
export const GET = route<P>(async (req, { id }) => {
  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId || !/^[\w-]{6,64}$/.test(jobId)) throw new HttpError(400, "jobId required");
  const job = await ai.job(jobId);
  if (job.status !== "done" || !job.result) return { status: job.status, progress: job.progress, stage: job.stage, error: job.error ?? null };

  const project = await readProject(id);
  if (project.transcript?.jobId !== jobId) {
    const r: AiResult = job.result;
    const words: Word[] = r.words.map((w) => ({ id: uid("w_"), text: w.text, startMs: w.startMs, endMs: w.endMs, confidence: w.confidence, timingSource: w.timingSource }));
    const transcript: Transcript = { jobId, engine: r.engine, model: r.model, language: r.language, languageProbability: r.languageProbability, wordTimestampsNative: r.wordTimestampsNative, createdAt: new Date().toISOString(), durationMs: r.durationMs, warnings: r.warnings, words };
    const tpl = getTemplate(project.captionStyle.templateId);
    const captions = groupWords(words, { wordsPerGroup: { ...tpl.style, ...project.captionStyle.overrides }.wordsPerGroup });
    await writeProject({ ...project, transcript, captions });
  }
  return { status: "done", progress: 1, stage: "done", error: null };
});
