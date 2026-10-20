import { newProject, projectSchema, type Project } from "../src/lib/project";
import { distributeWords } from "../src/lib/captions/ops";
import { groupWords } from "../src/lib/captions/grouping";
import { computeSegments } from "../src/lib/timeline";
import { getCompositionMeta } from "../src/lib/composition";

/** A 20 s project with a source video asset, spoken text and optional cuts. */
export function demoProject(text = "this is a remarkable moment with 100 percent success and a big boom", opts: { cuts?: [number, number][]; durationMs?: number } = {}): Project {
  const durationMs = opts.durationMs ?? 20000;
  const p = newProject({ id: "tproject01", name: "t" });
  p.assets.src = { id: "src", kind: "video", filename: "a.mp4", mime: "video/mp4", storageKey: "media/a.mp4", sizeBytes: 1, durationMs, width: 1080, height: 1920, fps: 30, hasAudio: true };
  p.sourceAssetId = "src";
  const words = distributeWords(text.split(" "), 1000, 1000 + text.split(" ").length * 420, 0.9).map((w) => ({ ...w, timingSource: "asr" as const }));
  p.captions = groupWords(words, { wordsPerGroup: 4 });
  p.cuts = (opts.cuts ?? []).map(([s, e], i) => ({ id: `c${i}`, startMs: s, endMs: e, reason: "manual" as const }));
  return projectSchema.parse(p);
}
export const segsOf = (p: Project) => getCompositionMeta(p).segments;
export { computeSegments };
