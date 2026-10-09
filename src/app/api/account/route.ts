import { checkPassword, hashPassword, requireUser, verifyPassword } from "@/server/auth";
import { sql } from "@/server/db";
import { ApiError, body, ok, route } from "@/server/http";

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  if (typeof b.name === "string") {
    await sql`update users set name = ${b.name.trim().slice(0, 80)} where id = ${user.id}`;
  }
  if (b.newPassword !== undefined) {
    const next = checkPassword(b.newPassword);
    if (user.hasPassword) {
      const row = (await sql<{ password_hash: string | null }>`select password_hash from users where id = ${user.id}`)[0];
      if (!(await verifyPassword(String(b.currentPassword ?? ""), row?.password_hash ?? null))) throw new ApiError(400, "Your current password is not right.");
    }
    await sql`update users set password_hash = ${await hashPassword(next)} where id = ${user.id}`;
  }
  return ok();
});
