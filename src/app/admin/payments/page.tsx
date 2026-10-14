import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";
import { listPayments, requireAdminPage, rupees, STATE_LABEL, when, type PaymentState } from "@/server/admin";
import { Pager } from "@/components/admin/Pager";
import { StateBadge } from "@/components/admin/StateBadge";

export const dynamic = "force-dynamic";

const STATES: (PaymentState | "all")[] = ["all", "paid", "failed", "pending", "partially_refunded", "refunded"];
type SP = { state?: string; q?: string; from?: string; to?: string; sim?: string; page?: string };

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const state = (STATES as string[]).includes(sp.state ?? "") ? (sp.state as PaymentState | "all") : "all";
  const f = { state, q: sp.q, from: sp.from, to: sp.to, includeSimulated: sp.sim === "1", page: Number(sp.page) || 1 };
  const { rows, total, page } = await listPayments(f);
  const params = { state: state === "all" ? undefined : state, q: sp.q, from: sp.from, to: sp.to, sim: sp.sim === "1" ? "1" : undefined };
  const exportQs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <AdminShell>
    <main>
      <div className="adm-head">
        <h1>Payments</h1>
        <a className="btn btn-quiet btn-sm" href={`/api/admin/payments/export${exportQs ? `?${exportQs}` : ""}`}>Download CSV</a>
      </div>

      <form className="adm-filters" method="get">
        <label>Status
          <select name="state" defaultValue={state}>{STATES.map((s) => <option key={s} value={s}>{s === "all" ? "All" : STATE_LABEL[s]}</option>)}</select>
        </label>
        <label>From<input type="date" name="from" defaultValue={sp.from ?? ""} /></label>
        <label>To<input type="date" name="to" defaultValue={sp.to ?? ""} /></label>
        <label className="adm-grow">Search<input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Email, name, invitation, order or payment id" /></label>
        <label className="adm-check"><input type="checkbox" name="sim" value="1" defaultChecked={sp.sim === "1"} /> Include simulated test payments</label>
        <button className="btn btn-solid btn-sm">Apply</button>
        <Link className="btn btn-quiet btn-sm" href="/admin/payments">Clear</Link>
      </form>

      {rows.length === 0 ? <p className="adm-empty">Nothing matches. Orders appear here when someone reaches the payment step.</p> : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>Created</th><th>Customer</th><th>Invitation</th><th>Amount</th><th>Status</th><th>Razorpay ids</th><th>Confirmed by</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.order_id}>
                  <td>{when(r.created_at)}{r.paid_at && <small>Paid {when(r.paid_at)}</small>}</td>
                  <td>{r.user_name || "—"}<small>{r.user_email}</small></td>
                  <td>
                    {r.invitation_title || "Untitled"}<small>{r.template_slug} · {r.invitation_status}</small>
                    {r.invitation_slug && (r.invitation_status === "published" || r.invitation_status === "archived") && <small><a href={`/i/${r.invitation_slug}`} target="_blank" rel="noopener noreferrer">Open invitation</a></small>}
                  </td>
                  <td>{rupees(r.amount)}{r.refunded > 0 && <small>{rupees(r.refunded)} refunded</small>}</td>
                  <td>
                    <StateBadge state={r.state} label={STATE_LABEL[r.state]} />
                    {r.state === "failed" && typeof r.payment_raw?.reason === "string" && <small>{r.payment_raw.reason}</small>}
                  </td>
                  <td className="adm-mono"><small>{r.provider_order_id}</small><small>{r.provider_payment_id ?? "no payment yet"}</small>{r.provider === "test" && <small>simulated</small>}</td>
                  <td>{(r.payment_raw?.source as string | undefined) ?? "—"}<small>{(r.payment_raw?.keyMode as string | undefined) ?? ""}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/payments" params={params} page={page} total={total} />
    </main>
    </AdminShell>
  );
}
