import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";
import { adminDatabaseKind, listPayments, overview, requireAdminPage, rupees, STATE_LABEL, when } from "@/server/admin";
import { paymentMode, razorpayKeyMode } from "@/server/payments";
import { setupChecks } from "@/server/payments/status";
import { PRICE } from "@/config/site";
import { StateBadge } from "@/components/admin/StateBadge";

export const dynamic = "force-dynamic";

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ sim?: string }> }) {
  await requireAdminPage();
  const sim = (await searchParams).sim === "1";
  const [o, recent, dbKind] = await Promise.all([overview(sim), listPayments({ includeSimulated: sim }), adminDatabaseKind()]);
  const checks = setupChecks(process.env, { price: PRICE, databaseKind: dbKind, origin: "", production: process.env.NODE_ENV === "production" });
  const bad = checks.filter((c) => c.state === "bad");
  const warn = checks.filter((c) => c.state === "warn");
  const max = Math.max(1, ...o.days.map((d) => d.paise));
  const mode = paymentMode();

  return (
    <AdminShell>
    <main>
      <div className="adm-head">
        <h1>Overview</h1>
        <Link className="btn btn-quiet btn-sm" href={sim ? "/admin" : "/admin?sim=1"}>{sim ? "Hide simulated test payments" : `Include simulated test payments${o.simulatedPayments ? ` (${o.simulatedPayments})` : ""}`}</Link>
      </div>

      {(bad.length > 0 || warn.length > 0) && (
        <Link href="/admin/setup" className={`adm-banner ${bad.length ? "is-bad" : "is-warn"}`}>
          <b>{bad.length ? `${bad.length} thing${bad.length > 1 ? "s" : ""} to fix before taking payments` : `${warn.length} thing${warn.length > 1 ? "s" : ""} to check`}</b>
          <span>{(bad[0] ?? warn[0]).detail}</span>
          <span className="adm-more">Open setup →</span>
        </Link>
      )}
      {razorpayKeyMode() === "test" && <p className="adm-note-test" role="status"><b>Razorpay TEST keys are in use.</b> The figures below come from test payments, not real money.</p>}
      <p className="adm-sub">
        Payment mode: <b>{mode === "razorpay" ? "Razorpay" : mode === "test" ? "Simulated (no money moves)" : "Off"}</b> · Price {rupees(PRICE * 100)} per invitation
      </p>

      <section className="adm-cards" aria-label="Revenue">
        <div className="adm-card is-key"><small>Net revenue</small><b>{rupees(o.netPaise)}</b><span>{rupees(o.grossPaise)} taken, {rupees(o.refundedPaise)} refunded</span></div>
        <div className="adm-card"><small>Last 24 hours</small><b>{rupees(o.today)}</b></div>
        <div className="adm-card"><small>Last 7 days</small><b>{rupees(o.last7)}</b></div>
        <div className="adm-card"><small>Last 30 days</small><b>{rupees(o.last30)}</b></div>
      </section>

      <section className="adm-cards" aria-label="Orders">
        <Link className="adm-card" href="/admin/payments?state=paid"><small>Paid</small><b>{o.paid}</b></Link>
        <Link className="adm-card" href="/admin/payments?state=failed"><small>Failed</small><b>{o.failed}</b></Link>
        <Link className="adm-card" href="/admin/payments?state=pending"><small>Not completed</small><b>{o.pending}</b><span>Started checkout, did not pay</span></Link>
        <Link className="adm-card" href="/admin/payments?state=refunded"><small>Refunded</small><b>{o.refunded}</b></Link>
      </section>

      <section className="adm-panel" aria-label="Revenue by day">
        <h2>Last 30 days</h2>
        <div className="adm-bars" role="img" aria-label={`Daily revenue for the last 30 days, highest ${rupees(max)}`}>
          {o.days.map((d) => (
            <div key={d.day} className="adm-bar" title={`${d.day}: ${rupees(d.paise)}`}>
              <i style={{ height: `${Math.max(d.paise ? 4 : 0, Math.round((d.paise / max) * 100))}%` }} />
            </div>
          ))}
        </div>
        <p className="adm-axis"><span>{o.days[0]?.day}</span><span>{o.days.at(-1)?.day}</span></p>
      </section>

      <section className="adm-cards" aria-label="Customers and invitations">
        <Link className="adm-card" href="/admin/customers"><small>Customers</small><b>{o.customers}</b></Link>
        <Link className="adm-card" href="/admin/invitations?status=published"><small>Published invitations</small><b>{(o.invitations.published ?? 0) + (o.invitations.archived ?? 0)}</b></Link>
        <Link className="adm-card" href="/admin/invitations?status=ready"><small>Ready to pay</small><b>{o.invitations.ready ?? 0}</b></Link>
        <Link className="adm-card" href="/admin/invitations?status=draft"><small>Drafts</small><b>{o.invitations.draft ?? 0}</b></Link>
      </section>

      <section className="adm-panel">
        <div className="adm-head"><h2>Latest orders</h2><Link href="/admin/payments">See all →</Link></div>
        {recent.rows.length === 0 ? <p className="adm-empty">No orders yet. They appear here as soon as someone reaches the payment step.</p> : (
          <div className="adm-scroll">
            <table className="adm-table">
              <thead><tr><th>When</th><th>Customer</th><th>Invitation</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {recent.rows.slice(0, 8).map((r) => (
                  <tr key={r.order_id}>
                    <td>{when(r.created_at)}</td>
                    <td>{r.user_name || "—"}<small>{r.user_email}</small></td>
                    <td>{r.invitation_title || "Untitled"}<small>{r.template_slug}</small></td>
                    <td>{rupees(r.amount)}</td>
                    <td><StateBadge state={r.state} label={STATE_LABEL[r.state]} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="adm-note">Last confirmed payment: {when(o.lastPaidAt)} · Last payment confirmed by webhook: {when(o.lastWebhookAt)}</p>
      </section>
    </main>
    </AdminShell>
  );
}
