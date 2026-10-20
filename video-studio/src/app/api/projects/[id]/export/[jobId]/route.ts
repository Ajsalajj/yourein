import { route } from "@/server/http";
import { cancelJob, getJob } from "@/server/exports";

type P = { id: string; jobId: string };
export const GET = route<P>(async (_req, { id, jobId }) => ({ job: await getJob(id, jobId) }));
export const DELETE = route<P>(async (_req, { id, jobId }) => ({ job: await cancelJob(id, jobId) }));
