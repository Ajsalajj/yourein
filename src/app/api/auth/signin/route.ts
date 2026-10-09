import { createSession, signIn } from "@/server/auth";
import { body, clientIp, ok, rateLimit, route } from "@/server/http";

export const POST = route(async (req) => {
  rateLimit(`signin:${clientIp(req)}`, 30, 10 * 60_000);
  const b = await body(req);
  const user = await signIn(b.email, b.password);
  await createSession(user.id);
  return ok({ user });
});
