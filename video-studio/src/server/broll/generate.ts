/**
 * Optional AI video generation, configured separately from stock search. This is a GENERIC HTTP adapter, not an integration with a specific vendor:
 *   POST {BROLL_GEN_ENDPOINT}  json {prompt, durationSec, aspect}  headers Authorization: Bearer {BROLL_GEN_TOKEN}
 *   -> 200 {"downloadUrl": "https://..."}                               (finished)
 *   -> 202 {"statusUrl": "https://..."}  then GET statusUrl until {"status":"done","downloadUrl":...} | {"status":"failed"}
 * Nothing is configured by default, so the editor shows it as "not configured".
 */
import type { Fetch, GenerationProvider, GenerationRequest } from "./types";

export const httpGenerator = (fetchFn: Fetch, env: Record<string, string | undefined> = process.env, sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms))): GenerationProvider => {
  const endpoint = env.BROLL_GEN_ENDPOINT ?? "";
  const host = (() => { try { return new URL(endpoint).hostname; } catch { return ""; } })();
  return {
    id: "generator", name: env.BROLL_GEN_NAME || "AI video generator (HTTP)", allowedHosts: [host, ...(env.BROLL_GEN_DOWNLOAD_HOSTS ?? "").split(",").map((s) => s.trim()).filter(Boolean)].filter(Boolean),
    status: () => (endpoint ? { ok: true } : { ok: false, hint: "Set BROLL_GEN_ENDPOINT (and BROLL_GEN_TOKEN) to a service implementing the documented JSON contract." }),
    async generate(req: GenerationRequest) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (env.BROLL_GEN_TOKEN) headers.Authorization = `Bearer ${env.BROLL_GEN_TOKEN}`;
      let r = await fetchFn(endpoint, { method: "POST", headers, body: JSON.stringify(req) });
      if (!r.ok) throw new Error(`Generator returned ${r.status}`);
      let j: { downloadUrl?: string; statusUrl?: string; status?: string } = await r.json();
      for (let i = 0; i < 120 && !j.downloadUrl; i++) {
        if (!j.statusUrl) throw new Error("Generator response has neither downloadUrl nor statusUrl");
        await sleep(2000);
        r = await fetchFn(j.statusUrl, { headers });
        j = await r.json();
        if (j.status === "failed") throw new Error("Generator reported failure");
      }
      if (!j.downloadUrl) throw new Error("Generator timed out");
      return { downloadUrl: j.downloadUrl, title: req.prompt.slice(0, 60) };
    },
  };
};
