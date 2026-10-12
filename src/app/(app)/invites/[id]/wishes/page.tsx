import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/app/InviteCard";
import { InviteSubnav } from "@/components/app/ManageParts";
import { WishBoard, type WishView } from "@/components/app/WishBoard";
import { namesOf } from "@/lib/invite";
import { requireUserPage } from "@/server/auth";
import { ApiError } from "@/server/http";
import { getOwned } from "@/server/invitations";
import { listWishes } from "@/server/wishes";

export const metadata: Metadata = { title: "Wishes" };

export default async function WishesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/invites/${id}/wishes`);
  const inv = await getOwned(id, user.id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  const rows = (await listWishes(inv.id)).map((w): WishView => ({ id: w.id, name: w.name, message: w.message, hidden: w.hidden, createdAt: w.createdAt, photo: w.photo }));
  const names = namesOf(inv.data) || "Untitled invitation";
  return (
    <main className="app-main">
      <a className="back-link" href={`/invites/${inv.id}`}>← {names}</a>
      <div className="page-head">
        <div>
          <h1 className="page-h">Wishes</h1>
          <p className="page-sub">{names} <StatusPill status={inv.status} /></p>
        </div>
      </div>
      <InviteSubnav id={inv.id} current="wishes" />
      {!inv.data.guestbook && rows.length > 0 && <p className="notice" style={{ marginBottom: 14 }}>The guestbook is switched off, so guests cannot see or add wishes. <a className="text-link" href={`/edit/${inv.id}?step=design`}>Turn it on</a></p>}
      <WishBoard id={inv.id} initial={rows} enabled={inv.data.guestbook} published={inv.status === "published"} />
    </main>
  );
}
