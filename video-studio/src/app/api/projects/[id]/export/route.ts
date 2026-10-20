import { z } from "zod";
import { route } from "@/server/http";
import { listJobs, startExport } from "@/server/exports";

type P = { id: string };
export const GET = route<P>(async (_req, { id }) => ({ jobs: await listJobs(id) }));
export const POST = route<P>(async (req, { id }) => {
  const body = z.object({ quality: z.enum(["standard", "high"]).default("standard") }).parse(await req.json().catch(() => ({})));
  return { job: await startExport(id, body) };
});
