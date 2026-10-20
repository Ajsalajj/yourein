/** B-roll validation: real export with full-frame (+ transition), split-screen, overlay and PiP clips; speaker audio compared with a no-B-roll control. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createProject, getProject, renderProject } from "./lib/studio-client";
import { brollSchema } from "../src/lib/edit-schema";
import { distributeWords } from "../src/lib/captions/ops";
import { groupWords } from "../src/lib/captions/grouping";

const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation-broll");
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  if (!fs.existsSync("data/samples/multiscene.mp4")) execFileSync("bash", ["scripts/make-multiscene.sh"], { stdio: "inherit" });
  const { id, assets } = await createProject("B-roll validation", [{ file: "data/samples/person.mp4" }, { file: "data/samples/multiscene.mp4" }]);
  const p = await getProject(id);
  const broll = assets[1].id;
  const dur = p.assets[p.sourceAssetId!].durationMs;
  p.captions = groupWords(distributeWords("This is the speaker talking while broll plays over the footage".split(" "), 300, dur - 300, 0.9).map((w) => ({ ...w, timingSource: "asr" as const })), { wordsPerGroup: 3 });
  p.captionsVisible = false;
  const mk = (cid: string, startMs: number, endMs: number, clipInMs: number, extra: Record<string, unknown>) => brollSchema.parse({ id: cid, assetId: broll, startMs, endMs, clipInMs, ...extra });
  const clips = [
    mk("full", 1000, 2400, 3200, { mode: "full", transitionIn: "flash", transitionOut: "cinematic-fade", transitionMs: 400 }),
    mk("split", 2800, 4200, 6200, { mode: "split-top", transitionMs: 300 }),
    mk("overlay", 4600, 5600, 9200, { mode: "overlay", opacity: 0.5, transitionMs: 200 }),
    mk("pip", 5800, 7200, 1000, { mode: "pip", transitionMs: 300 }),
  ];
  const control = await renderProject(id, { ...p, broll: [] }, path.join(OUT, "control.mp4"));
  const withB = await renderProject(id, { ...p, broll: clips }, path.join(OUT, "broll.mp4"));
  console.log("render seconds", control.seconds.toFixed(0), withB.seconds.toFixed(0));
  fs.writeFileSync(path.join(OUT, "plan.json"), JSON.stringify({ fps: 30, clips: clips.map((c) => ({ id: c.id, mode: c.mode, startMs: c.startMs, endMs: c.endMs, clipInMs: c.clipInMs, opacity: c.opacity, transitionMs: c.transitionMs, transitionIn: c.transitionIn, transitionOut: c.transitionOut })), clipFile: "data/samples/multiscene.mp4" }));
  console.log(execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_broll.py", path.join(OUT, "broll.mp4"), path.join(OUT, "control.mp4"), path.join(OUT, "plan.json"), OUT], { encoding: "utf8" }));
}
main().catch((e) => { console.error("BROLL VALIDATION FAILED:", e.message, e.stdout?.toString?.() ?? ""); process.exit(1); });
