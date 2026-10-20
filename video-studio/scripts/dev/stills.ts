/**
 * Design-review harness: renders still frames of caption templates over the demo clip.
 *   tsx scripts/dev/stills.ts <outDir> [templateId ...]
 */
import path from "node:path";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { openBrowser, renderStill, selectComposition } from "@remotion/renderer";
import { serveDir } from "./range-server";
import { newProject, type Project } from "../../src/lib/project";
import { groupWords } from "../../src/lib/captions/grouping";
import { distributeWords } from "../../src/lib/captions/ops";
import { TEMPLATES, getTemplate } from "../../src/remotion/templates/registry";

const [outDir, ...ids] = process.argv.slice(2);
const sample = path.resolve("data/samples");
const text = process.env.STILL_TEXT ?? "Today we are going to learn how to edit videos quickly with animated captions";
const BROWSER = process.env.BROWSER_EXECUTABLE ?? "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell";

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const srv = await serveDir(sample);
  const serveUrl = await bundle({ entryPoint: path.resolve("src/remotion/index.ts") });
  const browser = await openBrowser("chrome", { browserExecutable: BROWSER, chromiumOptions: { gl: "swangle" } });
  const words = distributeWords(text.split(/\s+/), 500, 500 + text.split(/\s+/).length * 380, 0.9);
  const templates = ids.length ? ids.map(getTemplate) : TEMPLATES;
  for (const t of templates) {
    const p: Project = newProject({ id: "stillproj0001", name: "s", aspect: (process.env.ASPECT as "9:16") ?? "9:16" });
    p.assets["a1"] = { id: "a1", kind: "video", filename: "demo.mp4", mime: "video/mp4", storageKey: "demo.mp4", sizeBytes: 1, durationMs: 15000, width: 720, height: 1280, fps: 30, hasAudio: true };
    p.sourceAssetId = "a1";
    p.captionStyle = { templateId: t.id, overrides: {}, position: t.position };
    p.captions = groupWords(words, { wordsPerGroup: t.style.wordsPerGroup });
    const props = { project: p, mediaUrls: { a1: `${srv.url}/demo.mp4` } };
    const comp = await selectComposition({ serveUrl, id: "Studio", inputProps: props, puppeteerInstance: browser });
    const cap = p.captions[0];
    const mid = (i: number) => Math.round(((cap.words[Math.min(i, cap.words.length - 1)].startMs + cap.words[Math.min(i, cap.words.length - 1)].endMs) / 2) * 30 / 1000);
    const frames = [Math.round((cap.words[0].startMs + 60) * 30 / 1000), mid(1), mid(3), Math.round((cap.endMs - 60) * 30 / 1000)];
    for (let i = 0; i < frames.length; i++) {
      await renderStill({ composition: comp, serveUrl, output: path.join(outDir, `${t.id}_${i}.png`), frame: frames[i], inputProps: props, puppeteerInstance: browser, scale: 0.4, imageFormat: "png" });
    }
    console.log("rendered", t.id);
  }
  await browser.close({ silent: true });
  srv.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
