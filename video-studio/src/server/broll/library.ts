/** The user's own B-roll folder: DATA_DIR/library/broll/*.{mp4,mov,webm,m4v}. Searched by file name and an optional "<name>.txt" tag file. Fully local. */
import fsp from "node:fs/promises";
import path from "node:path";
import { config } from "../config";
import { makeThumbnail, probe } from "../ffmpeg";
import type { SearchQuery, StockProvider, StockResult } from "./types";

export const libraryDir = () => path.join(config.dataDir, "library", "broll");
const EXT = /\.(mp4|mov|webm|m4v)$/i;
export const isSafeLibraryName = (n: string) => /^[\w][\w .()\-]{0,120}\.(mp4|mov|webm|m4v)$/i.test(n) && !n.includes("..");

export const tokens = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);

/** score: fraction of query tokens found in name/tags (prefix match so "ocean" finds "oceans") */
export function matchScore(query: string, haystack: string): number {
  const q = tokens(query);
  if (!q.length) return 0;
  const h = tokens(haystack);
  return q.filter((t) => h.some((x) => x === t || x.startsWith(t) || t.startsWith(x))).length / q.length;
}

async function entry(name: string, origin: string): Promise<(StockResult & { score?: number }) | null> {
  const file = path.join(libraryDir(), name);
  let tags = "";
  try { tags = await fsp.readFile(path.join(libraryDir(), name.replace(EXT, ".txt")), "utf8"); } catch { /* optional */ }
  const info = await probe(file).catch(() => null);
  if (!info || info.kind !== "video") return null;
  const thumb = path.join(libraryDir(), ".thumbs", `${name}.jpg`);
  await fsp.mkdir(path.dirname(thumb), { recursive: true });
  await fsp.stat(thumb).catch(() => makeThumbnail(file, thumb, Math.min(1, info.durationMs / 2000)));
  const enc = encodeURIComponent(name);
  return {
    provider: "library", id: name, title: name.replace(EXT, "").replace(/[_-]+/g, " ") + (tags.trim() ? ` · ${tags.trim().slice(0, 60)}` : ""),
    thumbUrl: `${origin}/api/broll/library/thumb?name=${enc}`, previewUrl: `${origin}/api/broll/library/file?name=${enc}`, downloadUrl: `local:${name}`,
    durationSec: info.durationMs / 1000, width: info.width ?? 0, height: info.height ?? 0, author: "", pageUrl: "", license: "Your own footage (you are responsible for its licence).",
  };
}

export const libraryProvider = (origin = ""): StockProvider => ({
  id: "library", name: "My B-roll folder", kind: "library", license: "Your own files", allowedHosts: [],
  async status() {
    try { const n = (await fsp.readdir(libraryDir())).filter((f) => EXT.test(f)).length; return n ? { ok: true, hint: `${n} clip${n === 1 ? "" : "s"} in ${libraryDir()}` } : { ok: false, hint: `Put .mp4/.mov/.webm clips in ${libraryDir()} (optional name.txt next to a clip holds search tags).` }; }
    catch { return { ok: false, hint: `Create ${libraryDir()} and put your clips there (optional name.txt tags).` }; }
  },
  async search(q: SearchQuery) {
    let names: string[] = [];
    try { names = (await fsp.readdir(libraryDir())).filter((f) => EXT.test(f) && isSafeLibraryName(f)); } catch { return []; }
    const out: (StockResult & { score: number })[] = [];
    for (const n of names) {
      const e = await entry(n, origin);
      if (!e) continue;
      let tags = "";
      try { tags = await fsp.readFile(path.join(libraryDir(), n.replace(EXT, ".txt")), "utf8"); } catch { /* none */ }
      const score = matchScore(q.query, `${n} ${tags}`);
      if (score > 0 || !q.query.trim()) out.push({ ...e, score });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, q.perPage ?? 12).map(({ score: _s, ...r }) => r);
  },
});
