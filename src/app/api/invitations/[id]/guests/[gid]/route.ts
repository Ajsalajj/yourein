import { requireUser } from "@/server/auth";
import { removeGuest, updateGuest, type GuestInput } from "@/server/guests";
import { body, ok, route } from "@/server/http";
import { getOwned } from "@/server/invitations";

type Ctx = { params: Promise<{ id: string; gid: string }> };

export const PATCH = route(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const { id, gid } = await params;
  const inv = await getOwned(id, user.id);
  return ok({ guest: await updateGuest(inv.id, gid, await body<GuestInput>(req)) });
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { id, gid } = await params;
  const inv = await getOwned(id, user.id);
  await removeGuest(inv.id, gid);
  return ok();
});
