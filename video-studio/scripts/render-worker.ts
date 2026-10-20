/**
 * Standalone render worker. Runs in its own process so Remotion's bundler/Chromium never share memory
 * with the Next.js server, and so a render can be cancelled by killing the process group.
 *
 *   node --import tsx scripts/render-worker.ts <jobDir>
 *
 * Reads <jobDir>/input.json, writes <jobDir>/output.mp4, reports JSON lines on stdout:
 *   {"type":"stage","stage":"bundling"} {"type":"progress","progress":0.42,...} {"type":"done",...} {"type":"error","message":...}
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

interface Input {
  props: { project: unknown; mediaUrls: Record<string, string>; hints?: { motionBlurSamples?: number } };
  options: { crf: number; browserExecutable?: string; gl: string; concurrency: number; x264Preset?: string; jpegQuality?: number; imageFormat?: "jpeg" | "png"; offthreadCacheMB?: number; motionBlurSamples?: number; scale?: number };
  expected: { width: number; height: number; fps: number; durationInFrames: number; hasAudio: boolean };
  ffprobe: string;
}

const emit = (o: Record<string, unknown>) => process.stdout.write(JSON.stringify(o) + "\n");
const T0 = Date.now();
const lap = (name: string) => emit({ type: "timing", name, atMs: Date.now() - T0 });

function sourceFingerprint(roots: string[]): string {
  const h = crypto.createHash("sha1");
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else {
        const s = fs.statSync(p);
        h.update(`${p}:${s.size}:${s.mtimeMs}`);
      }
    }
  };
  roots.forEach(walk);
  return h.digest("hex").slice(0, 12);
}

async function main() {
  const jobDir = path.resolve(process.argv[2] ?? "");
  const input: Input = JSON.parse(fs.readFileSync(path.join(jobDir, "input.json"), "utf8"));
  const root = process.cwd();
  const cacheDir = path.join(path.dirname(path.dirname(path.dirname(jobDir))), ".cache");
  fs.mkdirSync(cacheDir, { recursive: true });

  emit({ type: "stage", stage: "bundling" });
  lap("start");
  const fp = sourceFingerprint([path.join(root, "src/remotion"), path.join(root, "src/lib")]);
  const bundleDir = path.join(cacheDir, `bundle-${fp}`);
  let serveUrl = bundleDir;
  if (!fs.existsSync(path.join(bundleDir, "index.html"))) {
    serveUrl = await bundle({ entryPoint: path.join(root, "src/remotion/index.ts"), outDir: bundleDir + ".tmp" });
    fs.rmSync(bundleDir, { recursive: true, force: true });
    fs.renameSync(bundleDir + ".tmp", bundleDir);
    serveUrl = bundleDir;
  }

  lap("bundled");
  const chromiumOptions = { gl: input.options.gl as "swangle" };
  const browserExecutable = input.options.browserExecutable || null;
  emit({ type: "stage", stage: "preparing" });
  const composition = await selectComposition({ serveUrl, id: "Studio", inputProps: input.props, browserExecutable, chromiumOptions });

  lap("composition-selected");
  const e = input.expected;
  if (composition.width !== e.width || composition.height !== e.height || composition.fps !== e.fps || composition.durationInFrames !== e.durationInFrames) {
    throw new Error(`Composition metadata mismatch: got ${composition.width}x${composition.height}@${composition.fps} ${composition.durationInFrames}f`);
  }

  const output = path.join(jobDir, "output.mp4");
  emit({ type: "stage", stage: "rendering" });
  let lastPct = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    audioCodec: "aac",
    crf: input.options.crf,
    x264Preset: (input.options.x264Preset ?? "medium") as "medium",
    imageFormat: input.options.imageFormat ?? "jpeg",
    jpegQuality: input.options.jpegQuality ?? 95 /* same speed as 80, +0.5 dB and 28 % smaller files (docs/RENDER_BENCHMARKS.md) */,
    offthreadVideoCacheSizeInBytes: input.options.offthreadCacheMB ? input.options.offthreadCacheMB * 1024 * 1024 : null,
    pixelFormat: "yuv420p",
    scale: input.options.scale ?? 1,
    outputLocation: output,
    inputProps: input.props,
    browserExecutable,
    chromiumOptions,
    concurrency: input.options.concurrency || Math.max(1, Math.min(4, Math.floor(os.cpus().length / 2))),
    timeoutInMilliseconds: 120_000,
    logLevel: "warn",
    onProgress: (p) => {
      const pct = Math.floor(p.progress * 100);
      if (pct !== lastPct) {
        lastPct = pct;
        emit({ type: "progress", progress: p.progress, renderedFrames: p.renderedFrames, encodedFrames: p.encodedFrames, stage: p.stitchStage });
      }
    },
  });

  lap("rendered");
  emit({ type: "stage", stage: "verifying" });
  const j = JSON.parse(execFileSync(input.ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", output], { encoding: "utf8" }));
  const v = j.streams.find((s: { codec_type: string }) => s.codec_type === "video");
  const a = j.streams.find((s: { codec_type: string }) => s.codec_type === "audio");
  const durationMs = Number(j.format.duration) * 1000;
  const expectedMs = (e.durationInFrames * 1000) / e.fps;
  const problems: string[] = [];
  if (!v || v.codec_name !== "h264") problems.push("video is not H.264");
  if (v && (v.width !== e.width || v.height !== e.height)) problems.push(`size ${v.width}x${v.height} != ${e.width}x${e.height}`);
  if (Math.abs(durationMs - expectedMs) > 150) problems.push(`duration ${Math.round(durationMs)}ms differs from expected ${Math.round(expectedMs)}ms`);
  if (e.hasAudio && !a) problems.push("expected an audio track but the file has none");
  emit({ type: "done", bytes: fs.statSync(output).size, verification: { ok: problems.length === 0, problems, width: v?.width, height: v?.height, codec: v?.codec_name, fps: v?.avg_frame_rate, durationMs: Math.round(durationMs), expectedDurationMs: Math.round(expectedMs), hasAudio: !!a, audioCodec: a?.codec_name ?? null } });
}

main().catch((err) => {
  emit({ type: "error", message: String(err?.message ?? err).slice(0, 2000) });
  process.exit(1);
});
