"use client";

import React, { useEffect, useId, useState } from "react";
import { nameScale, pairOf, type Template } from "@/data/templates";
import { googleCalendarUrl, icsFile } from "@/lib/share";
import { Divider, Motif } from "./Ornaments";
import { BloomArt, CrestArt, DoorwayArt, FloraCorner, PortraitArt, RingsArt } from "./Vignettes";
import { Feature } from "./Features";
import { Guestbook } from "./Guestbook";
import { RsvpForm } from "./Rsvp";

const FRAME_CLASS = { arch: "frame-arch", ogee: "frame-ogee", oval: "frame-oval", rect: "frame-rect" } as const;

function Names({ t, className }: { t: Template; className: string }) {
  const [a, b] = t.couple;
  return (
    <h2 className={className} data-rv="wipe" style={{ ["--name-fit" as string]: Math.min(1, nameScale(t) * 1.25) }}>
      {a}
      {b && <> <span>&amp;</span> {b}</>}
    </h2>
  );
}

function Message({ t }: { t: Template }) {
  const guest = t.live?.guest;
  return (
    <section className="sec sec-message">
      <FloraCorner slug={t.slug} seed={4} className="sec-flora sec-flora-tl" />
      <FloraCorner slug={t.slug} seed={8} className="sec-flora sec-flora-br" />
      {guest && (
        <div className="msg-greeting" data-rv="up">
          <p className="msg-dear">Dear {guest.name},</p>
          <p className="msg-dear-line">{guest.note || "We would love to celebrate with you."}</p>
        </div>
      )}
      {t.invocation && <p className="msg-invocation" data-rv="up">{t.invocation}</p>}
      <Divider motif={t.theme.motif} />
      {t.hosts && <p className="msg-hosts" data-rv="up">{t.hosts}</p>}
      {t.request && <p className="msg-request" data-rv="up">{t.request}</p>}
      <Names t={t} className="msg-names" />
      <p className="msg-date" data-rv="up">{t.dateLabel}</p>
    </section>
  );
}

function Portrait({ t }: { t: Template }) {
  const id = useId().replace(/:/g, "");
  const photo = t.live?.portrait;
  if (t.live && !photo && !t.story) return null;
  return (
    <section className="sec sec-portrait">
      <figure className={`frame ${FRAME_CLASS[t.theme.frame]}`} data-rv="photo">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="frame-photo" src={photo} alt={pairOf(t)} loading="lazy" />
        ) : (
          <div className="frame-art"><PortraitArt t={t} id={`pt${id}`} /></div>
        )}
      </figure>
      {t.story && (
        <>
          <h2 className="sec-title" data-rv="wipe">Our story</h2>
          <p className="sec-body" data-rv="up">{t.story}</p>
        </>
      )}
    </section>
  );
}

