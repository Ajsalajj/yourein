import { guestBySlug } from "@/server/guests";
import { body, clientIp, ok, rateLimit, route } from "@/server/http";
import { getPublished, recordView } from "@/server/invitations";

const TYPES = new Set(["view", "open", "directions", "share", "calendar"]);

/** Public: counts views and taps on a published invitation. No personal data is stored. */
export const POST = route(async (req) => {
  rateLimit(`track:${clientIp(req)}`, 120, 10 * 60_000);
  const b = await body(req);
  const type = String(b.type ?? "");
  const inv = await getPublished(String(b.invitation ?? ""));
  if (!inv || inv.status !== "published" || !TYPES.has(type)) return ok();
  const guest = typeof b.guest === "string" && b.guest ? await guestBySlug(inv.id, b.guest) : null;
  await recordView(inv.id, guest?.id ?? null, type);
  return ok();
});
