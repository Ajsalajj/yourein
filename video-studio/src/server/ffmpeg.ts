import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { config } from "./config";

const execFileP = promisify(execFile);

export interface MediaInfo {
  kind: "video" | "audio";
  durationMs: number;
  width?: number;
  height?: number;
  fps?: number;
  hasAudio: boolean;
  videoCodec?: string;
  formatName: string;
  rotation: number;
}

function parseRate(r?: string): number | undefined {
  if (!r) return undefined;
  const [a, b] = r.split("/").map(Number);
  if (!a || !b) return undefined;
  return a / b;
}

export async function probe(file: string): Promise<MediaInfo> {
  const { stdout } = await execFileP(config.ffprobe, ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file], { maxBuffer: 16 * 1024 * 1024, timeout: 60_000 }).catch((e) => {
    throw new Error(`ffprobe could not read this file (${(e as Error).message.split("\n")[0]})`);
  });
  const j = JSON.parse(stdout);
  const streams: Record<string, unknown>[] = j.streams ?? [];
  const v = streams.find((s) => s.codec_type === "video" && (s.disposition as { attached_pic?: number } | undefined)?.attached_pic !== 1) as Record<string, unknown> | undefined;
  const a = streams.find((s) => s.codec_type === "audio");
  if (!v && !a) throw new Error("No audio or video stream found");
  const rotSide = ((v?.side_data_list as { rotation?: number }[] | undefined) ?? []).find((s) => typeof s.rotation === "number")?.rotation;
  const rotation = Math.abs(Number(rotSide ?? (v?.tags as { rotate?: string } | undefined)?.rotate ?? 0)) % 360;
  let width = v ? Number(v.width) : undefined;
  let height = v ? Number(v.height) : undefined;
  if (width && height && (rotation === 90 || rotation === 270)) [width, height] = [height, width];
  const durationSec = Number(j.format?.duration ?? v?.duration ?? a?.duration ?? 0);
  return {
    kind: v ? "video" : "audio",
    durationMs: Math.round(durationSec * 1000),
    width,
    height,
    fps: parseRate(String(v?.avg_frame_rate ?? v?.r_frame_rate ?? "")),
    hasAudio: !!a,
    videoCodec: v ? String(v.codec_name) : undefined,
    formatName: String(j.format?.format_name ?? ""),
    rotation,
  };
}

export async function makeThumbnail(input: string, output: string, atSec: number) {
  await execFileP(config.ffmpeg, ["-v", "error", "-y", "-ss", String(Math.max(0, atSec)), "-i", input, "-frames:v", "1", "-vf", "scale='min(480,iw)':-2", "-q:v", "4", output], { timeout: 60_000 });
}

export interface Silence {
  startMs: number;
  endMs: number;
}

/** Energy-based silence detection via ffmpeg `silencedetect`. (Not neural VAD - see docs/KNOWN_LIMITATIONS.md.) */
export function detectSilence(input: string, noiseDb: number, minSilenceSec: number, durationMs: number): Promise<Silence[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(config.ffmpeg, ["-v", "info", "-nostats", "-i", input, "-vn", "-af", `silencedetect=noise=${noiseDb}dB:d=${minSilenceSec}`, "-f", "null", "-"]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => {
      if (code !== 0) return reject(new Error("ffmpeg silencedetect failed"));
      const out: Silence[] = [];
      let start: number | null = null;
      for (const line of err.split("\n")) {
        const s = line.match(/silence_start: (-?[\d.]+)/);
        const e = line.match(/silence_end: ([\d.]+)/);
        if (s) start = Math.max(0, Number(s[1])) * 1000;
        if (e && start !== null) {
          out.push({ startMs: Math.round(start), endMs: Math.round(Number(e[1]) * 1000) });
          start = null;
        }
      }
      if (start !== null) out.push({ startMs: Math.round(start), endMs: durationMs });
      resolve(out);
    });
  });
}

/** Coarse waveform peaks (0..1) for the timeline: decode to 8 kHz mono and bucket. */
export function waveformPeaks(input: string, buckets: number, durationMs: number): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const p = spawn(config.ffmpeg, ["-v", "error", "-i", input, "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"]);
    const samplesPerBucket = Math.max(1, Math.floor((durationMs / 1000) * 8000 / buckets));
    const peaks: number[] = [];
    let cur = 0;
    let n = 0;
    let carry: Buffer | null = null;
    p.stdout.on("data", (chunk: Buffer) => {
      const buf = carry ? Buffer.concat([carry, chunk]) : chunk;
      const usable = buf.length - (buf.length % 2);
      for (let i = 0; i < usable; i += 2) {
        cur = Math.max(cur, Math.abs(buf.readInt16LE(i)));
        if (++n >= samplesPerBucket) {
          peaks.push(cur / 32768);
          cur = 0;
          n = 0;
        }
      }
      carry = usable < buf.length ? buf.subarray(usable) : null;
    });
    p.on("error", reject);
    p.on("close", () => {
      if (n > 0) peaks.push(cur / 32768);
      resolve(peaks);
    });
  });
}
