import { z } from "zod";
import { route } from "@/server/http";
import { createProject, listProjects } from "@/server/storage";
import { aspectIdSchema } from "@/lib/project";

export const GET = route(async () => ({ projects: await listProjects() }));

export const POST = route(async (req) => {
  const body = z.object({ name: z.string().trim().min(1).max(120).default("Untitled project"), aspect: aspectIdSchema.optional() }).parse(await req.json().catch(() => ({})));
  return { project: await createProject(body.name, body.aspect) };
});
