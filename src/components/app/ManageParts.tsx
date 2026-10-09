"use client";

import { useState } from "react";
import { api } from "./client";

export function InviteSubnav({ id, current }: { id: string; current: "overview" | "guests" | "rsvps" }) {
  const items: [typeof current, string, string][] = [["overview", "Overview", `/invites/${id}`], ["guests", "Guests", `/invites/${id}/guests`], ["rsvps", "RSVPs", `/invites/${id}/rsvps`]];
  return (
    <nav className="subnav" aria-label="This invitation">
      {items.map(([key, label, href]) => <a key={key} href={href} aria-current={key === current ? "page" : undefined}>{label}</a>)}
    </nav>
  );
}

/** Hide or show a published invitation, or delete a draft. */
export function VisibilityControls({ id, status }: { id: string; status: "draft" | "ready" | "published" | "archived" }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const run = async (fn: () => Promise<unknown>, then: () => void) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      then();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  if (status === "published" || status === "archived") {
    const hidden = status === "archived";
    return (
      <div className="sheet">
        <p><b>{hidden ? "This invitation is hidden." : "Hide this invitation"}</b></p>
        <p className="hint" style={{ margin: "4px 0 12px" }}>{hidden ? "Guests who open the link see a note that it is no longer available. Replies are kept." : "Guests who open the link will see that it is no longer available. You can show it again at any time."}</p>
        <button type="button" className="btn btn-quiet btn-sm" disabled={busy} onClick={() => run(() => api("PATCH", `/api/invitations/${id}`, { archived: !hidden }), () => window.location.reload())}>
          {hidden ? "Show it again" : "Hide invitation"}
        </button>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    );
  }
  return (
    <div className="sheet">
      <p><b>Delete this draft</b></p>
      <p className="hint" style={{ margin: "4px 0 12px" }}>This removes the draft and anything uploaded to it. It cannot be undone.</p>
      {confirming ? (
        <div className="chips">
          <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => run(() => api("DELETE", `/api/invitations/${id}`), () => window.location.assign("/invites"))}>Yes, delete it</button>
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(false)}>Keep it</button>
        </div>
      ) : (
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => setConfirming(true)}>Delete draft</button>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
