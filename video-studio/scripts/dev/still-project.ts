/** Render one still of a stored project through the real composition: tsx still-project.ts <projectId> <ms> <out.png> */
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { migrateProject } from "../../src/lib/project";
import { getCompositionMeta } from "../../src/lib/composition";

const [id, ms, out] = process.argv.slice(2);
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3100";
const BROWSER = process.env.BROWSER_EXECUTABLE ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
async function main() {
  const project = migrateProject((await (await fetch(`${BASE}/api/projects/${id}`)).json() as any).project);
  const seg = project.analysis.segmentation;
  const props = { project, mediaUrls: Object.fromEntries(Object.values(project.assets).map((a) => [a.id, `${BASE}/api/media/${id}/${a.id}`])), mask: seg ? { base: `${BASE}/api/projects/${id}/masks/${seg.id}`, query: "", fps: seg.fps, frames: seg.frames } : null };
  const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts") });
  const browser = await openBrowser("chrome", { browserExecutable: BROWSER, chromiumOptions: { gl: "swangle" } });
  const comp = await selectComposition({ serveUrl, id: "Studio", inputProps: props, puppeteerInstance: browser });
  const frame = Math.round((Number(ms) * getCompositionMeta(project).fps) / 1000);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await renderStill({ composition: comp, serveUrl, output: out, frame, inputProps: props, puppeteerInstance: browser, scale: 0.5, imageFormat: "png" });
  await browser.close({ silent: true });
  console.log("wrote", out);
}
main().catch((e) => { console.error(e); process.exit(1); });
