import { createSession, signUp } from "@/server/auth";
import { body, clientIp, ok, rateLimit, route } from "@/server/http";
import { currentVisit, trackRegistration } from "@/server/meta/events";

export const POST = route(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 10 * 60_000);
  const b = await body(req);
  const user = await signUp(b.email, b.password, b.name);
  await createSession(user.id);
  /* only a real new account counts, never opening the sign-up form; null when there is no ads consent */
  const metaEventId = trackRegistration(user, await currentVisit());
  return ok({ user, metaEventId });
});
