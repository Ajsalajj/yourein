"use client";

import { useEffect, useState } from "react";

/* Sample data only: this demo never talks to the server. */
type Reply = { name: string; status: "yes" | "maybe" | "no"; count: number; meal?: string; diet?: string; fns?: string; msg?: string };
const REPLIES: Reply[] = [
  { name: "Rahul & Family", status: "yes", count: 4, meal: "Vegetarian", diet: "No onion, please", fns: "Sangeet 4 · Wedding 4", msg: "So happy for you both!" },
  { name: "Priya Shah", status: "yes", count: 2, meal: "Non-vegetarian", fns: "Mehendi 2 · Wedding 2" },
  { name: "The Iyers", status: "maybe", count: 3, msg: "Trying to book flights!" },
  { name: "Arjun Mehta", status: "no", count: 0, msg: "Sending my love from London." },
];
const LABEL = { yes: "Confirmed", maybe: "Maybe", no: "Declined" } as const;

type Guest = { name: string; group: string; sent: boolean; reply?: string };
const GUESTS: Guest[] = [
  { name: "Rahul & Family", group: "Bride’s side", sent: true, reply: "Confirmed 4" },
  { name: "Sharma Family", group: "Groom’s side", sent: false },
  { name: "Neha & Karan", group: "Friends", sent: true },
];

const WISHES = [
  { name: "Anjali", text: "Wishing you a lifetime of love and laughter!", photo: "/thumbs/scenic-romance-alt.webp" },
  { name: "Fatima", text: "Mabrook! Counting the days.", photo: "" },
  { name: "Rohan", text: "What a beautiful invitation. See you there!", photo: "" },
];

type Tab = "rsvps" | "guests" | "wishes" | "share";
const TABS: [Tab, string][] = [["rsvps", "RSVPs"], ["guests", "Guests"], ["wishes", "Wishes"], ["share", "Share"]];

/**
 * A working miniature of the host dashboard for the home page, so visitors can
 * try what they get before paying: replies, guest list, wishes and sharing.
 */
export function DashboardDemo() {
  const [tab, setTab] = useState<Tab>("rsvps");
  const [open, setOpen] = useState<Reply | null>(null);
  const [guests, setGuests] = useState(GUESTS);
  const [hidden, setHidden] = useState<number[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const demo = (what: string) => setToast(`${what} (demo)`);

  return (
    <div className="dd" aria-label="Interactive example of the host dashboard">
      <div className="dd-phone">
        <div className="dd-top">
          <span className="dd-title">Aarav &amp; Meera</span>
          <span className="pill pill-published">Published</span>
        </div>
        <div className="dd-tabs" role="tablist" aria-label="Dashboard sections">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setOpen(null); }}>{l}</button>
          ))}
        </div>

        <div className="dd-body" role="tabpanel">
          {tab === "rsvps" && (
            <>
              <div className="dd-tiles">
                <div className="dd-tile dd-tile-main"><b>187</b><span>Total attending</span><i className="dd-meter"><i style={{ width: "62%" }} /></i></div>
                <div className="dd-tile"><b>126</b><span>Confirmed</span></div>
                <div className="dd-tile"><b>18</b><span>Maybe</span></div>
                <div className="dd-tile"><b>64</b><span>Coming to Mehendi</span></div>
                <div className="dd-tile"><b>142</b><span>Coming to Sangeet</span></div>
              </div>
              <p className="dd-h">Latest replies <small>Tap one</small></p>
              {REPLIES.map((r) => (
                <button key={r.name} type="button" className="dd-row" onClick={() => setOpen(r)}>
                  <span><b>{r.name}</b><small>{r.status === "no" ? "Not coming" : `${r.count} guests`}</small></span>
                  <span className={`pill pill-${r.status}`}>{LABEL[r.status]}</span>
                </button>
              ))}
              <button type="button" className="btn btn-quiet btn-sm dd-wide" onClick={() => demo("Spreadsheet downloaded")}>Export CSV</button>
            </>
          )}

          {tab === "guests" && (
            <>
              <p className="dd-h">Personal links <small>Each family sees their own name</small></p>
              {guests.map((g, i) => (
                <div key={g.name} className="dd-row dd-row-static">
                  <span><b>{g.name}</b><small>{g.group}{g.reply ? ` · ${g.reply}` : ""}</small></span>
                  <button type="button" className={`btn btn-sm ${g.sent ? "btn-quiet" : "btn-solid"}`} onClick={() => { setGuests((l) => l.map((x, k) => (k === i ? { ...x, sent: true } : x))); demo(g.sent ? "Sent again on WhatsApp" : "Sent on WhatsApp"); }}>
                    {g.sent ? "Sent ✓" : "WhatsApp"}
                  </button>
                </div>
              ))}
              <div className="dd-pair">
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => { setGuests((l) => (l.length < 6 ? [...l, { name: `Guest family ${l.length + 1}`, group: "Added just now", sent: false }] : l)); }}>+ Add guest</button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => demo("QR code ready to print")}>QR codes</button>
              </div>
            </>
          )}

          {tab === "wishes" && (
            <>
              <p className="dd-h">Guestbook <small>Hide anything with one tap</small></p>
              {WISHES.map((w, i) => (
                <div key={w.name} className="dd-wish" data-hidden={hidden.includes(i)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {w.photo && <img src={w.photo} alt="" loading="lazy" />}
                  <p>{w.text}</p>
                  <span className="dd-wish-by">
                    <b>{w.name}</b>
                    <button type="button" onClick={() => setHidden((h) => (h.includes(i) ? h.filter((x) => x !== i) : [...h, i]))}>{hidden.includes(i) ? "Show" : "Hide"}</button>
                  </span>
                </div>
              ))}
            </>
          )}

          {tab === "share" && (
            <>
              <p className="dd-h">Share your invitation</p>
              <div className="dd-link"><code>yourein.com/i/aarav-meera</code><button type="button" className="btn btn-solid btn-sm" onClick={() => demo("Link copied")}>Copy</button></div>
              <div className="dd-pair">
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => demo("WhatsApp opened")}>WhatsApp</button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => demo("QR code downloaded")}>QR code</button>
              </div>
              <div className="dd-pic">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/thumbs/royal-emerald.webp" alt="" loading="lazy" />
                <span><b>Invitation picture</b><small>A phone-sized image with your names and a QR code, for WhatsApp status.</small></span>
              </div>
            </>
          )}
        </div>

        {open && (
          <div className="dd-sheet" role="dialog" aria-label={open.name}>
            <div className="dd-sheet-head"><b>{open.name}</b><button type="button" onClick={() => setOpen(null)} aria-label="Close">✕</button></div>
            <dl>
              <div><dt>Reply</dt><dd><span className={`pill pill-${open.status}`}>{LABEL[open.status]}</span></dd></div>
              <div><dt>Guests</dt><dd>{open.count}</dd></div>
              {open.fns && <div><dt>Functions</dt><dd>{open.fns}</dd></div>}
              {open.meal && <div><dt>Meal</dt><dd>{open.meal}</dd></div>}
              {open.diet && <div><dt>Dietary needs</dt><dd>{open.diet}</dd></div>}
            </dl>
            {open.msg && <p className="dd-msg">“{open.msg}”</p>}
          </div>
        )}
        {toast && <p className="dd-toast" role="status">{toast}</p>}
      </div>
    </div>
  );
}
