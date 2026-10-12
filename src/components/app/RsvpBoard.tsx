"use client";

import { useMemo, useState } from "react";
import { api } from "./client";
import { useToast } from "./ShareTools";

export type RsvpView = {
  id: string; name: string; status: "yes" | "maybe" | "no"; count: number; phone: string; meal: string; message: string; updatedAt: string;
  events: Record<string, number>; answers: Record<string, string>;
};
export type StatsView = { listed: number; sent: number; invited: number; responses: number; confirmed: number; maybe: number; declined: number; attending: number; views: number };

const LABEL = { yes: "Confirmed", maybe: "Maybe", no: "Declined" } as const;
type Filter = "all" | "yes" | "maybe" | "no";

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

/** `functions`: shown with a head count each when replies are per function. `questions`: the host's own questions, shown on each reply. */
export function RsvpBoard({ id, initial, initialStats, capacity, published, functions = [], questions = [] }: {
  id: string; initial: RsvpView[]; initialStats: StatsView; capacity: number | null; published: boolean;
  functions?: { id: string; title: string }[]; questions?: { id: string; label: string }[];
}) {
  const [rows, setRows] = useState(initial);
  const [stats, setStats] = useState(initialStats);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState<RsvpView | null>(null);
  const { setToast, node } = useToast();

  const refresh = async () => {
    setRefreshing(true);
    try {
      const out = await api<{ rsvps: RsvpView[]; stats: StatsView }>("GET", `/api/invitations/${id}/rsvps`);
      setRows(out.rsvps);
      setStats(out.stats);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const remove = async (r: RsvpView) => {
    if (!window.confirm(`Delete the reply from ${r.name}? This cannot be undone.`)) return;
    try {
      await api("DELETE", `/api/invitations/${id}/rsvps/${r.id}`);
      setOpen(null);
      await refresh();
    } catch (e) {
      setToast((e as Error).message);
    }
  };

  const shown = useMemo(
    () => rows.filter((r) => (filter === "all" || r.status === filter) && (!query || `${r.name} ${r.phone} ${r.meal} ${r.message}`.toLowerCase().includes(query.toLowerCase()))),
    [rows, filter, query],
  );
  const fnTotals = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) for (const [k, n] of Object.entries(r.events ?? {})) out[k] = (out[k] ?? 0) + (Number(n) || 0);
    return out;
  }, [rows]);
  const extras = (r: RsvpView) => [
    ...functions.filter((f) => r.events?.[f.id]).map((f) => `${f.title}: ${r.events[f.id]}`),
    ...questions.filter((q) => r.answers?.[q.id]).map((q) => `${q.label} ${r.answers[q.id]}`),
  ];
  const filters: [Filter, string, number][] = [["all", "All", stats.responses], ["yes", "Confirmed", stats.confirmed], ["maybe", "Maybe", stats.maybe], ["no", "Declined", stats.declined]];

  return (
    <>
      <div className="tiles">
        <div className="tile tile-main">
          <b>{stats.attending}</b>
          <span>Total attending</span>
          {capacity ? (
            <>
              <div className="meter" role="img" aria-label={`${stats.attending} of ${capacity} places taken`}><i style={{ width: `${Math.min(100, (stats.attending / capacity) * 100)}%` }} /></div>
              <span>{stats.attending} / {capacity} confirmed attendees</span>
            </>
          ) : (
            <span>People coming, counting everyone on each “yes” reply</span>
          )}
        </div>
        <div className="tile"><b>{stats.sent}</b><span>Invitations sent{stats.listed ? ` · ${stats.listed} on your list` : ""}</span></div>
        <div className="tile"><b>{stats.responses}</b><span>Responses</span></div>
        <div className="tile"><b>{stats.confirmed}</b><span>Confirmed</span></div>
        <div className="tile"><b>{stats.maybe}</b><span>Maybe</span></div>
        <div className="tile"><b>{stats.declined}</b><span>Declined</span></div>
        <div className="tile"><b>{stats.invited}</b><span>Invited on your guest list</span></div>
        {functions.map((f) => <div key={f.id} className="tile"><b>{fnTotals[f.id] ?? 0}</b><span>Coming to {f.title}</span></div>)}
      </div>

      <div className="toolbar">
        <label className="search field">
          <span className="sr-only">Search replies</span>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, phone or message" />
        </label>
        <div className="chips">
          <button type="button" className="btn btn-quiet btn-sm" onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>
          <a className="btn btn-quiet btn-sm" href={`/api/invitations/${id}/rsvps/export`} aria-disabled={rows.length === 0}>Export CSV</a>
        </div>
      </div>
      <div className="chips" role="group" aria-label="Filter replies" style={{ marginBottom: 14 }}>
        {filters.map(([key, label, n]) => (
          <button key={key} type="button" className="chip" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} {n}</button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <h2>No replies yet</h2>
          <p>{published ? "Replies appear here as soon as guests answer. Share your link to get started." : "Replies appear here once your invitation is published and shared."}</p>
          <a className="btn btn-solid" href={published ? `/invites/${id}#share` : `/edit/${id}`}>{published ? "Share invitation" : "Continue editing"}</a>
        </div>
      ) : shown.length === 0 ? (
        <p className="muted">No replies match.</p>
      ) : (
        <>
          <div className="rows rows-as-table">
            {shown.map((r) => (
              <button key={r.id} type="button" className="row-card row-tap" onClick={() => setOpen(r)} aria-haspopup="dialog">
                <span className="row-head">
                  <span>
                    <span className="row-name">{r.name}</span>
                    <span className="row-sub">{r.status === "no" ? "Not coming" : `${r.count} ${r.count === 1 ? "guest" : "guests"}`} · {when(r.updatedAt)}</span>
                  </span>
                  <span className={`pill pill-${r.status}`}>{LABEL[r.status]}</span>
                </span>
              </button>
            ))}
          </div>
          <table className="table">
            <thead>
              <tr><th>Guest name</th><th>Status</th><th className="num">Guest count</th><th>Phone</th><th>Meal</th><th>Message</th><th>Response date</th><th><span className="sr-only">Actions</span></th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><b style={{ fontWeight: 500 }}>{r.name}</b></td>
                  <td><span className={`pill pill-${r.status}`}>{LABEL[r.status]}</span></td>
                  <td className="num">{r.count}</td>
                  <td>{r.phone}</td>
                  <td>{r.meal}</td>
                  <td className="msg">{[...extras(r), r.message].filter(Boolean).join(" · ")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{when(r.updatedAt)}</td>
                  <td><button type="button" className="btn btn-sm btn-danger" onClick={() => remove(r)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {open && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="rsvp-h" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2 id="rsvp-h">{open.name}</h2>
              <button type="button" className="modal-x" onClick={() => setOpen(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
            <dl className="detail-list">
              <div><dt>Reply</dt><dd><span className={`pill pill-${open.status}`}>{LABEL[open.status]}</span></dd></div>
              <div><dt>Guests</dt><dd>{open.count}</dd></div>
              {open.phone && <div><dt>Phone</dt><dd><a href={`tel:${open.phone.replace(/[^\d+]/g, "")}`}>{open.phone}</a></dd></div>}
              {open.meal && <div><dt>Meal</dt><dd>{open.meal}</dd></div>}
              {functions.filter((f) => open.events?.[f.id]).map((f) => <div key={f.id}><dt>{f.title}</dt><dd>{open.events[f.id]}</dd></div>)}
              {questions.filter((q) => open.answers?.[q.id]).map((q) => <div key={q.id}><dt>{q.label}</dt><dd>{open.answers[q.id]}</dd></div>)}
              <div><dt>Replied</dt><dd>{when(open.updatedAt)}</dd></div>
            </dl>
            {open.message && <p className="row-msg" style={{ marginTop: 12 }}>{open.message}</p>}
            <div className="modal-actions" style={{ gridTemplateColumns: "1fr", marginTop: 16 }}>
              <button type="button" className="btn btn-danger" onClick={() => remove(open)}>Delete reply</button>
            </div>
          </div>
        </div>
      )}
      {node}
    </>
  );
}
