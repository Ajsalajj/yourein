import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest } from "next/server";
import { route, HttpError } from "@/server/http";
import { assetOf, readProject, safeProjectPath } from "@/server/storage";
import { isSafeId } from "@/lib/project";

type P = { projectId: string; assetId: string };

/** Serves project media with HTTP Range support (needed for seeking and for the renderer). Only registered assets are reachable. */
async function serve(req: NextRequest, { projectId, assetId }: P, head: boolean) {
  if (!isSafeId(assetId)) throw new HttpError(400, "Invalid asset id");
  const project = await readProject(projectId);
  const asset = assetOf(project, assetId);
  const thumb = req.nextUrl.searchParams.get("thumb") === "1";
  if (thumb && !asset.thumbnailKey) throw new HttpError(404, "No thumbnail");
  const file = await safeProjectPath(projectId, thumb ? asset.thumbnailKey! : asset.storageKey);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat?.isFile()) throw new HttpError(404, "File missing on disk");
  const type = thumb ? "image/jpeg" : asset.mime;
  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=300" };

  const m = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : stat.size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : stat.size - 1;
    start = Math.max(0, start);
    end = Math.min(end, stat.size - 1);
    if (start > end || start >= stat.size) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${stat.size}` } });
    const headers = { ...base, "Content-Range": `bytes ${start}-${end}/${stat.size}`, "Content-Length": String(end - start + 1) };
    if (head) return new Response(null, { status: 206, headers });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers });
  }
  const headers = { ...base, "Content-Length": String(stat.size) };
  if (head) return new Response(null, { status: 200, headers });
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { status: 200, headers });
}

export const GET = route<P>((req, p) => serve(req, p, false));
export const HEAD = route<P>((req, p) => serve(req, p, true));
