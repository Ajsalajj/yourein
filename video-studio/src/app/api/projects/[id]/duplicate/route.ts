import { route } from "@/server/http";
import { duplicateProject } from "@/server/storage";

export const POST = route<{ id: string }>(async (_req, { id }) => ({ project: await duplicateProject(id) }));
