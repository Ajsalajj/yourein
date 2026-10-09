import { createSession, signUp } from "@/server/auth";
import { body, clientIp, ok, rateLimit, route } from "@/server/http";

export const POST = route(async (req) => {
  rateLimit(`signup:${clientIp(req)}`, 10, 10 * 60_000);
  const b = await body(req);
  const user = await signUp(b.email, b.password, b.name);
  await createSession(user.id);
  return ok({ user });
});
