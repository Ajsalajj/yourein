import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { route } from "@/server/http";
import { config } from "@/server/config";
import { ai } from "@/server/ai";

const run = promisify(execFile);
async function version(bin: string) {
  try {
    const { stdout } = await run(bin, ["-version"], { timeout: 5000 });
    return { ok: true, detail: stdout.split("\n")[0] };
  } catch {
    return { ok: false, detail: `${bin} not found` };
  }
}

export const GET = route(async () => {
  const [ffmpeg, ffprobe] = await Promise.all([version(config.ffmpeg), version(config.ffprobe)]);
  let aiStatus: { ok: boolean; detail: string; engines?: unknown } = { ok: false, detail: "unreachable" };
  try {
    const e = await ai.engines();
    aiStatus = { ok: true, detail: `default engine: ${e.defaultEngine ?? "none available"}`, engines: e.engines };
  } catch (e) {
    aiStatus = { ok: false, detail: (e as Error).message };
  }
  const browser = config.browserExecutable ? { ok: fs.existsSync(config.browserExecutable), detail: config.browserExecutable } : { ok: true, detail: "Remotion-managed Chrome Headless Shell (downloaded on first export)" };
  return { ffmpeg, ffprobe, ai: aiStatus, browser, dataDir: config.dataDir, maxUploadMb: Math.round(config.maxUploadBytes / 1048576), authRequired: !!config.accessToken };
});
