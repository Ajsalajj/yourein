import { destroySession } from "@/server/auth";
import { ok, route } from "@/server/http";

export const POST = route(async () => {
  await destroySession();
  return ok();
});
