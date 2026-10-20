/**
 * Render benchmark: runs scripts/render-worker.ts directly on prepared projects with different settings, records wall time per phase
 * and measures fidelity (PSNR / SSIM, ffmpeg) against a reference render.
 *   tsx scripts/bench-render.ts <scenario> <label> [key=value ...]
 * keys: concurrency, preset, jpeg, format(jpeg|png), cache(MB), gl, crf, mbsamples, blur(0..1)
 * Appends one JSON line to data/bench/results.jsonl and keeps the MP4 in data/bench/<scenario>-<label>.mp4
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execFileSync } from "node:child_process";
import { createProject, getProject, putProject } from "./lib/studio-client";
import { getCompositionMeta } from "../src/lib/composition";
import { mediaUrls } from "../src/server/exports";
import { distributeWords } from "../src/lib/captions/ops";
import { groupWords } from "../src/lib/captions/grouping";
import { uid, type Project } from "../src/lib/project";
import { brollSchema } from "../src/lib/edit-schema";

const [scenario, label, ...kv] = process.argv.slice(2);
const kvm = Object.fromEntries(kv.map((s) => s.split("=") as [string, string]));
const OUT = path.resolve("data/bench");
fs.mkdirSync(OUT, { recursive: true });
const BROWSER = process.env.BROWSER_EXECUTABLE ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

const TEXT = "This is a benchmark of the renderer with captions that animate on every single word and keep the frame busy";
async function prepare(): Promise<{ id: string; project: Project }> {
  const cache = path.join(OUT, `${scenario}.id`);
  if (fs.existsSync(cache)) { const id = fs.readFileSync(cache, "utf8"); try { return { id, project: await getProject(id) }; } catch { /* recreate */ } }
  const files = scenario === "heavy" ? [{ file: "data/samples/multiscene.mp4" }, { file: "data/samples/person.mp4" }] : [{ file: "data/samples/person.mp4" }];
  const { id, assets } = await createProject(`bench ${scenario}`, files);
  const p = await getProject(id);
  const dur = p.assets[p.sourceAssetId!].durationMs;
  p.captions = groupWords(distributeWords(TEXT.split(" "), 300, Math.min(dur - 300, 300 + TEXT.split(" ").length * 360), 0.9).map((w) => ({ ...w, timingSource: "asr" as const })), { wordsPerGroup: 4 });
  p.captionStyle = { templateId: "bold-white-kinetic", overrides: {}, position: { x: 0.5, y: 0.5 } };
  if (scenario === "heavy") {
    p.cuts = [[2500, 3500], [5500, 6500], [8500, 9500]].map(([startMs, endMs]) => ({ id: uid("x_"), startMs, endMs, reason: "manual" as const }));
    p.transitions = ["whip-pan", "radial-zoom-blur", "cinematic-fade"].map((type, i) => ({ id: uid("t_"), type: type as "whip-pan", joinSrcMs: [2500, 5500, 8500][i], durationMs: 500, direction: "left" as const, intensity: 0.7, soundId: null }));
    p.broll = [brollSchema.parse({ id: "b1", assetId: assets[1].id, startMs: 3600, endMs: 4800, mode: "split-top" })];
    p.captionStyle = { templateId: "kinetic-scatter", overrides: {}, position: { x: 0.5, y: 0.5 } };
  }
  await putProject(id, p);
  fs.writeFileSync(cache, id);
  return { id, project: await getProject(id) };
}

async function main() {
  const { id, project } = await prepare();
  const proj: Project = { ...project, captionStyle: { ...project.captionStyle, overrides: { ...project.captionStyle.overrides, ...(kvm.blur ? { motionBlur: Number(kvm.blur) } : {}) } } };
  const meta = getCompositionMeta(proj);
  const dir = path.join(OUT, `${scenario}-${label}`);
  fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const options = { crf: Number(kvm.crf ?? 20), browserExecutable: BROWSER, gl: kvm.gl ?? "swangle", concurrency: Number(kvm.concurrency ?? 0), x264Preset: kvm.preset, jpegQuality: kvm.jpeg ? Number(kvm.jpeg) : undefined, imageFormat: kvm.format as "jpeg" | "png" | undefined, offthreadCacheMB: kvm.cache ? Number(kvm.cache) : undefined };
  fs.writeFileSync(path.join(dir, "input.json"), JSON.stringify({ props: { project: proj, mediaUrls: mediaUrls(proj), mask: null, hints: kvm.mbsamples ? { motionBlurSamples: Number(kvm.mbsamples) } : undefined }, options, expected: { width: meta.width, height: meta.height, fps: meta.fps, durationInFrames: meta.durationInFrames, hasAudio: true }, ffprobe: "ffprobe" }));
  void id;
  const t0 = Date.now(); const laps: Record<string, number> = {};
  await new Promise<void>((resolve, reject) => {
    const c = spawn(process.execPath, ["--import", "tsx", "scripts/render-worker.ts", dir], { stdio: ["ignore", "pipe", "inherit"], env: { ...process.env, NODE_ENV: "production" } });
    let buf = "";
    c.stdout.on("data", (d: Buffer) => { buf += d; let i; while ((i = buf.indexOf("\n")) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); try { const m = JSON.parse(line); if (m.type === "timing") laps[m.name] = m.atMs; if (m.type === "error") reject(new Error(m.message)); } catch { /* noise */ } } });
    c.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`worker exited ${code}`))));
  });
  const wall = (Date.now() - t0) / 1000;
  const mp4 = path.join(OUT, `${scenario}-${label}.mp4`);
  fs.copyFileSync(path.join(dir, "output.mp4"), mp4);
  const row: Record<string, unknown> = { scenario, label, frames: meta.durationInFrames, wallSec: +wall.toFixed(1), bundleSec: +((laps.bundled ?? 0) / 1000).toFixed(1), selectSec: +(((laps["composition-selected"] ?? 0) - (laps.bundled ?? 0)) / 1000).toFixed(1), renderSec: +(((laps.rendered ?? 0) - (laps["composition-selected"] ?? 0)) / 1000).toFixed(1), msPerFrame: +((((laps.rendered ?? 0) - (laps["composition-selected"] ?? 0)) / meta.durationInFrames)).toFixed(0), bytes: fs.statSync(mp4).size, options: kvm };
  const ref = kvm.ref ? path.join(OUT, `${scenario}-${kvm.ref}.mp4`) : null;
  if (ref && fs.existsSync(ref)) {
    // ffmpeg writes the summary lines to stderr; run through bash so they can be grepped
    const out = (() => { try { return execFileSync("bash", ["-c", `ffmpeg -v info -i '${mp4}' -i '${ref}' -lavfi "[0:v][1:v]psnr;[0:v][1:v]ssim" -f null - 2>&1 | grep -E "PSNR|SSIM" | tail -2`], { encoding: "utf8" }); } catch { return ""; } })();
    row.psnrDb = Number(out.match(/average:([\d.]+)/)?.[1] ?? NaN); row.ssim = Number(out.match(/All:([\d.]+)/)?.[1] ?? NaN);
  }
  fs.appendFileSync(path.join(OUT, "results.jsonl"), JSON.stringify(row) + "\n");
  console.log(JSON.stringify(row));
}
main().catch((e) => { console.error("BENCH FAILED:", e.message); process.exit(1); });
