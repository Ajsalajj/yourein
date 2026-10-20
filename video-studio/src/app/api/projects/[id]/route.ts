import { route } from "@/server/http";
import { deleteProject, readProject, writeProject } from "@/server/storage";
import { projectSchema } from "@/lib/project";
import { HttpError } from "@/server/http";

type P = { id: string };
export const GET = route<P>(async (_req, { id }) => ({ project: await readProject(id) }));

/** Full-document save (autosave). The server owns `updatedAt` and refuses to change identity or asset registry. */
export const PUT = route<P>(async (req, { id }) => {
  const incoming = projectSchema.parse(await req.json());
  if (incoming.id !== id) throw new HttpError(400, "Project id mismatch");
  const current = await readProject(id);
  // Assets are only created by the upload endpoint; the client may not invent or repoint them.
  for (const [aid, a] of Object.entries(incoming.assets)) {
    const known = current.assets[aid];
    if (!known || known.storageKey !== a.storageKey) throw new HttpError(400, `Unknown asset ${aid}`);
  }
  if (incoming.sourceAssetId && !current.assets[incoming.sourceAssetId]) throw new HttpError(400, "Unknown source asset");
  for (const f of incoming.fonts) if (current.assets[f.assetId]?.kind !== "font") throw new HttpError(400, `Font ${f.family} does not reference an uploaded font file`);
  const saved = await writeProject({ ...incoming, assets: current.assets, createdAt: current.createdAt, transcript: current.transcript ?? incoming.transcript, analysis: current.analysis });
  return { project: saved };
});

export const DELETE = route<P>(async (_req, { id }) => {
  await deleteProject(id);
  return { ok: true };
});
