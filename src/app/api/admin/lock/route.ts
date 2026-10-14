import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/server/admin-access";
import { ok, route } from "@/server/http";

/** Ends the admin session on this browser. Harmless to call when not unlocked. */
export const POST = route(async () => {
  (await cookies()).delete(ADMIN_COOKIE);
  return ok();
});
