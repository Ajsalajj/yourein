import { requireUser } from "@/server/auth";
import { addGuest, listGuests, type GuestInput } from "@/server/guests";
import { body, ok, route } from "@/server/http";
import { getOwned } from "@/server/invitations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_req, { params }: Ctx) => {
  const user = await requireUser();
  const inv = await getOwned((await params).id, user.id);
  return ok({ guests: await listGuests(inv.id) });
});

export const POST = route(async (req, { params }: Ctx) => {
  const user = await requireUser();
  const inv = await getOwned((await params).id, user.id);
  return ok({ guest: await addGuest(inv.id, await body<GuestInput>(req)) }, 201);
});
