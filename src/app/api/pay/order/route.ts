import { requireUser } from "@/server/auth";
import { body, ok, rateLimit, route } from "@/server/http";
import { createOrder } from "@/server/payments";

export const POST = route(async (req) => {
  const user = await requireUser();
  rateLimit(`order:${user.id}`, 20, 10 * 60_000);
  const b = await body(req);
  return ok(await createOrder(user, String(b.invitationId ?? "")));
});