function Events({ t }: { t: Template }) {
  return (
    <section className="sec sec-events">
      <h2 className="sec-title" data-rv="wipe">{t.events.length > 1 ? "The celebrations" : "The details"}</h2>
      <Divider motif={t.theme.motif} />
      <ol className="events">
        <span className="events-line" aria-hidden="true" data-draw="down" />
        {t.events.map((e, i) => (
          <li key={`${e.title}-${i}`} className="event" data-rv="up">
            <span className="event-node" aria-hidden="true" />
            <h3 className="event-title">{e.title}</h3>
            <p className="event-when">{e.day}{e.time && <span>{e.time}</span>}</p>
            {e.place && <p className="event-place">{e.place}</p>}
            {e.note && <p className="event-note">{e.note}</p>}
            {e.dressCode && <p className="event-dress">Dress code: {e.dressCode}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function useCountdown(iso: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const target = new Date(iso).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [iso]);
  return left;
}

function Countdown({ t }: { t: Template }) {
  const left = useCountdown(t.date);
  if (t.live && !t.live.countdown) return null;
  const s = left === null ? null : Math.floor(left / 1000);
  const parts: [string, number | null][] = [
    ["Days", s === null ? null : Math.floor(s / 86400)],
    ["Hours", s === null ? null : Math.floor((s % 86400) / 3600)],
    ["Minutes", s === null ? null : Math.floor((s % 3600) / 60)],
    ["Seconds", s === null ? null : s % 60],
  ];
  const done = left === 0;
  return (
    <section className="sec sec-count">
      <h2 className="sec-title" data-rv="wipe">{done ? "The day is here" : "Counting the days"}</h2>
      <div className="count" data-rv="up" role="timer" aria-label={`Time until ${t.dateLabel}`}>
        {parts.map(([label, v]) => (
          <div key={label} className="count-cell">
            <span className="count-num">{v === null ? "–" : String(v).padStart(2, "0")}</span>
            <span className="count-label">{label}</span>
          </div>
        ))}
      </div>
      <p className="count-until" data-rv="up">until {t.dateLabel}</p>
    </section>
  );
}

const track = (t: Template, type: string) => {
  if (t.live?.mode !== "public" || !t.live.invitation) return;
  fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitation: t.live.invitation, guest: t.live.guest?.slug, type }), keepalive: true }).catch(() => {});
};

export function directionsUrl(t: Template) {
  return t.live?.mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([t.venue.name, t.venue.address, t.venue.city].filter(Boolean).join(", "))}`;
}

function calendarEvent(t: Template) {
  return {
    title: `${pairOf(t)}${t.live ? `: ${t.live.eventTitle}` : ""}`,
    startIso: t.date,
    location: [t.venue.name, t.venue.address, t.venue.city].filter(Boolean).join(", "),
    description: "You are invited.",
    url: t.live?.shareUrl,
  };
}

function Venue({ t }: { t: Template }) {
  const saveIcs = () => {
    const blob = new Blob([icsFile(calendarEvent(t))], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "invitation.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    track(t, "calendar");
  };
  if (!t.venue.name && !t.venue.address) return null;
  return (
    <section className="sec sec-venue">
      <h2 className="sec-title" data-rv="wipe">The venue</h2>
      <div className="venue-card" data-rv="photo">
        <svg className="venue-map" viewBox="0 0 330 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeLinecap="round">
            <path d="M-10 150C60 120 110 160 170 120C230 80 280 110 340 70" strokeWidth="9" opacity=".16" />
            <path d="M-10 40C50 60 90 30 150 60C210 90 260 50 340 80M60-10C80 50 50 110 90 200M230-10C210 60 250 110 220 200M-10 100H340" strokeWidth="1.2" opacity=".28" />
            <path d="M120-10C130 40 110 80 140 200M290-10C300 70 280 130 300 200M-10 170C80 160 200 180 340 150" strokeWidth=".8" opacity=".2" />
          </g>
          <g transform="translate(170 104)">
            <ellipse cy="20" rx="13" ry="4" fill="#000" opacity=".2" />
            <path d="M0 20C-14 2-18-8-18-18a18 18 0 1 1 36 0C18-8 14 2 0 20Z" fill="url(#au-r)" />
            <circle cy="-18" r="6.5" fill="var(--bg)" />
          </g>
        </svg>
      </div>
      <h3 className="venue-name" data-rv="up">{t.venue.name}</h3>
      {(t.venue.address || t.venue.city) && (
        <p className="venue-address" data-rv="up">{t.venue.address}{t.venue.address && t.venue.city && <br />}{t.venue.city}</p>
      )}
      <div className="venue-actions" data-rv="up">
        <a className="inv-btn" href={directionsUrl(t)} target="_blank" rel="noopener noreferrer" onClick={() => track(t, "directions")}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="12" cy="9.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
          Get directions
        </a>
        {t.live && (
          <details className="cal">
            <summary className="inv-btn">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 6h14v13H5zM5 10h14M9 4v4M15 4v4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" /></svg>
              Add to calendar
            </summary>
            <div className="cal-menu">
              <a href={googleCalendarUrl(calendarEvent(t))} target="_blank" rel="noopener noreferrer" onClick={() => track(t, "calendar")}>Google Calendar</a>
              <button type="button" onClick={saveIcs}>Apple or Outlook (.ics)</button>
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

/** An update from the hosts, such as a changed time or venue. */
function Notice({ t }: { t: Template }) {
  if (!t.live?.notice) return null;
  return (
    <section className="sec sec-notice" role="status">
      <p className="notice-label">Update from the hosts</p>
      <p className="notice-text">{t.live.notice}</p>
    </section>
  );
}

function Stays({ t }: { t: Template }) {
  const stays = t.live?.stays ?? [];
  if (!stays.length) return null;
  return (
    <section className="sec sec-stays">
      <h2 className="sec-title" data-rv="wipe">Where to stay</h2>
      <ul className="stays" data-rv="up">
        {stays.map((s, i) => (
          <li key={i} className="stay">
            <h3 className="stay-name">{s.name}</h3>
            {s.note && <p className="stay-note">{s.note}</p>}
            {(s.url || s.phone) && (
              <p className="stay-links">
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer">View or book</a>}
                {s.phone && <a href={`tel:${s.phone.replace(/[^\d+]/g, "")}`}>{s.phone}</a>}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Gallery({ t }: { t: Template }) {
  const id = useId().replace(/:/g, "");
  const live = t.live;
  if (live?.mode === "public" && live.gallery.length === 0) return null;
  if (live && live.gallery.length > 0) {
    return (
      <section className="sec sec-gallery">
        <h2 className="sec-title" data-rv="wipe">Moments</h2>
        <div className={`gallery gallery-photos n${Math.min(live.gallery.length, 5)}`}>
          {live.gallery.map((src, i) => (
            <figure key={src} className="g-tile" data-rv="photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={`${pairOf(t)}, photo ${i + 1}`} loading="lazy" />
            </figure>
          ))}
        </div>
      </section>
    );
  }
  return (
    <section className="sec sec-gallery">
      <h2 className="sec-title" data-rv="wipe">Moments</h2>
      <p className="sec-note" data-rv="up">{live ? "Add photos in the editor and they appear here. Without photos, guests will not see this section." : "Shown here with illustrations. Your own photographs go in these frames."}</p>
      <div className="gallery">
        <figure className="g-tile g-a" data-rv="photo"><div className="frame-art"><PortraitArt t={t} id={`ga${id}`} /></div></figure>
        <figure className="g-tile g-b" data-rv="photo"><RingsArt t={t} /></figure>
        <figure className="g-tile g-c" data-rv="photo"><BloomArt t={t} /></figure>
        <figure className="g-tile g-d" data-rv="photo"><DoorwayArt t={t} /></figure>
        <figure className="g-tile g-e" data-rv="photo"><CrestArt t={t} /></figure>
      </div>
    </section>
  );
}

function Closing({ t, footer }: { t: Template; footer?: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const live = t.live;
  const canShare = !live || live.allowShare;
  const share = async () => {
    const url = live?.shareUrl || window.location.href;
    const data = { title: pairOf(t), text: `You’re invited 💛\n${pairOf(t)}\n${t.dateLabel}`, url };
    try {
      if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2400);
      }
      track(t, "share");
    } catch {
      /* the guest closed the share sheet */
    }
  };
  return (
    <section className="sec sec-closing">
      <FloraCorner slug={t.slug} seed={6} className="sec-flora sec-flora-bl" />
      <FloraCorner slug={t.slug} seed={12} className="sec-flora sec-flora-br2" />
      <Motif motif={t.theme.motif} className="closing-motif" size={56} />
      {t.closing && <p className="closing-line" data-rv="up">{t.closing}</p>}
      <p className="closing-with" data-rv="up">With love</p>
      <Names t={t} className="closing-names" />
      {live && live.contacts.length > 0 && (
        <div className="contacts" data-rv="up">
          <p className="contacts-h">Questions?</p>
          {live.contacts.map((c, i) => (
            <p key={i}>{c.name}{c.name && c.phone && ", "}{c.phone && <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}>{c.phone}</a>}</p>
          ))}
        </div>
      )}
      {canShare && (
        <button type="button" className="inv-btn" data-rv="up" onClick={share}>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 15V4M8 7.5l4-4 4 4M5 12v7h14v-7" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          {copied ? "Link copied" : "Share invitation"}
        </button>
      )}
      {footer}
      <p className="made-by">Invitation by YoureIn</p>
    </section>
  );
}

export function Sections({ t, footer }: { t: Template; footer?: React.ReactNode }) {
  return (
    <div className="inv-body">
      <Notice t={t} />
      <Message t={t} />
      <Portrait t={t} />
      <Feature t={t} />
      <Events t={t} />
      <Countdown t={t} />
      <Venue t={t} />
      <Stays t={t} />
      <Gallery t={t} />
      <RsvpForm t={t} />
      <Guestbook t={t} />
      <Closing t={t} footer={footer} />
    </div>
  );
}
