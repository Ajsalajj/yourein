import { AdminShell } from "@/components/admin/AdminShell";
import { listCustomers, requireAdminPage, rupees, when } from "@/server/admin";
import { Pager } from "@/components/admin/Pager";

export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string; sim?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const { rows, total, page } = await listCustomers(sp.q, Number(sp.page) || 1, sp.sim === "1");
  return (
    <AdminShell>
    <main>
      <div className="adm-head"><h1>Customers</h1></div>
      <p className="adm-sub">Everyone with an account, and what they have bought. YoureIn sells each invitation as a one-time purchase, so there are no recurring subscriptions to track.</p>
      <form className="adm-filters" method="get">
        <label className="adm-grow">Search<input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Name or email" /></label>
        <label className="adm-check"><input type="checkbox" name="sim" value="1" defaultChecked={sp.sim === "1"} /> Include simulated test payments</label>
        <button className="btn btn-solid btn-sm">Search</button>
      </form>
      {rows.length === 0 ? <p className="adm-empty">No customers match.</p> : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>Customer</th><th>Signed up</th><th>Invitations</th><th>Published</th><th>Paid in total</th><th>Last payment</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.name || "—"}<small>{r.email}{r.google ? " · Google" : ""}</small></td>
                  <td>{when(r.created_at)}</td>
                  <td>{r.invitations}</td>
                  <td>{r.published}</td>
                  <td>{rupees(r.paid_paise)}</td>
                  <td>{r.last_paid_at ? when(r.last_paid_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/customers" params={{ q: sp.q, sim: sp.sim === "1" ? "1" : undefined }} page={page} total={total} />
    </main>
    </AdminShell>
  );
}
