import { requireUser } from "@/server/auth";
import { removeRsvp } from "@/server/guests";
import { ok, route } from "@/server/http";
import { getOwned } from "@/server/invitations";

export const DELETE = route(async (_req, { params }: { params: Promise<{ id: string; rid: string }> }) => {
  const user = await requireUser();
  const { id, rid } = await params;
  const inv = await getOwned(id, user.id);
  await removeRsvp(inv.id, rid);
  return ok();
});
