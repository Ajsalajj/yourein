import { createSession, finishPasswordReset } from "@/server/auth";
import { body, clientIp, ok, rateLimit, route } from "@/server/http";

export const POST = route(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60_000);
  const b = await body(req);
  const userId = await finishPasswordReset(b.token, b.password);
  await createSession(userId);
  return ok();
});
