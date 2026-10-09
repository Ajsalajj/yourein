import { getMedia } from "@/server/invitations";

/** Serves an uploaded photo or audio file. Ids are unguessable and files never change, so they cache for a year. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const media = await getMedia((await params).id);
  if (!media) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mime,
      "Content-Length": String(media.bytes.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "none",
    },
  });
}
