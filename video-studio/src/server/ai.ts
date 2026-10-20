import { config } from "./config";
import { HttpError } from "./http";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${config.aiServiceUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(config.aiServiceToken ? { "X-Internal-Token": config.aiServiceToken } : {}), ...init?.headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new HttpError(503, `AI service is not reachable at ${config.aiServiceUrl}. Start it with: npm run ai (see README).`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status === 404 ? 404 : 502, (body as { detail?: string }).detail ?? `AI service error ${res.status}`);
  return body as T;
}

export interface AiWord {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  timingSource: "asr" | "interpolated";
}
export interface AiResult {
  engine: string;
  model: string;
  language: string;
  languageProbability: number | null;
  wordTimestampsNative: boolean;
  durationMs: number;
  warnings: string[];
  words: AiWord[];
}
export interface AiJob {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  stage: string;
  error?: string | null;
  result?: AiResult | null;
}
export interface AiEngines {
  engines: { id: string; available: boolean; languages: string[] | "auto"; note: string; modelReady?: boolean }[];
  defaultEngine: string | null;
}

export interface VisionJobResult { [k: string]: unknown }
export interface VisionJob { id: string; status: "queued" | "running" | "done" | "failed"; progress: number; stage: string; error?: string | null; result?: VisionJobResult | null }

export const ai = {
  startSegment: (body: { path: string; out_dir: string; fps: number }) => call<{ id: string }>("/v1/jobs/segment", { method: "POST", body: JSON.stringify(body) }),
  startTrack: (body: { path: string; fps: number; start_ms: number; end_ms?: number | null; roi: { x: number; y: number; w: number; h: number } }) => call<{ id: string }>("/v1/jobs/track", { method: "POST", body: JSON.stringify(body) }),
  visionJob: (id: string) => call<VisionJob>(`/v1/jobs/${encodeURIComponent(id)}`),
  engines: () => call<AiEngines>("/v1/engines"),
  startTranscribe: (body: { path: string; language?: string | null; engine?: string; model?: string }) => call<{ id: string }>("/v1/jobs/transcribe", { method: "POST", body: JSON.stringify(body) }),
  job: (id: string) => call<AiJob>(`/v1/jobs/${encodeURIComponent(id)}`),
};
