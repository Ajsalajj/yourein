import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { route, HttpError } from "@/server/http";
import { isSafeLibraryName, libraryDir } from "@/server/broll/library";

/** Preview of a library clip with Range support. */
export const GET = route(async (req) => {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  if (!isSafeLibraryName(name)) throw new HttpError(400, "Invalid name");
  const file = path.join(libraryDir(), name);
  const st = await fsp.stat(file).catch(() => null);
  if (!st?.isFile()) throw new HttpError(404, "Not found");
  const type = /\.webm$/i.test(name) ? "video/webm" : /\.mov$/i.test(name) ? "video/quicktime" : "video/mp4";
  const base = { "Content-Type": type, "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
  const m = req.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : st.size - Number(m[2]);
    const end = Math.min(m[1] && m[2] ? Number(m[2]) : st.size - 1, st.size - 1);
    if (start > end || start >= st.size) return new Response(null, { status: 416, headers: { ...base, "Content-Range": `bytes */${st.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream, { status: 206, headers: { ...base, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: { ...base, "Content-Length": String(st.size) } });
});
