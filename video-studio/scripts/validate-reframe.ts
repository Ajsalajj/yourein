/** Face-aware reframing validation: 16:9 moving-face footage exported to 9:16 with the face camera and with the plain centre crop. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createProject, getProject, j, renderProject, sleep } from "./lib/studio-client";

const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation-reframe");
fs.mkdirSync(OUT, { recursive: true });

async function main() {
  if (!fs.existsSync("data/samples/moving-face.mp4")) execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/make_moving_face.py"], { stdio: "inherit" });
  const { id } = await createProject("Reframe validation", [{ file: "data/samples/moving-face.mp4" }]);
  const t0 = Date.now();
  const { jobId, facesId } = await j(`/api/projects/${id}/faces`, { method: "POST" });
  for (;;) { const s = await j(`/api/projects/${id}/faces?jobId=${jobId}&facesId=${facesId}`); if (s.status === "failed") throw new Error(s.error); if (s.status === "done") break; await sleep(500); }
  console.log(`face analysis ${(Date.now() - t0) / 1000}s`);
  const p = await getProject(id);
  p.captionsVisible = false;
  p.aspect = "9:16";
  fs.writeFileSync(path.join(OUT, "faces.json"), JSON.stringify(p.analysis.faces));
  const face = await renderProject(id, { ...p, reframe: { ...p.reframe, mode: "face", tightness: 0.3, smoothMs: 700 } }, path.join(OUT, "face.mp4"));
  const centre = await renderProject(id, { ...p, reframe: { ...p.reframe, mode: "off" } }, path.join(OUT, "centre.mp4"));
  console.log("render seconds", face.seconds.toFixed(0), centre.seconds.toFixed(0));
  console.log(execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_reframe.py", OUT, "data/samples/moving-face.truth.json"], { encoding: "utf8" }));
}
main().catch((e) => { console.error("REFRAME VALIDATION FAILED:", e.message, e.stdout?.toString?.() ?? ""); process.exit(1); });
