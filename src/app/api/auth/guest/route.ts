import { getUser, startGuest } from "@/server/auth";
import { clientIp, ok, rateLimit, route } from "@/server/http";

/** Starts a guest session so a signed-out visitor can customize a design. Does nothing if already signed in. */
export const POST = route(async (req) => {
  if (await getUser()) return ok();
  rateLimit(`guest:${clientIp(req)}`, 20, 10 * 60_000);
  await startGuest();
  return ok();
});
