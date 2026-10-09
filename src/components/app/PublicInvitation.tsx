"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { pairOf, type Template } from "@/data/templates";
import { directionsUrl } from "@/invite/Sections";

const Invitation = dynamic(() => import("@/invite/Invitation"), { ssr: false });

type Phase = "sealed" | "opening" | "open";

function track(t: Template, type: string) {
  const live = t.live;
  if (!live?.invitation) return;
  fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ invitation: live.invitation, guest: live.guest?.slug, type }), keepalive: true }).catch(() => {});
}

/** The published invitation as a guest sees it: full screen, with three small actions always in reach. */
export function PublicInvitation({ t }: { t: Template }) {
  const live = t.live!;
  const screen = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("sealed");
  const [ready, setReady] = useState(false);
  const [nearReply, setNearReply] = useState(false);
  const [copied, setCopied] = useState(false);

  /* one view per visit, not one per refresh */
  useEffect(() => {
    const key = `yi-view:${live.invitation}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, "1");
    } catch {
      /* count it anyway */
    }
    track(t, "view");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (phase !== "open") return;
    track(t, "open");
    /* get out of the way while the guest is filling in their reply */
    const el = screen.current?.querySelector("#rsvp");
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNearReply(entry.isIntersecting), { root: screen.current, threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const toReply = () => screen.current?.querySelector("#rsvp")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });

  const share = async () => {
    const url = live.shareUrl || window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: pairOf(t), text: `You’re invited 💛\n${pairOf(t)}\n${t.dateLabel}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2200);
      }
      track(t, "share");
    } catch {
      /* closed */
    }
  };

  return (
    <div className="pub">
      <div className="pub-frame">
        <div className="pub-screen" ref={screen} data-inv-scroller tabIndex={-1} style={{ background: t.theme.bg }}>
          {!ready && (
            <div className="pub-splash" style={{ color: t.theme.ink }}>
              <b>{pairOf(t)}</b>
              <span>{t.dateLabel}</span>
            </div>
          )}
          <Invitation t={t} onPhase={(p) => { setReady(true); setPhase(p); }} />
        </div>
        {phase === "open" && (
          <nav className="pub-actions" aria-label="Quick actions" data-hidden={nearReply}>
            {(t.venue.name || live.mapsUrl) && (
              <a href={directionsUrl(t)} target="_blank" rel="noopener noreferrer" onClick={() => track(t, "directions")}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21Z" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="9.5" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.7" /></svg>
                Directions
              </a>
            )}
            {live.rsvp && !live.rsvp.closed && <button type="button" className="is-main" onClick={toReply}>RSVP</button>}
            {live.allowShare && (
              <button type="button" onClick={share}>
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 15V4M8 7.5l4-4 4 4M5 12v7h14v-7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                {copied ? "Copied" : "Share"}
              </button>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}
