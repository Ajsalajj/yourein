"use client";

import { useState } from "react";
import { shareText, whatsappShare } from "@/lib/share";
import { api, copyText } from "./client";
import { LinkBox, useToast } from "./ShareTools";

export type GuestView = {
  id: string; slug: string; name: string; phone: string; email: string; group: string; invited: number; max: number | null; note: string;
  privateEvents: string[];
  disabled: boolean;
  sentAt: string | null; reply: { status: "yes" | "maybe" | "no"; count: number } | null;
};

type Draft = { name: string; phone: string; email: string; group: string; invited: number; max: string; note: string; privateEvents: string[] };
const blank: Draft = { name: "", phone: "", email: "", group: "", invited: 2, max: "", note: "", privateEvents: [] };
const REPLY = { yes: "Confirmed", maybe: "Maybe", no: "Declined" } as const;

/* for spotting the same family twice: names without case, punctuation or "& family", phones by their last 10 digits */
const nameKey = (s: string) => s.toLowerCase().replace(/&|\band\b|\bfamily\b|\bfam\b/g, " ").replace(/[^a-z0-9\u0900-\u0d7f]+/g, "");
const phoneKey = (s: string) => s.replace(/\D/g, "").slice(-10);

/** Other guests that look like the same person or family. */
function lookalikes(list: { id: string; name: string; phone: string }[], g: { name: string; phone: string }, except?: string) {
  const n = nameKey(g.name), p = phoneKey(g.phone);
  return list.filter((x) => x.id !== except && ((n && nameKey(x.name) === n) || (p.length >= 7 && phoneKey(x.phone) === p)));
}

