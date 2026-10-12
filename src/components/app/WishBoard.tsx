"use client";

import { useState } from "react";
import { api } from "./client";
import { useToast } from "./ShareTools";

export type WishView = { id: string; name: string; message: string; hidden: boolean; createdAt: string };

const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function WishBoard({ id, initial, enabled, published }: { id: string; initial: WishView[]; enabled: boolean; published: boolean }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { setToast, node } = useToast();

  const refresh = async () => {
    setRefreshing(true);
    try {
      setRows((await api<{ wishes: WishView[] }>("GET", `/api/invitations/${id}/wishes`)).wishes);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const toggle = async (w: WishView) => {
    setBusy(w.id);
    try {
      const out = await api<{ wish: WishView }>("PATCH", `/api/invitations/${id}/wishes/${w.id}`, { hidden: !w.hidden });
      setRows((list) => list.map((x) => (x.id === w.id ? { ...x, hidden: out.wish.hidden } : x)));
      setToast(out.wish.hidden ? "Hidden from guests" : "Shown to guests again");
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const remove = async (w: WishView) => {
    if (!window.confirm(`Delete the wish from ${w.name}? This cannot be undone.`)) return;
    setBusy(w.id);
    try {
      await api("DELETE", `/api/invitations/${id}/wishes/${w.id}`);
      setRows((list) => list.filter((x) => x.id !== w.id));
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const hidden = rows.filter((w) => w.hidden).length;

  return (
    <>
      <div className="tiles">
        <div className="tile"><b>{rows.length}</b><span>Wishes</span></div>
        <div className="tile"><b>{rows.length - hidden}</b><span>Shown to guests</span></div>
        <div className="tile"><b>{hidden}</b><span>Hidden</span></div>
      </div>

      <div className="toolbar">
        <p className="hint" style={{ margin: 0 }}>Wishes appear on the invitation as soon as guests send them. Hide any you would rather guests did not see.</p>
        <div className="chips">
          <button type="button" className="btn btn-quiet btn-sm" onClick={refresh} disabled={refreshing}>{refreshing ? "Refreshing…" : "Refresh"}</button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <h2>No wishes yet</h2>
          <p>{!enabled ? "Switch on the guestbook and guests can leave wishes on your invitation." : published ? "Wishes appear here as soon as guests leave them." : "Wishes appear here once your invitation is published and shared."}</p>
          <a className="btn btn-solid" href={!enabled ? `/edit/${id}?step=design` : published ? `/invites/${id}#share` : `/edit/${id}`}>{!enabled ? "Turn on the guestbook" : published ? "Share invitation" : "Continue editing"}</a>
        </div>
      ) : (
        <div className="rows">
          {rows.map((w) => (
            <article key={w.id} className="row-card" style={w.hidden ? { opacity: 0.7 } : undefined}>
              <div className="row-head">
                <div>
                  <p className="row-name">{w.name}</p>
                  <p className="row-sub">{when(w.createdAt)}</p>
                </div>
                <span className={`pill ${w.hidden ? "pill-none" : "pill-yes"}`}>{w.hidden ? "Hidden" : "Shown"}</span>
              </div>
              <p className="row-msg" style={{ whiteSpace: "pre-line" }}>{w.message}</p>
              <div className="row-actions chips">
                <button type="button" className="btn btn-quiet btn-sm" disabled={busy === w.id} onClick={() => toggle(w)}>{w.hidden ? "Show to guests" : "Hide from guests"}</button>
                <button type="button" className="btn btn-sm btn-danger" disabled={busy === w.id} onClick={() => remove(w)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
      {node}
    </>
  );
}
