import { AdminShell } from "@/components/admin/AdminShell";
import Link from "next/link";
import { listInvitations, requireAdminPage, rupees, when } from "@/server/admin";
import { Pager } from "@/components/admin/Pager";

export const dynamic = "force-dynamic";

const STATUSES = ["all", "draft", "ready", "published", "archived"];
const LABEL: Record<string, string> = { all: "All", draft: "Draft", ready: "Ready to pay", published: "Published", archived: "Hidden by host" };

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireAdminPage();
  const sp = await searchParams;
  const status = STATUSES.includes(sp.status ?? "") ? sp.status! : "all";
  const { rows, total, page } = await listInvitations(status === "all" ? undefined : status, sp.q, Number(sp.page) || 1);
  return (
    <AdminShell>
    <main>
      <div className="adm-head"><h1>Invitations</h1></div>
      <p className="adm-sub">Counts only. Guest names and replies are never shown here.</p>
      <form className="adm-filters" method="get">
        <label>Status<select name="status" defaultValue={status}>{STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</select></label>
        <label className="adm-grow">Search<input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Title, name or email" /></label>
        <button className="btn btn-solid btn-sm">Apply</button>
        <Link className="btn btn-quiet btn-sm" href="/admin/invitations">Clear</Link>
      </form>
      {rows.length === 0 ? <p className="adm-empty">No invitations match.</p> : (
        <div className="adm-scroll">
          <table className="adm-table">
            <thead><tr><th>Invitation</th><th>Owner</th><th>Status</th><th>Created</th><th>Published</th><th>Views</th><th>Replies</th><th>Paid</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.title || "Untitled"}<small>{r.template_slug}</small>{r.slug && (r.status === "published" || r.status === "archived") && <small><a href={`/i/${r.slug}`} target="_blank" rel="noopener noreferrer">Open invitation</a></small>}</td>
                  <td>{r.owner_name || "—"}<small>{r.owner_email}</small></td>
                  <td>{LABEL[r.status] ?? r.status}</td>
                  <td>{when(r.created_at)}</td>
                  <td>{r.published_at ? when(r.published_at) : "—"}</td>
                  <td>{r.views}</td>
                  <td>{r.replies}</td>
                  <td>{r.paid_paise ? rupees(r.paid_paise) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager base="/admin/invitations" params={{ status: status === "all" ? undefined : status, q: sp.q }} page={page} total={total} />
    </main>
    </AdminShell>
  );
}
