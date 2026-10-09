import { requireUser } from "@/server/auth";
import { body, ok, route } from "@/server/http";
import { deleteInvitation, getOwned, updateInvitation, type Patch } from "@/server/invitations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  return ok({ invitation: await getOwned((await params).id, user.id) });
});

export const PATCH = route(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const b = await body<Patch>(req);
  const inv = await updateInvitation((await params).id, user.id, { data: b.data, templateSlug: b.templateSlug, markReady: b.markReady, archived: b.archived });
  return ok({ status: inv.status, updatedAt: inv.updatedAt, templateSlug: inv.templateSlug });
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  await deleteInvitation((await params).id, user.id);
  return ok();
});
