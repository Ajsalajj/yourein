import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StatusPill } from "@/components/app/InviteCard";
import { InviteSubnav } from "@/components/app/ManageParts";
import { RsvpBoard, type RsvpView } from "@/components/app/RsvpBoard";
import { namesOf, visibleEvents } from "@/lib/invite";
import { requireUserPage } from "@/server/auth";
import { listRsvps, statsFor } from "@/server/guests";
import { ApiError } from "@/server/http";
import { getOwned } from "@/server/invitations";

export const metadata: Metadata = { title: "RSVPs" };

export default async function RsvpsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUserPage(`/invites/${id}/rsvps`);
  const inv = await getOwned(id, user.id).catch((e) => {
    if (e instanceof ApiError) notFound();
    throw e;
  });
  const rows = (await listRsvps(inv.id)).map((r): RsvpView => ({ id: r.id, name: r.name, status: r.status, count: r.count, phone: r.phone, meal: r.meal, message: r.message, updatedAt: r.updatedAt.toISOString(), events: r.events, answers: r.answers }));
  const functions = inv.data.rsvp.perEvent ? visibleEvents(inv.data, null).map((e) => ({ id: e.id, title: e.title })) : [];
  const questions = inv.data.rsvp.questions.filter((q) => q.label).map((q) => ({ id: q.id, label: q.label }));
  const names = namesOf(inv.data) || "Untitled invitation";
  return (
    <main className="app-main app-wide">
      <a className="back-link" href={`/invites/${inv.id}`}>← {names}</a>
      <div className="page-head">
        <div>
          <h1 className="page-h">RSVPs</h1>
          <p className="page-sub">{names} <StatusPill status={inv.status} /></p>
        </div>
      </div>
      <InviteSubnav id={inv.id} current="rsvps" />
      {!inv.data.rsvp.enabled && <p className="notice" style={{ marginBottom: 14 }}>RSVPs are switched off for this invitation. <a className="text-link" href={`/edit/${inv.id}?step=rsvp`}>Turn them on</a></p>}
      <RsvpBoard id={inv.id} initial={rows} initialStats={await statsFor(inv.id)} capacity={inv.data.rsvp.capacity} published={inv.status === "published"} functions={functions} questions={questions} />
    </main>
  );
}
