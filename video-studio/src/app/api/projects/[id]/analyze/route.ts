import { z } from "zod";
import { route, HttpError } from "@/server/http";
import { assetOf, readProject, safeProjectPath } from "@/server/storage";
import { detectSilence, waveformPeaks } from "@/server/ffmpeg";

type P = { id: string };

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("silence"), noiseDb: z.number().min(-70).max(-10).default(-35), minSilenceMs: z.number().min(200).max(10000).default(700) }),
  z.object({ kind: z.literal("waveform"), buckets: z.number().int().min(50).max(4000).default(1200) }),
]);

export const POST = route<P>(async (req, { id }) => {
  const body = schema.parse(await req.json());
  const project = await readProject(id);
  if (!project.sourceAssetId) throw new HttpError(400, "No video");
  const asset = assetOf(project, project.sourceAssetId);
  if (!asset.hasAudio) throw new HttpError(400, "The video has no audio track");
  const file = await safeProjectPath(id, asset.storageKey);
  if (body.kind === "silence") return { silences: await detectSilence(file, body.noiseDb, body.minSilenceMs / 1000, asset.durationMs), method: "ffmpeg-silencedetect (energy threshold)" };
  return { peaks: await waveformPeaks(file, body.buckets, asset.durationMs) };
});
