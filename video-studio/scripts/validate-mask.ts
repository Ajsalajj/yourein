/** Text-behind-subject validation on real exports: alignment of the occlusion with the stored matte, and the effect of feather / grow controls. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { BASE, createProject, getProject, j, renderProject, sleep } from "./lib/studio-client";
import { TITLE_COMPOSITIONS } from "../src/lib/titles";

const OUT = path.resolve(process.env.VALIDATION_OUT ?? "data/validation-mask");
fs.mkdirSync(OUT, { recursive: true });

async function poll(url: string) { for (;;) { const s = await j(url); if (s.status === "failed") throw new Error(s.error); if (s.status === "done") return; await sleep(600); } }
async function saveMatte(id: string, maskId: string, frame: number, file: string) {
  fs.writeFileSync(file, Buffer.from(await (await fetch(`${BASE}/api/projects/${id}/masks/${maskId}/${frame}`)).arrayBuffer()));
}

async function main() {
  const { id } = await createProject("Mask validation", [{ file: "data/samples/person.mp4" }]);
  let t0 = Date.now();
  const seg = await j(`/api/projects/${id}/segment`, { method: "POST", body: JSON.stringify({ feather: 1 }) });
  await poll(`/api/projects/${id}/segment?jobId=${seg.jobId}&maskId=${seg.maskId}`);
  console.log(`segmentation ${(Date.now() - t0) / 1000}s`);
  const p = await getProject(id);
  const dur = p.assets[p.sourceAssetId!].durationMs;
  p.captionsVisible = false;
  const behind = TITLE_COMPOSITIONS.find((c) => c.id === "behind-headline")!.make({ startMs: 300, endMs: dur - 300, text: "FOCUS" });
  behind[0] = { ...behind[0], color: "#ff00aa", animation: "none" };
  const none = await renderProject(id, { ...p, textLayers: [] }, path.join(OUT, "none.mp4"));
  const front = await renderProject(id, { ...p, textLayers: behind.map((t) => ({ ...t, behind: false })) }, path.join(OUT, "front.mp4"));
  const cfgs: { name: string; opts: Record<string, number | boolean> | null }[] = [{ name: "behind_default", opts: null }, { name: "behind_hard", opts: { feather: 0, grow: 0 } }, { name: "behind_soft", opts: { feather: 6, grow: 0 } }, { name: "behind_grown", opts: { feather: 1, grow: 4 } }];
  const meta: Record<string, unknown> = {};
  for (const c of cfgs) {
    if (c.opts) {
      t0 = Date.now();
      const r = await j(`/api/projects/${id}/segment/refine`, { method: "POST", body: JSON.stringify(c.opts) });
      await poll(`/api/projects/${id}/segment?jobId=${r.jobId}&maskId=${r.maskId}`);
      console.log(`refine ${c.name} ${(Date.now() - t0) / 1000}s`);
    }
    const cur = await getProject(id);
    const maskId = cur.analysis.segmentation!.id;
    await renderProject(id, { ...cur, textLayers: behind }, path.join(OUT, `${c.name}.mp4`));
    for (const f of [60, 120, 180]) await saveMatte(id, maskId, f, path.join(OUT, `${c.name}_matte_${f}.png`));
    meta[c.name] = { maskId, params: cur.analysis.segmentation!.params };
  }
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ frames: [60, 120, 180], meta }));
  void none; void front;
  console.log(execFileSync("ai-service/.venv/bin/python", ["-I", "scripts/dev/verify_mask.py", OUT], { encoding: "utf8" }));
}
main().catch((e) => { console.error("MASK VALIDATION FAILED:", e.message, e.stdout?.toString?.() ?? ""); process.exit(1); });
