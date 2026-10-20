import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { route, HttpError } from "@/server/http";
import { config } from "@/server/config";
import { projectDir, readProject, writeProject } from "@/server/storage";
import { makeThumbnail, probe } from "@/server/ffmpeg";
import { uid, type Asset } from "@/lib/project";
import { validateUpload } from "@/lib/upload";

export const maxDuration = 600;

/**
 * Raw-body upload: PUT/POST /api/projects/:id/upload?filename=clip.mp4&kind=video|audio
 * The body is streamed to disk (never buffered in memory), size-capped, sniffed by magic bytes and
 * finally verified by ffprobe before it is registered as an asset.
 */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const filename = req.nextUrl.searchParams.get("filename") ?? "";
  const kindParam = req.nextUrl.searchParams.get("kind");
  const kind: "video" | "audio" | "font" = kindParam === "audio" ? "audio" : kindParam === "font" ? "font" : "video";
  const declared = Number(req.headers.get("content-length") ?? 0);
  const pre = validateUpload({ filename, size: declared || 1, kind });
  if (!pre.ok) throw new HttpError(pre.status, pre.error);
  if (declared > config.maxUploadBytes) throw new HttpError(413, `File exceeds the ${Math.round(config.maxUploadBytes / 1048576)} MB limit`);
  if (!req.body) throw new HttpError(400, "Empty body");

  const project = await readProject(id);
  const assetId = uid("a").toLowerCase();
  const rel = `assets/${assetId}${pre.ext}`;
  const dir = projectDir(id);
  await fsp.mkdir(path.join(dir, "assets"), { recursive: true });
  const full = path.join(dir, rel);
  const part = full + ".part";

  let bytes = 0;
  const limiter = new Transform({
    transform(chunk, _enc, cb) {
      bytes += chunk.length;
      if (bytes > config.maxUploadBytes) return cb(new HttpError(413, "File exceeds the upload limit"));
      cb(null, chunk);
    },
  });
  const cleanup = () => fsp.rm(part, { force: true }).then(() => fsp.rm(full, { force: true }));
  try {
    await pipeline(Readable.fromWeb(req.body as never), limiter, fs.createWriteStream(part, { flags: "wx" }));
    if (bytes === 0) throw new HttpError(400, "Empty file");

    const head = Buffer.alloc(16);
    const fh = await fsp.open(part, "r");
    await fh.read(head, 0, 16, 0);
    await fh.close();
    const sniff = validateUpload({ filename, size: bytes, kind, head });
    if (!sniff.ok) throw new HttpError(sniff.status, sniff.error);

    await fsp.rename(part, full);
    if (kind === "font") {
      // Fonts are registered as-is (no ffprobe). The browser/renderer validates the file when it loads the face.
      const fontAsset: Asset = { id: assetId, kind: "font", filename: path.basename(filename).slice(0, 200), mime: pre.mime, storageKey: rel, sizeBytes: bytes, durationMs: 0, hasAudio: false };
      const savedFont = await writeProject({ ...project, assets: { ...project.assets, [assetId]: fontAsset } });
      return { asset: fontAsset, project: savedFont };
    }
    let info;
    try {
      info = await probe(full);
    } catch (e) {
      throw new HttpError(422, (e as Error).message);
    }
    if (kind === "video" && info.kind !== "video") throw new HttpError(422, "This file has no video stream");
    if (info.durationMs <= 0) throw new HttpError(422, "Could not determine the media duration");
    if (info.durationMs / 1000 > config.maxDurationSec) throw new HttpError(422, `Media is longer than the ${Math.round(config.maxDurationSec / 60)} minute limit`);
    if (kind === "video" && info.width && info.height && Math.max(info.width, info.height) > 8192) throw new HttpError(422, "Resolution above 8192px is not supported");

    let thumbnailKey: string | undefined;
    if (info.kind === "video") {
      const t = `assets/${assetId}.jpg`;
      try {
        await makeThumbnail(full, path.join(dir, t), Math.min(1, info.durationMs / 2000));
        thumbnailKey = t;
      } catch {
        /* thumbnail is cosmetic; keep the asset */
      }
    }
    const asset: Asset = {
      id: assetId,
      kind: info.kind,
      filename: path.basename(filename).slice(0, 200),
      mime: pre.mime,
      storageKey: rel,
      sizeBytes: bytes,
      durationMs: info.durationMs,
      width: info.width,
      height: info.height,
      fps: info.fps ? Math.round(info.fps * 100) / 100 : undefined,
      hasAudio: info.hasAudio,
      thumbnailKey,
      rotation: info.rotation || undefined,
    };
    const next = { ...project, assets: { ...project.assets, [assetId]: asset } };
    if (kind === "video" && !project.sourceAssetId) {
      next.sourceAssetId = assetId;
      if (info.width && info.height) next.aspect = info.width > info.height ? "16:9" : info.width === info.height ? "1:1" : "9:16";
    }
    const saved = await writeProject(next);
    return { asset, project: saved };
  } catch (e) {
    await cleanup();
    throw e;
  }
});
