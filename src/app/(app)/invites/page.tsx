import type { Metadata } from "next";
import { InviteCard } from "@/components/app/InviteCard";
import { requireUserPage } from "@/server/auth";
import { listForUser } from "@/server/invitations";

export const metadata: Metadata = { title: "Invites" };

export default async function InvitesPage() {
  const user = await requireUserPage("/invites");
  const invites = await listForUser(user.id);
  return (
    <main className="app-main">
      <div className="page-head">
        <div>
          <h1 className="page-h">Your invitations</h1>
          <p className="page-sub">{invites.length === 0 ? "Nothing here yet." : `${invites.length} in total. Drafts stay here until you publish them.`}</p>
        </div>
        <a className="btn btn-solid" href="/create">+ Create Invitation</a>
      </div>
      {invites.length === 0 ? (
        <div className="empty-state">
          <h2>No invitations yet</h2>
          <p>Choose a design to begin. You only pay when you publish.</p>
          <a className="btn btn-solid" href="/create">Choose a design</a>
        </div>
      ) : (
        <div className="invite-list">{invites.map((inv) => <InviteCard key={inv.id} inv={inv} />)}</div>
      )}
    </main>
  );
}
