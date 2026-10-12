import { requireUser } from "@/server/auth";
import { ok, route } from "@/server/http";
import { getOwned } from "@/server/invitations";
import { listWishes } from "@/server/wishes";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const inv = await getOwned((await params).id, user.id);
  return ok({ wishes: await listWishes(inv.id) });
});
