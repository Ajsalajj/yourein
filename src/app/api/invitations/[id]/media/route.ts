import { requireUser } from "@/server/auth";
import { ApiError, ok, route } from "@/server/http";
import { addMedia, type MediaKind } from "@/server/invitations";

/** Upload one photo or audio file. The body is the raw file; ?kind=portrait|gallery|music. */
export const POST = route(async (req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const kind = new URL(req.url).searchParams.get("kind") as MediaKind;
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > 4_300_000) throw new ApiError(413, "That file is too large.");
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (!bytes.byteLength) throw new ApiError(400, "The file was empty.");
  const out = await addMedia((await params).id, user.id, kind, bytes);
  return ok({ id: out.id, portrait: out.data.portrait, gallery: out.data.gallery, music: out.data.music }, 201);
});
