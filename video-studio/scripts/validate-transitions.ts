/** Transition validation: every type exported on a join between two REAL, very different video scenes, analysed on the rendered frames. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createProject, getProject, renderProject } from "./lib/studio-client";
import { TRANSITION_TYPES } from "../src/lib/edit-schema";
import { uid } from "../src/lib/project";

const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation-transitions");
fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.env.ONLY?.split(",");

async function main() {
  if (!fs.existsSync("data/samples/multiscene.mp4")) execFileSync("bash", ["scripts/make-multiscene.sh"], { stdio: "inherit" });
  const { id } = await createProject("Transition validation", [{ file: "data/samples/multiscene.mp4" }]);
  const p = await getProject(id);
  // keep scene 1 [1500,2300) and scene 3 [6500,7300): one join at output 800 ms (frame 24)
  p.cuts = [[0, 1500], [2300, 6500], [7300, 12000]].map(([startMs, endMs]) => ({ id: uid("x_"), startMs, endMs, reason: "manual" as const }));
  p.captionsVisible = false;
  const meta: Record<string, unknown> = {};
  const control = await renderProject(id, { ...p, transitions: [] }, path.join(OUT, "control.mp4"));
  console.log("control", control.seconds.toFixed(0), "s");
  for (const type of TRANSITION_TYPES) {
    if (ONLY && !ONLY.includes(type)) continue;
    const t = { id: uid("t_"), type, joinSrcMs: 2300, durationMs: 800, direction: "left" as const, intensity: 0.8, soundId: null };
    const r = await renderProject(id, { ...p, transitions: [t] }, path.join(OUT, `${type}.mp4`));
    meta[type] = { seconds: r.seconds };
    console.log(type, r.seconds.toFixed(0), "s", (r.bytes / 1e6).toFixed(1), "MB");
  }
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ joinFrame: 24, windowFrames: 24, renders: meta }));
  console.log(execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_transitions.py", OUT], { encoding: "utf8" }));
}
main().catch((e) => { console.error("TRANSITION VALIDATION FAILED:", e.message, e.stdout?.toString?.() ?? ""); process.exit(1); });