/** `privateEvents`: functions only chosen guests see; each guest can be given any of them. */
export function GuestManager({ id, initial, baseUrl, published, names, dateLabel, defaultMax, privateEvents = [] }: { id: string; initial: GuestView[]; baseUrl: string; published: boolean; names: string; dateLabel: string; defaultMax: number; privateEvents?: { id: string; title: string }[] }) {
  const [guests, setGuests] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [qr, setQr] = useState<{ name: string; slug: string; svg: string; png: string } | null>(null);

  /* a QR code for one guest's personal link, made in the browser */
  const showQr = async (g: GuestView) => {
    if (!published) return setToast("Publish first to make QR codes");
    const QRCode = (await import("qrcode")).default;
    const url = linkFor(g);
    setQr({
      name: g.name,
      slug: g.slug,
      svg: await QRCode.toString(url, { type: "svg", margin: 1, color: { dark: "#26231f", light: "#0000" } }),
      png: await QRCode.toDataURL(url, { width: 720, margin: 2 }),
    });
  };

  const toggleLink = async (g: GuestView) => {
    if (!g.disabled && !window.confirm(`Turn off ${g.name}'s personal link? It will show a note that the link is off, and they cannot reply from it. You can turn it back on.`)) return;
    try {
      const out = await api<{ guest: GuestView }>("PATCH", `/api/invitations/${id}/guests/${g.id}`, { disabled: !g.disabled });
      setGuests((list) => list.map((x) => (x.id === g.id ? out.guest : x)));
      setToast(out.guest.disabled ? "Link turned off" : "Link turned on");
    } catch (e) {
      setToast((e as Error).message);
    }
  };
  const { setToast, node } = useToast();

  const linkFor = (g: GuestView) => `${baseUrl}/${g.slug}`;
  const openNew = () => { setDraft(blank); setError(""); setEditing("new"); };
  const openEdit = (g: GuestView) => { setDraft({ name: g.name, phone: g.phone, email: g.email, group: g.group, invited: g.invited, max: g.max === null ? "" : String(g.max), note: g.note, privateEvents: g.privateEvents }); setError(""); setEditing(g.id); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const twins = lookalikes(guests, draft, editing === "new" ? undefined : editing ?? undefined);
      if (twins.length && !window.confirm(`This looks like ${twins.map((x) => x.name).join(", ")}, already on your list (same name or phone). Save anyway?`)) {
        setBusy(false);
        return;
      }
      const payload = { ...draft, max: draft.max === "" ? null : Number(draft.max) };
      if (editing === "new") {
        const out = await api<{ guest: GuestView }>("POST", `/api/invitations/${id}/guests`, payload);
        setGuests((g) => [out.guest, ...g]);
      } else {
        const out = await api<{ guest: GuestView }>("PATCH", `/api/invitations/${id}/guests/${editing}`, payload);
        setGuests((g) => g.map((x) => (x.id === out.guest.id ? out.guest : x)));
      }
      setEditing(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (g: GuestView) => {
    if (!window.confirm(`Remove ${g.name} from the guest list?${g.reply ? " Their reply stays in your RSVPs." : ""}`)) return;
    try {
      await api("DELETE", `/api/invitations/${id}/guests/${g.id}`);
      setGuests((list) => list.filter((x) => x.id !== g.id));
    } catch (err) {
      setToast((err as Error).message);
    }
  };

  const markSent = (g: GuestView) => {
    if (g.sentAt) return;
    setGuests((list) => list.map((x) => (x.id === g.id ? { ...x, sentAt: new Date().toISOString() } : x)));
    api("PATCH", `/api/invitations/${id}/guests/${g.id}`, { sent: true }).catch(() => {});
  };

  const shown = guests.filter((g) => !query || `${g.name} ${g.group} ${g.phone}`.toLowerCase().includes(query.toLowerCase()));
  const invited = guests.reduce((n, g) => n + g.invited, 0);

  return (
    <>
      <div className="sheet">
        <p><b>General link</b></p>
        <p className="hint" style={{ margin: "4px 0 10px" }}>One link for everyone. Guests type their own name when they reply.</p>
        {published ? <LinkBox url={baseUrl} /> : <p className="notice notice-info">Links start working once you publish. You can build your guest list now.</p>}
      </div>

      <div className="page-head" style={{ marginTop: 26, marginBottom: 6 }}>
        <div>
          <h2 className="section-h" style={{ margin: 0 }}>Personal links</h2>
          <p className="page-sub">{guests.length === 0 ? "Add a guest or family to give them their own link, greeting and guest limit." : `${guests.length} ${guests.length === 1 ? "entry" : "entries"}, ${invited} people invited.`}</p>
        </div>
        <button type="button" className="btn btn-solid" onClick={openNew}>+ Add guest</button>
      </div>

      {guests.length > 4 && (
        <div className="toolbar">
          <label className="search field">
            <span className="sr-only">Search guests</span>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" /><path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guests" />
          </label>
        </div>
      )}

      <div className="rows" style={{ marginTop: 14 }}>
        {shown.map((g) => {
          const text = shareText(names, dateLabel, linkFor(g), g.name);
          return (
            <article key={g.id} className="row-card">
              <div className="row-head">
                <div>
                  <p className="row-name">{g.name}</p>
                  <p className="row-sub">{[g.group, g.phone].filter(Boolean).join(" • ") || "No details"}</p>
                </div>
                {g.disabled && <span className="pill pill-no">Link off</span>}
                {lookalikes(guests, g, g.id).length > 0 && <span className="pill pill-maybe" title={`Same name or phone as ${lookalikes(guests, g, g.id).map((x) => x.name).join(", ")}`}>Possible duplicate</span>}
                <span className={`pill pill-${g.reply ? g.reply.status : "none"}`}>{g.reply ? `${REPLY[g.reply.status]}${g.reply.status !== "no" ? ` ${g.reply.count}` : ""}` : "No reply"}</span>
              </div>
              <p className="row-facts">
                <span><b>{g.invited}</b> invited</span>
                <span>Up to <b>{g.max ?? defaultMax}</b> can attend</span>
                <span>{g.sentAt ? "Sent" : "Not sent yet"}</span>
              </p>
              {g.note && <p className="row-msg">{g.note}</p>}
              {privateEvents.length > 0 && (
                <p className="row-sub">Private functions: {privateEvents.filter((e) => g.privateEvents.includes(e.id)).map((e) => e.title).join(", ") || "none"}</p>
              )}
              <div className="row-actions">
                <a className="btn btn-solid" href={whatsappShare(text, g.phone)} target="_blank" rel="noopener noreferrer" aria-disabled={!published} onClick={(e) => { if (!published) { e.preventDefault(); setToast("Publish first to send links"); } else markSent(g); }}>WhatsApp</a>
                <button type="button" className="btn btn-quiet" onClick={async () => { if (!published) return setToast("Publish first to send links"); if (await copyText(linkFor(g))) { setToast("Link copied"); markSent(g); } }}>Copy link</button>
                <button type="button" className="btn btn-quiet" onClick={() => showQr(g)}>QR code</button>
                <button type="button" className="btn btn-quiet" onClick={() => openEdit(g)}>Edit</button>
                <button type="button" className="btn btn-quiet" onClick={() => toggleLink(g)}>{g.disabled ? "Turn link on" : "Turn link off"}</button>
                <button type="button" className="btn btn-danger" onClick={() => remove(g)}>Remove</button>
              </div>
            </article>
          );
        })}
        {guests.length > 0 && shown.length === 0 && <p className="muted">No guests match “{query}”.</p>}
      </div>

      {qr && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="qr-h" onClick={(e) => { if (e.target === e.currentTarget) setQr(null); }}>
          <div className="modal-card">
            <div className="modal-head">
              <h2 id="qr-h">QR code for {qr.name}</h2>
              <button type="button" className="modal-x" onClick={() => setQr(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="sheet qr">
              <div dangerouslySetInnerHTML={{ __html: qr.svg }} />
              <p className="hint" style={{ textAlign: "center" }}>Opens {qr.name}&rsquo;s personal invitation. Print it on their card.</p>
              <a className="btn btn-solid btn-sm" href={qr.png} download={`${qr.slug}-qr.png`}>Download PNG</a>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="guest-h" onClick={(e) => { if (e.target === e.currentTarget) setEditing(null); }}>
          <form className="modal-card" onSubmit={save}>
            <div className="modal-head">
              <h2 id="guest-h">{editing === "new" ? "Add a guest" : "Edit guest"}</h2>
              <button type="button" className="modal-x" onClick={() => setEditing(null)} aria-label="Close">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
            <div className="form">
              <label className="field">
                <span>Name as it should appear</span>
                <input type="text" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={80} required autoFocus placeholder="Rahul & Family" />
                <small>The invitation greets them with “Dear {draft.name || "Rahul & Family"},”</small>
              </label>
              <div className="row2">
                <label className="field"><span>Phone</span><input type="tel" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} maxLength={24} inputMode="tel" placeholder="With country code" /></label>
                <label className="field"><span>Family or group</span><input type="text" value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} maxLength={60} placeholder="Bride’s side" /></label>
              </div>
              <label className="field"><span>Email (optional)</span><input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} maxLength={120} inputMode="email" /></label>
              <div className="row2">
                <label className="field"><span>Number invited</span><input type="number" min={1} max={50} value={draft.invited} onChange={(e) => setDraft({ ...draft, invited: Math.max(1, Number(e.target.value) || 1) })} inputMode="numeric" /></label>
                <label className="field"><span>Max attendees</span><input type="number" min={1} max={50} value={draft.max} onChange={(e) => setDraft({ ...draft, max: e.target.value })} inputMode="numeric" placeholder={`Default ${defaultMax}`} /></label>
              </div>
              <label className="field">
                <span>Custom note (optional)</span>
                <input type="text" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={200} placeholder="We would love to celebrate with you." />
                <small>Shown under their name at the top of the invitation.</small>
              </label>
              {privateEvents.length > 0 && (
                <fieldset className="field">
                  <span>Private functions they are invited to</span>
                  {privateEvents.map((ev) => (
                    <label key={ev.id} className="check-row">
                      <input type="checkbox" checked={draft.privateEvents.includes(ev.id)} onChange={(e) => setDraft({ ...draft, privateEvents: e.target.checked ? [...draft.privateEvents, ev.id] : draft.privateEvents.filter((x) => x !== ev.id) })} />
                      {ev.title}
                    </label>
                  ))}
                  <small>Only guests ticked here see these functions on their personal link.</small>
                </fieldset>
              )}
              {error && <p className="form-error" role="alert">{error}</p>}
              <div className="modal-actions">
                <button type="button" className="btn btn-quiet" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-solid" disabled={busy}>{busy ? "Saving…" : editing === "new" ? "Add guest" : "Save changes"}</button>
              </div>
            </div>
          </form>
        </div>
      )}
      {node}
    </>
  );
}
