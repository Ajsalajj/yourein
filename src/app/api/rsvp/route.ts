import { submitRsvp, type RsvpInput } from "@/server/guests";
import { ApiError, body, clientIp, ok, rateLimit, route } from "@/server/http";
import { getPublished, recordView } from "@/server/invitations";

/** Public: a guest replies to an invitation. Returns nothing about other guests. */
export const POST = route(async (req) => {
  // generous: mobile carriers put many guests behind one address
  rateLimit(`rsvp:${clientIp(req)}`, 150, 10 * 60_000);
  const b = await body<RsvpInput & { invitation?: unknown; guest?: unknown }>(req);
  const inv = await getPublished(String(b.invitation ?? ""));
  if (!inv) throw new ApiError(404, "This invitation could not be found.");
  const out = await submitRsvp(inv, typeof b.guest === "string" && b.guest ? b.guest : null, b);
  await recordView(inv.id, null, "rsvp").catch(() => {});
  return ok(out);
});
