import type { Metadata } from "next";
import { Greeting } from "@/components/app/Greeting";
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
          <h1 className="page-h"><Greeting name={first} /></h1>
          <p className="page-sub">
            {invites.length === 0 ? "Let’s make your first invitation." : live.length ? `${responses} ${responses === 1 ? "reply" : "replies"} so far, ${attending} ${attending === 1 ? "guest" : "guests"} attending.` : "Pick up where you left off."}
          </p>
        </div>
      </div>
      <a className="create-card" href="/create">
        <span className="create-card-text">
          <b>Create a new invitation</b>
          <small>Choose a design and personalize it in minutes.</small>
        </span>
        <span className="create-card-go">Create</span>
      </a>
      {invites.length > 0 && <h2 className="section-h">My invitations</h2>}
      {invites.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 16 }}>
          <h2>No invitations yet</h2>
          <p>Create your first one. Customizing is free; you only pay when you publish.</p>
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
