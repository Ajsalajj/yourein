import { ApiError, body, clientIp, ok, rateLimit, route } from "@/server/http";
import { getPublished } from "@/server/invitations";
import { addWish, type WishInput } from "@/server/wishes";

/** Public: a guest leaves a wish on an invitation's guestbook. */
export const POST = route(async (req) => {
  rateLimit(`wish:${clientIp(req)}`, 30, 10 * 60_000);
  const b = await body<WishInput & { invitation?: unknown; guest?: unknown }>(req);
  const inv = await getPublished(String(b.invitation ?? ""));
  if (!inv) throw new ApiError(404, "This invitation could not be found.");
  const wish = await addWish(inv, typeof b.guest === "string" && b.guest ? b.guest : null, b);
  return ok({ wish });
});
