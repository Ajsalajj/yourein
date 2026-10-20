/** Stills of the motion-graphics text layers (circle path, shatter) over the demo clip: tsx scripts/dev/stills-graphics.ts <outDir> */
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { serveDir } from "./range-server";
import { newProject, newTextLayer } from "../../src/lib/project";

const out = process.argv[2] ?? "data/stills-graphics";
const BROWSER = process.env.BROWSER_EXECUTABLE ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";
async function main() {
  fs.mkdirSync(out, { recursive: true });
  const srv = await serveDir(path.resolve("data/samples"));
  const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts") });
  const browser = await openBrowser("chrome", { browserExecutable: BROWSER, chromiumOptions: { gl: "swangle" } });
  const mk = (layers: ReturnType<typeof newTextLayer>[]) => {
    const p = newProject({ id: "stillgfx0001", name: "g", aspect: "9:16" });
    p.assets["a1"] = { id: "a1", kind: "video", filename: "demo.mp4", mime: "video/mp4", storageKey: "demo.mp4", sizeBytes: 1, durationMs: 15000, width: 720, height: 1280, fps: 30, hasAudio: true };
    p.sourceAssetId = "a1"; p.captionsVisible = false; p.textLayers = layers;
    return { project: p, mediaUrls: { a1: `${srv.url}/demo.mp4` } };
  };
  const cases: { name: string; layers: ReturnType<typeof newTextLayer>[]; frames: number[] }[] = [
    { name: "circle", layers: [newTextLayer({ text: "ROUND AND ROUND WE GO • ", startMs: 0, endMs: 4000, x: 0.5, y: 0.5, fontSize: 70, fontWeight: 800, fontFamily: "Montserrat", path: { radius: 0.32, startDeg: -90, sweepDeg: 0, direction: "cw", inside: false, spinDegPerSec: 30 }, strokeWidth: 0 })], frames: [10, 40, 80] },
    { name: "circle-arc", layers: [newTextLayer({ text: "CURVED HEADLINE", startMs: 0, endMs: 4000, x: 0.5, y: 0.6, fontSize: 90, fontWeight: 800, fontFamily: "Anton", color: "#ffd60a", path: { radius: 0.34, startDeg: -70, sweepDeg: 140, direction: "cw", inside: false, spinDegPerSec: 0 } })], frames: [30] },
    { name: "shatter-out", layers: [newTextLayer({ text: "SHATTER", startMs: 0, endMs: 3000, x: 0.5, y: 0.5, fontSize: 200, fontWeight: 400, fontFamily: "Anton", color: "#ffffff", shatter: { mode: "out", durationMs: 1000, spread: 0.9, detail: "medium", seed: 5 } })], frames: [30, 66, 75, 82, 90] },
  ];
  for (const c of cases) {
    const props = mk(c.layers);
    const comp = await selectComposition({ serveUrl, id: "Studio", inputProps: props, puppeteerInstance: browser });
    for (const f of c.frames) await renderStill({ composition: comp, serveUrl, output: path.join(out, `${c.name}_${f}.png`), frame: f, inputProps: props, puppeteerInstance: browser, scale: 0.5, imageFormat: "png" });
    console.log("rendered", c.name);
  }
  await browser.close({ silent: true }); srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
