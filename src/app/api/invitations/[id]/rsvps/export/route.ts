import { requireUser } from "@/server/auth";
import { listRsvps, rsvpsToCsv } from "@/server/guests";
import { route } from "@/server/http";
import { getOwned } from "@/server/invitations";

export const GET = route(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const inv = await getOwned((await params).id, user.id);
  const name = (inv.slug || "invitation").replace(/[^a-z0-9-]/g, "");
  return new Response(rsvpsToCsv(await listRsvps(inv.id), inv.data), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${name}-rsvps.csv"`, "Cache-Control": "no-store" },
  });
});
