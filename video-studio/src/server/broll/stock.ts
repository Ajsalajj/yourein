/** Stock providers (Pexels, Pixabay). Mapping functions are pure and unit-tested against the documented response shapes. */
import type { Fetch, Orientation, ProviderStatus, SearchQuery, StockProvider, StockResult } from "./types";

const pickBest = <T extends { width: number; height: number }>(files: T[], orientation: Orientation, maxW = 1920): T | undefined => {
  const usable = files.filter((f) => f.width > 0 && Math.min(f.width, f.height) >= 540);
  const pool = usable.length ? usable : files;
  const want = orientation === "portrait" ? (f: T) => f.height >= f.width : orientation === "landscape" ? (f: T) => f.width >= f.height : () => true;
  const oriented = pool.filter(want);
  const src = oriented.length ? oriented : pool;
  // largest that does not exceed maxW on its long side; else the smallest above it
  const under = src.filter((f) => Math.max(f.width, f.height) <= maxW).sort((a, b) => b.width * b.height - a.width * a.height);
  return under[0] ?? [...src].sort((a, b) => a.width * a.height - b.width * b.height)[0];
};

/* ── Pexels: GET /v1... https://api.pexels.com/videos/search?query=&orientation=&per_page=  (Authorization: <key>) ── */
interface PexelsFile { id?: number; quality?: string; file_type?: string; width: number; height: number; link: string }
interface PexelsVideo { id: number; url: string; image: string; duration: number; width: number; height: number; user?: { name?: string; url?: string }; video_files?: PexelsFile[]; video_pictures?: { picture: string }[] }
export function mapPexels(json: { videos?: PexelsVideo[] }, orientation: Orientation): StockResult[] {
  const out: StockResult[] = [];
  for (const v of json.videos ?? []) {
    const files = (v.video_files ?? []).filter((f) => (f.file_type ?? "video/mp4") === "video/mp4" && f.link);
    const best = pickBest(files, orientation);
    if (!best) continue;
    out.push({
      provider: "pexels", id: String(v.id), title: v.url.split("/").filter(Boolean).pop()?.replace(/-\d+$/, "").replace(/-/g, " ") ?? `Pexels ${v.id}`,
      thumbUrl: v.image || v.video_pictures?.[0]?.picture || "", previewUrl: (pickBest(files, orientation, 960) ?? best).link, downloadUrl: best.link,
      durationSec: v.duration, width: best.width, height: best.height, author: v.user?.name ?? "", pageUrl: v.url,
      license: "Pexels License: free to use, attribution appreciated (credit the creator).",
    });
  }
  return out;
}
export const pexels = (fetchFn: Fetch, env: Record<string, string | undefined> = process.env): StockProvider => ({
  id: "pexels", name: "Pexels", kind: "stock", license: "Pexels License", allowedHosts: ["videos.pexels.com", "player.vimeo.com", "images.pexels.com"],
  status: (): ProviderStatus => (env.PEXELS_API_KEY ? { ok: true } : { ok: false, hint: "Set PEXELS_API_KEY (free key from pexels.com/api) and restart." }),
  async search(q: SearchQuery) {
    const base = env.PEXELS_API_BASE ?? "https://api.pexels.com";
    const url = `${base}/videos/search?query=${encodeURIComponent(q.query)}&orientation=${q.orientation}&per_page=${q.perPage ?? 12}&page=${q.page ?? 1}`;
    const r = await fetchFn(url, { headers: { Authorization: env.PEXELS_API_KEY ?? "" } });
    if (!r.ok) throw new Error(`Pexels returned ${r.status}`);
    return mapPexels(await r.json(), q.orientation).filter((x) => (!q.minDurationSec || x.durationSec >= q.minDurationSec) && (!q.maxDurationSec || x.durationSec <= q.maxDurationSec));
  },
});

/* ── Pixabay: GET https://pixabay.com/api/videos/?key=&q=&per_page= ── */
interface PixabayVideoFile { url: string; width: number; height: number; size?: number; thumbnail?: string }
interface PixabayHit { id: number; pageURL: string; tags?: string; duration: number; picture_id?: string; user?: string; videos?: Record<string, PixabayVideoFile> }
export function mapPixabay(json: { hits?: PixabayHit[] }, orientation: Orientation): StockResult[] {
  const out: StockResult[] = [];
  for (const h of json.hits ?? []) {
    const files = Object.values(h.videos ?? {}).filter((f) => f.url);
    const best = pickBest(files, orientation);
    if (!best) continue;
    const small = Object.values(h.videos ?? {}).sort((a, b) => a.width - b.width).find((f) => f.url) ?? best;
    out.push({
      provider: "pixabay", id: String(h.id), title: (h.tags ?? `Pixabay ${h.id}`).slice(0, 80), thumbUrl: best.thumbnail || (h.picture_id ? `https://i.vimeocdn.com/video/${h.picture_id}_295x166.jpg` : ""),
      previewUrl: small.url, downloadUrl: best.url, durationSec: h.duration, width: best.width, height: best.height, author: h.user ?? "", pageUrl: h.pageURL,
      license: "Pixabay Content License: free for commercial use, no attribution required (credit appreciated).",
    });
  }
  return out;
}
export const pixabay = (fetchFn: Fetch, env: Record<string, string | undefined> = process.env): StockProvider => ({
  id: "pixabay", name: "Pixabay", kind: "stock", license: "Pixabay Content License", allowedHosts: ["cdn.pixabay.com", "i.vimeocdn.com", "player.vimeo.com"],
  status: (): ProviderStatus => (env.PIXABAY_API_KEY ? { ok: true } : { ok: false, hint: "Set PIXABAY_API_KEY (free key from pixabay.com/api/docs) and restart." }),
  async search(q: SearchQuery) {
    const base = env.PIXABAY_API_BASE ?? "https://pixabay.com";
    const url = `${base}/api/videos/?key=${encodeURIComponent(env.PIXABAY_API_KEY ?? "")}&q=${encodeURIComponent(q.query)}&per_page=${Math.max(3, q.perPage ?? 12)}&page=${q.page ?? 1}&safesearch=true`;
    const r = await fetchFn(url);
    if (!r.ok) throw new Error(`Pixabay returned ${r.status}`);
    return mapPixabay(await r.json(), q.orientation).filter((x) => (!q.minDurationSec || x.durationSec >= q.minDurationSec) && (!q.maxDurationSec || x.durationSec <= q.maxDurationSec));
  },
});
