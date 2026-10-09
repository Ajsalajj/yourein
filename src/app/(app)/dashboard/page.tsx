import type { Metadata } from "next";
import { InviteCard } from "@/components/app/InviteCard";
import { requireUserPage } from "@/server/auth";
import { listForUser } from "@/server/invitations";

export const metadata: Metadata = { title: "Home" };

export default async function DashboardPage() {
  const user = await requireUserPage("/dashboard");
  const invites = await listForUser(user.id);
  const first = user.name.trim().split(/\s+/)[0];
  const live = invites.filter((i) => i.status === "published");
  const attending = live.reduce((n, i) => n + i.attending, 0);
  const responses = live.reduce((n, i) => n + i.responses, 0);
  return (
    <main className="app-main">
      <div className="page-head">
        <div>
          <h1 className="page-h">Hello{first ? `, ${first}` : ""}</h1>
          <p className="page-sub">
            {invites.length === 0 ? "Let’s make your first invitation." : live.length ? `${responses} ${responses === 1 ? "reply" : "replies"} so far, ${attending} ${attending === 1 ? "guest" : "guests"} attending.` : "Pick up where you left off."}
          </p>
        </div>
        <a className="btn btn-solid" href="/create">+ Create Invitation</a>
      </div>
      {invites.length === 0 ? (
        <div className="empty-state">
          <h2>No invitations yet</h2>
          <p>Choose a design, add your details and publish when you are ready. Customizing is free.</p>
          <a className="btn btn-solid" href="/create">Choose a design</a>
        </div>
      ) : (
        <>
          <div className="invite-list">{invites.slice(0, 4).map((inv) => <InviteCard key={inv.id} inv={inv} />)}</div>
          {invites.length > 4 && <p style={{ marginTop: 16 }}><a className="text-link" href="/invites">See all {invites.length} invitations</a></p>}
        </>
      )}
    </main>
  );
}
