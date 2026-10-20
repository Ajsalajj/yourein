/** Export reliability: repeated, concurrent, cancelled, failing and edited-during-export jobs against the running app. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BASE, createProject, getProject, j, putProject, sleep, renderProject } from "./lib/studio-client";
import { distributeWords } from "../src/lib/captions/ops";
import { groupWords } from "../src/lib/captions/grouping";
import { brollSchema } from "../src/lib/edit-schema";

const OUT = path.resolve("data/validation-reliability");
fs.mkdirSync(OUT, { recursive: true });
const checks: { name: string; pass: boolean; detail?: string }[] = [];
const check = (name: string, pass: boolean, detail = "") => { checks.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? " - " + detail : ""}`); };
const probe = (f: string) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", f], { encoding: "utf8" }));
const startExport = async (id: string) => (await j(`/api/projects/${id}/export`, { method: "POST", body: JSON.stringify({ quality: "standard" }) })).job;
const waitJob = async (id: string, jobId: string, ms = 300000) => { const t = Date.now(); for (;;) { const { job } = await j(`/api/projects/${id}/export/${jobId}`); if (["done", "failed", "cancelled"].includes(job.status)) return job; if (Date.now() - t > ms) throw new Error("job timed out"); await sleep(1000); } };
const frameMad = (a: string, b: string, t: number) => { const f = (p: string, o: string) => execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", p, "-frames:v", "1", "-vf", "scale=135:240", o]); f(a, path.join(OUT, "_a.png")); f(b, path.join(OUT, "_b.png")); const v = execFileSync("bash", ["-c", `ffmpeg -v info -i ${OUT}/_a.png -i ${OUT}/_b.png -lavfi psnr -f null - 2>&1 | grep -o 'average:[0-9a-z.]*' | head -1 | cut -d: -f2`], { encoding: "utf8" }).trim(); return v === "inf" ? Infinity : Number(v); };

async function mk(name: string, extra?: (p: any, assets: any[]) => void, files = [{ file: "data/samples/person.mp4" }]) {
  const { id, assets } = await createProject(name, files);
  const p = await getProject(id);
  const dur = p.assets[p.sourceAssetId!].durationMs;
  p.captions = groupWords(distributeWords("reliability test of the export pipeline with captions".split(" "), 300, dur - 300, 0.9).map((w) => ({ ...w, timingSource: "asr" as const })), { wordsPerGroup: 3 });
  extra?.(p, assets);
  await putProject(id, p);
  return { id, p: await getProject(id) };
}

async function main() {
  const A = await mk("reliability A");
  // 1. repeated exports are consistent
  const outs: string[] = [];
  for (let i = 0; i < 3; i++) { const f = path.join(OUT, `repeat${i}.mp4`); await renderProject(A.id, A.p, f); outs.push(f); }
  const info = outs.map((f) => probe(f));
  const dur = info.map((i) => Number(i.format.duration));
  check("3 sequential exports all succeed with identical duration/size/streams", dur.every((d) => Math.abs(d - dur[0]) < 0.01) && info.every((i) => i.streams.length === info[0].streams.length && i.streams[0].width === info[0].streams[0].width), `durations ${dur.map((d) => d.toFixed(2)).join(", ")}`);
  const psnr = frameMad(outs[0], outs[1], 3);
  check("repeated exports render the same pixels (PSNR >= 45 dB)", psnr >= 45, `PSNR ${psnr}`);

  // 2. cancel mid-render, then export again
  const j1 = await startExport(A.id);
  await sleep(9000);
  const c = (await j(`/api/projects/${A.id}/export/${j1.id}`, { method: "DELETE" })).job;
  const after = await waitJob(A.id, j1.id, 60000);
  const dl = await fetch(`${BASE}/api/projects/${A.id}/export/${j1.id}/download`);
  check("cancelling a running export ends as 'cancelled' and leaves no downloadable file", after.status === "cancelled" && dl.status >= 400, `status ${after.status}/${c.status}, download ${dl.status}`);
  const again = await renderProject(A.id, A.p, path.join(OUT, "after-cancel.mp4"));
  check("a new export works right after a cancel", again.job.status === "done");

  // 3. edit while exporting: the output belongs to the snapshot taken at start
  const j2 = await startExport(A.id);
  await sleep(4000);
  await putProject(A.id, { ...A.p, captions: A.p.captions.map((x) => ({ ...x, text: "EDITED", words: x.words.map((w) => ({ ...w, text: "EDITED" })) })) });
  const done2 = await waitJob(A.id, j2.id);
  const f2 = path.join(OUT, "snapshot.mp4");
  fs.writeFileSync(f2, Buffer.from(await (await fetch(`${BASE}/api/projects/${A.id}/export/${j2.id}/download`)).arrayBuffer()));
  check("editing the project during an export does not change that export", done2.status === "done" && frameMad(outs[0], f2, 3) >= 45, `PSNR vs snapshot-time render ${frameMad(outs[0], f2, 3)}`);

  // 4. a missing asset fails fast and clearly
  const B = await mk("reliability B", (p, assets) => { p.broll = [brollSchema.parse({ id: "b1", assetId: assets[1].id, startMs: 1000, endMs: 2500, mode: "full" })]; }, [{ file: "data/samples/person.mp4" }, { file: "data/samples/multiscene.mp4" }]);
  const bassets = Object.values(B.p.assets) as { id: string; storageKey: string }[];
  const victim = bassets.find((a) => a.id !== B.p.sourceAssetId)!;
  const pdir = path.join(process.env.DATA_DIR ?? "data", "projects", B.id);
  fs.renameSync(path.join(pdir, victim.storageKey), path.join(pdir, victim.storageKey + ".gone"));
  const t0 = Date.now();
  const j3 = await startExport(B.id);
  const f3 = await waitJob(B.id, j3.id, 150000);
  check("export with a missing B-roll file fails (does not hang) with a message", f3.status === "failed" && !!f3.error, `${f3.status} after ${((Date.now() - t0) / 1000).toFixed(0)} s: ${String(f3.error).slice(0, 120)}`);
  fs.renameSync(path.join(pdir, victim.storageKey + ".gone"), path.join(pdir, victim.storageKey));
  const fixed = await renderProject(B.id, B.p, path.join(OUT, "restored.mp4"));
  check("after restoring the file the same project exports fine", fixed.job.status === "done");

  // 5. two exports at the same time
  const C = await mk("reliability C");
  const [ja, jc] = await Promise.all([startExport(A.id), startExport(C.id)]);
  const [ra, rc] = await Promise.all([waitJob(A.id, ja.id), waitJob(C.id, jc.id)]);
  check("two simultaneous exports both finish and verify", ra.status === "done" && rc.status === "done" && ra.verification?.ok && rc.verification?.ok, `${ra.status}/${rc.status}`);

  // 6. job record is truthful
  const last = (await j(`/api/projects/${A.id}/export/${ja.id}`)).job;
  check("finished job reports real size, duration and audio verification", last.outputBytes > 10000 && last.verification?.hasAudio === true && Math.abs(last.verification.durationMs - last.verification.expectedDurationMs) < 150);
  const pass = checks.every((c) => c.pass);
  fs.writeFileSync(path.join(OUT, "reliability_report.json"), JSON.stringify({ pass, checks }, null, 1));
  console.log(pass ? "ALL PASS" : "SOME FAILED");
  process.exit(pass ? 0 : 1);
}
main().catch((e) => { console.error("RELIABILITY RUN FAILED:", e.message); process.exit(1); });
