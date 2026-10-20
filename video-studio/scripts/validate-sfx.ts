/** SFX validation: real exports of one project, analysed by scripts/dev/verify_sfx.py (timing, gain, mixing, ducking). */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createProject, getProject, renderProject } from "./lib/studio-client";
import { SFX_LIBRARY, resolveSfx } from "../src/lib/sfx";
import { getCompositionMeta } from "../src/lib/composition";
import { uid } from "../src/lib/project";

const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation-sfx");
fs.mkdirSync(OUT, { recursive: true });
// a steady music bed (not speech-like) so ducking is measurable
execFileSync("ffmpeg", ["-y", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=220:duration=12", "-f", "lavfi", "-i", "sine=frequency=330:duration=12", "-filter_complex", "[0][1]amix=inputs=2,volume=1.6", path.join(OUT, "bed.wav")]);

async function main() {
  const { id, assets } = await createProject("SFX validation", [{ file: "data/samples/person.mp4" }, { file: path.join(OUT, "bed.wav"), kind: "audio" }]);
  const p = await getProject(id);
  const music = assets[1].id;
  const plan = [["impact", 1500, 1], ["whoosh-soft", 3200, 0.8], ["ding", 5000, 0.6]] as const;
  p.audio = { ...p.audio, originalVolume: 0 };
  p.sfx = plan.map(([lib, ms, vol]) => ({ id: uid("sf_"), source: { kind: "library" as const, id: lib }, srcMs: ms, syncWordId: null, syncOffsetMs: 0, offsetMs: 0, durationMs: null, volume: vol, fadeInMs: 0, fadeOutMs: 0, duckMusic: true, label: lib, auto: false }));
  const bed = { assetId: music, volume: 0.5, ducking: false, duckLevel: 0.35, loop: true };
  const sfxOnly = await renderProject(id, { ...p, audio: { ...p.audio, music: null } }, path.join(OUT, "sfx_only.mp4"));
  const musicOnly = await renderProject(id, { ...p, sfx: [], audio: { ...p.audio, music: bed } }, path.join(OUT, "music_only.mp4"));
  const both = await renderProject(id, { ...p, audio: { ...p.audio, music: bed } }, path.join(OUT, "both.mp4"));
  console.log("render seconds", [sfxOnly, musicOnly, both].map((r) => r.seconds.toFixed(0)));
  const meta = getCompositionMeta(p);
  const resolved = resolveSfx(p, meta.segments);
  fs.writeFileSync(path.join(OUT, "plan.json"), JSON.stringify({ duckLevel: 0.35, effects: resolved.map((r, i) => ({ library: plan[i][0], outMs: r.outMs, volume: plan[i][2] })) }));
  void SFX_LIBRARY;
  console.log(execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_sfx.py", path.join(OUT, "sfx_only.mp4"), path.join(OUT, "music_only.mp4"), path.join(OUT, "both.mp4"), path.join(OUT, "plan.json"), OUT], { encoding: "utf8" }));
}
main().catch((e) => { console.error("SFX VALIDATION FAILED:", e.message, e.stdout?.toString?.() ?? ""); process.exit(1); });
