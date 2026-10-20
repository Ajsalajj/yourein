import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { route, HttpError } from "@/server/http";
import { projectDir, readProject } from "@/server/storage";

type P = { id: string; maskId: string; frame: string };

/** One matte frame (RGBA PNG, alpha = person). Only the project's registered segmentation is reachable. */
export const GET = route<P>(async (_req, { id, maskId, frame }) => {
  if (!/^\d{1,7}$/.test(frame)) throw new HttpError(400, "Invalid frame");
  const project = await readProject(id);
  const seg = project.analysis.segmentation;
  if (!seg || seg.id !== maskId) throw new HttpError(404, "No such mask");
  const n = Math.min(Number(frame), seg.frames - 1);
  const file = path.join(projectDir(id), "masks", seg.id, `${String(n).padStart(6, "0")}.png`);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat?.isFile()) throw new HttpError(404, "Matte frame missing");
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, { headers: { "Content-Type": "image/png", "Content-Length": String(stat.size), "Cache-Control": "private, max-age=3600, immutable", "X-Content-Type-Options": "nosniff" } });
});
