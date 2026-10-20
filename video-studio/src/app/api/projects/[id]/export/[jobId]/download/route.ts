import fs from "node:fs";
import fsp from "node:fs/promises";
import { Readable } from "node:stream";
import { route, HttpError } from "@/server/http";
import { getJob, outputPath } from "@/server/exports";

type P = { id: string; jobId: string };

/** Only serves a finished, verified render that really exists on disk. */
export const GET = route<P>(async (_req, { id, jobId }) => {
  const job = await getJob(id, jobId);
  if (job.status !== "done") throw new HttpError(409, "Export is not finished");
  const file = outputPath(job);
  const stat = await fsp.stat(file).catch(() => null);
  if (!stat?.isFile() || stat.size === 0) throw new HttpError(404, "Rendered file is missing");
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
    headers: { "Content-Type": "video/mp4", "Content-Length": String(stat.size), "Content-Disposition": `attachment; filename="${(job.filename ?? "video.mp4").replace(/"/g, "")}"`, "X-Content-Type-Options": "nosniff" },
  });
});
