import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GuestManager, type GuestView } from "@/components/app/GuestManager";
import { StatusPill } from "@/components/app/InviteCard";
import { InviteSubnav } from "@/components/app/ManageParts";
import { formatDate, namesOf, slugify } from "@/lib/invite";
import { requireUserPage } from "@/server/auth";
import { listGuests } from "@/server/guests";
import { ApiError } from "@/server/http";
import { getOwned } from "@/server/invitations";
import { siteOrigin } from "@/server/origin";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/invites/${id}/guests`);
  const inv = await getOwned(id, user.id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  const guests = (await listGuests(inv.id)).map((g): GuestView => ({ ...g, sentAt: g.sentAt ? g.sentAt.toISOString() : null }));
  const names = namesOf(inv.data) || "Untitled invitation";
  const published = inv.status === "published";
  const baseUrl = `${await siteOrigin()}/i/${inv.slug ?? slugify(namesOf(inv.data))}`;
  return (
    <main className="app-main">
      <a className="back-link" href={`/invites/${inv.id}`}>← {names}</a>
      <div className="page-head">
        <div>
          <h1 className="page-h">Guests</h1>
          <p className="page-sub">{names} <StatusPill status={inv.status} /></p>
        </div>
      </div>
      <InviteSubnav id={inv.id} current="guests" />
      <GuestManager id={inv.id} initial={guests} baseUrl={baseUrl} published={published} names={names} dateLabel={formatDate(inv.data.date)} defaultMax={inv.data.rsvp.maxPerInvite} privateEvents={inv.data.events.filter((e) => e.private && e.title).map((e) => ({ id: e.id, title: e.title }))} />
    </main>
  );
}
