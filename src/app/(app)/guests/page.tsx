import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StatusPill } from "@/components/app/InviteCard";
import { requireUserPage } from "@/server/auth";
import { listForUser } from "@/server/invitations";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsHub() {
  const user = await requireUserPage("/guests");
  const invites = await listForUser(user.id);
  if (invites.length === 1) redirect(`/invites/${invites[0].id}/rsvps`);
  return (
    <main className="app-main">
      <div className="page-head">
        <div>
          <h1 className="page-h">Guests</h1>
          <p className="page-sub">{invites.length ? "Choose an invitation to see its guest list and replies." : "Your guest lists and replies will appear here."}</p>
        </div>
      </div>
      {invites.length === 0 ? (
        <div className="empty-state">
          <h2>No invitations yet</h2>
          <p>Create an invitation first. Then add guests and watch replies come in.</p>
          <a className="btn btn-solid" href="/create">Choose a design</a>
        </div>
      ) : (
        <div className="rows">
          {invites.map((inv) => (
            <article key={inv.id} className="row-card">
              <div className="row-head">
                <div>
                  <p className="row-name">{inv.title || "Untitled invitation"}</p>
                  <p className="row-sub">{inv.eventType}</p>
                </div>
                <StatusPill status={inv.status} />
              </div>
              <p className="row-facts">
                <span><b>{inv.guests}</b> on guest list</span>
                <span><b>{inv.responses}</b> {inv.responses === 1 ? "reply" : "replies"}</span>
                <span><b>{inv.attending}</b> attending</span>
              </p>
              <div className="row-actions">
                <a className="btn btn-solid" href={`/invites/${inv.id}/rsvps`}>View RSVPs</a>
                <a className="btn btn-quiet" href={`/invites/${inv.id}/guests`}>Guest list</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
