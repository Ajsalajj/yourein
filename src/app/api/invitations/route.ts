import { requireUser } from "@/server/auth";
import { sql } from "@/server/db";
import { body, ok, route } from "@/server/http";
import { createInvitation } from "@/server/invitations";

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  const template = String(b.template ?? "");
  if (b.reuse) {
    /* tapping Customize twice should not pile up empty drafts */
    const blank = await sql<{ id: string }>`select id from invitations where user_id = ${user.id} and template_slug = ${template} and status = 'draft' and title = '' and created_at = updated_at order by created_at desc limit 1`;
    if (blank[0]) return ok({ id: blank[0].id });
  }
  const inv = await createInvitation(user.id, template, typeof b.tz === "string" ? b.tz : undefined);
  return ok({ id: inv.id }, 201);
});
