import { cookies } from "next/headers";
import { appSecret } from "@/server/auth";
import { ADMIN_COOKIE, ADMIN_SESSION_MS, codeMatches, makeAdminToken } from "@/server/admin-access";
import { requireAdminApi } from "@/server/admin";
import { ApiError, body, clientIp, ok, rateLimit, route } from "@/server/http";

/** Step two of admin sign-in: a signed-in admin types the access code. Attempts are limited. */
export const POST = route(async (req) => {
  const user = await requireAdminApi({ allowLocked: true });
  rateLimit(`admin-unlock:${user.id}`, 8, 15 * 60_000);
  rateLimit(`admin-unlock-ip:${clientIp(req)}`, 20, 15 * 60_000);
  const b = await body(req);
  if (!codeMatches(b.code, process.env)) throw new ApiError(403, "That access code is not right.");
  (await cookies()).set(ADMIN_COOKIE, makeAdminToken(appSecret(), user.id), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(ADMIN_SESSION_MS / 1000),
  });
  return ok();
});
