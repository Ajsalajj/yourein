import path from "node:path";

const num = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

export const config = {
  /** All persisted state (projects, media, exports) lives under this directory. */
  dataDir: path.resolve(process.env.DATA_DIR ?? path.join(process.cwd(), "data")),
  maxUploadBytes: num(process.env.MAX_UPLOAD_MB, 2048) * 1024 * 1024,
  maxDurationSec: num(process.env.MAX_VIDEO_DURATION_SEC, 3 * 3600),
  aiServiceUrl: (process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8100").replace(/\/$/, ""),
  aiServiceToken: process.env.AI_SERVICE_TOKEN ?? "",
  /** When set, every API call needs this token (header, cookie or ?token=). Leave empty for single-user localhost use. */
  accessToken: process.env.STUDIO_ACCESS_TOKEN ?? "",
  /** URL under which the renderer (a separate process) can reach this app to fetch media. */
  internalBaseUrl: (process.env.INTERNAL_BASE_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3100}`).replace(/\/$/, ""),
  browserExecutable: process.env.BROWSER_EXECUTABLE || "",
  renderGl: process.env.REMOTION_GL ?? "swangle",
  renderConcurrency: num(process.env.RENDER_CONCURRENCY, 0),
  ffmpeg: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobe: process.env.FFPROBE_PATH ?? "ffprobe",
};

export const projectsRoot = () => path.join(config.dataDir, "projects");
