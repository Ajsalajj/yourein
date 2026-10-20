import fs from "node:fs/promises";
import path from "node:path";
import { route, HttpError } from "@/server/http";
import { ai } from "@/server/ai";
import { projectDir, readProject, safeProjectPath } from "@/server/storage";
import { uid } from "@/lib/project";
import { matteOptsSchema as optsSchema } from "@/lib/matte-opts";

/** Re-run only the cheap refinement stages (guided filter, temporal, edge curve, grow, feather) from the stored network output: a few seconds, no re-inference. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const project = await readProject(id);
  const seg = project.analysis.segmentation;
  const src = project.sourceAssetId ? project.assets[project.sourceAssetId] : null;
  if (!seg || !src) throw new HttpError(400, "Analyse the subject first");
  const opts = optsSchema.parse(await req.json());
  const rawDir = path.join(projectDir(id), "masks", seg.id);
  await fs.access(path.join(rawDir, "raw.npy")).catch(() => { throw new HttpError(409, "This matte predates edge controls - run \"Analyse subject\" again once"); });
  const maskId = uid("m").toLowerCase();
  const outDir = path.join(projectDir(id), "masks", maskId);
  await fs.mkdir(outDir, { recursive: true });
  const job = await ai.startRefine({ path: await safeProjectPath(id, src.storageKey), raw_dir: rawDir, out_dir: outDir, fps: seg.fps, opts });
  return { jobId: job.id, maskId };
});
