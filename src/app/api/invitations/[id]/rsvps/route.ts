import { requireUser } from "@/server/auth";
import { listRsvps, statsFor } from "@/server/guests";
import { ok, route } from "@/server/http";
import { getOwned } from "@/server/invitations";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const inv = await getOwned((await params).id, user.id);
  return ok({ rsvps: await listRsvps(inv.id), stats: await statsFor(inv.id) });
});
