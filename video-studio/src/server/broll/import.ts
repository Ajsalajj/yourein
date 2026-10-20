/** Bring a B-roll clip into a project as a normal video asset (probe + thumbnail), from a local library file or an allowlisted https download. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { HttpError } from "../http";
import { makeThumbnail, probe } from "../ffmpeg";
import { projectDir, readProject, writeProject } from "../storage";
import { uid, type Asset } from "@/lib/project";
import { libraryDir, isSafeLibraryName } from "./library";
import { isAllowedDownload } from "./registry";

const MAX_BROLL_BYTES = 400 * 1024 * 1024;

export async function importBroll(projectId: string, src: { kind: "library"; name: string } | { kind: "url"; url: string; allowedHosts: string[]; filename: string }) {
  await readProject(projectId); // 404 early for an unknown project
  const id = uid("a").toLowerCase();
  const dir = projectDir(projectId);
  await fsp.mkdir(path.join(dir, "assets"), { recursive: true });
  const rel = `assets/${id}.mp4`;
  const full = path.join(dir, rel);
  const part = `${full}.part`;
  try {
    let bytes = 0;
    if (src.kind === "library") {
      if (!isSafeLibraryName(src.name)) throw new HttpError(400, "Invalid library file name");
      const from = path.join(libraryDir(), src.name);
      const st = await fsp.stat(from).catch(() => null);
      if (!st?.isFile()) throw new HttpError(404, "Library clip not found");
      if (st.size > MAX_BROLL_BYTES) throw new HttpError(413, "Clip is larger than 400 MB");
      await fsp.copyFile(from, part);
      bytes = st.size;
    } else {
      if (!isAllowedDownload(src.url, src.allowedHosts)) throw new HttpError(400, "Download URL is not on this provider's allowed hosts (https only)");
      const r = await fetch(src.url, { redirect: "follow" });
      if (!r.ok || !r.body) throw new HttpError(502, `Provider download failed (${r.status})`);
      // a redirect must not leave the allowlist either
      if (!isAllowedDownload(r.url, src.allowedHosts)) throw new HttpError(400, "Download redirected outside the allowed hosts");
      const limiter = new Transform({ transform(chunk, _e, cb) { bytes += chunk.length; bytes > MAX_BROLL_BYTES ? cb(new HttpError(413, "Clip is larger than 400 MB")) : cb(null, chunk); } });
      await pipeline(Readable.fromWeb(r.body as never), limiter, fs.createWriteStream(part, { flags: "wx" }));
    }
    const info = await probe(part).catch((e) => { throw new HttpError(422, (e as Error).message); });
    if (info.kind !== "video" || info.durationMs <= 0) throw new HttpError(422, "This download is not a playable video");
    await fsp.rename(part, full);
    let thumbnailKey: string | undefined;
    try { thumbnailKey = `assets/${id}.jpg`; await makeThumbnail(full, path.join(dir, thumbnailKey), Math.min(1, info.durationMs / 2000)); } catch { thumbnailKey = undefined; }
    const asset: Asset = { id, kind: "video", filename: src.kind === "library" ? src.name : src.filename.slice(0, 200), mime: "video/mp4", storageKey: rel, sizeBytes: bytes, durationMs: info.durationMs, width: info.width, height: info.height, fps: info.fps ? Math.round(info.fps * 100) / 100 : undefined, hasAudio: info.hasAudio, thumbnailKey, rotation: info.rotation || undefined };
    const latest = await readProject(projectId); // re-read: autosave may have written while the clip downloaded
    const saved = await writeProject({ ...latest, assets: { ...latest.assets, [id]: asset } });
    return { asset, project: saved };
  } catch (e) {
    await fsp.rm(part, { force: true }); await fsp.rm(full, { force: true });
    throw e;
  }
}
