import { requireUser } from "@/server/auth";
import { body, ok, route } from "@/server/http";
import { getOwned } from "@/server/invitations";
import { removeWish, setWishHidden } from "@/server/wishes";

type Ctx = { params: Promise<{ id: string; wid: string }> };

/** Hide a wish from guests, or show it again. */
export const PATCH = route(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const { id, wid } = await params;
  const inv = await getOwned(id, user.id);
  const b = await body<{ hidden?: unknown }>(req);
  return ok({ wish: await setWishHidden(inv.id, wid, b.hidden === true) });
});

export const DELETE = route(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const { id, wid } = await params;
  const inv = await getOwned(id, user.id);
  await removeWish(inv.id, wid);
  return ok();
});
