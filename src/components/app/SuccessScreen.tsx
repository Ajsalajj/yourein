"use client";

import { useEffect, useState } from "react";
import { shareText, whatsappShare } from "@/lib/share";
import { LinkBox } from "./ShareTools";

const COLORS = ["#E6D6B8", "#A98846", "#EDBDB6", "#C7D2A6", "#F6B33A", "#FBF8F1"];

export function SuccessScreen({ id, url, names, dateLabel, qrSvg }: { id: string; url: string; names: string; dateLabel: string; qrSvg: string }) {
  const [pieces, setPieces] = useState<{ left: number; delay: number; dur: number; dx: number; rot: number; color: string; size: number }[]>([]);
  useEffect(() => {
    /* generated on the client so the server and browser never disagree about random values */
    setPieces(
      Array.from({ length: 34 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        dur: 3.2 + Math.random() * 2.6,
        dx: (Math.random() - 0.5) * 160,
        rot: 200 + Math.random() * 400,
        color: COLORS[i % COLORS.length],
        size: 7 + Math.random() * 7,
      })),
    );
  }, []);

  const share = async () => {
    const text = shareText(names, dateLabel, url);
    if (navigator.share) {
      try {
        await navigator.share({ title: names, text: `You’re invited 💛\n\n${names}\n${dateLabel}`, url });
        return;
      } catch {
        /* closed: fall through to WhatsApp */
      }
    }
    window.open(whatsappShare(text), "_blank", "noopener");
  };

  return (
    <div className="done">
      <div className="confetti" aria-hidden="true">
        {pieces.map((p, i) => (
          <i key={i} style={{ left: `${p.left}%`, width: p.size, height: p.size * 1.5, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s`, ["--dx" as string]: `${p.dx}px`, ["--rot" as string]: `${p.rot}deg` }} />
        ))}
      </div>
      <main className="done-main done-rise">
        <svg className="done-seal" viewBox="0 0 96 96" aria-hidden="true">
          <circle cx="48" cy="48" r="44" />
          <path d="M31 49.5l12 12L66 37" />
        </svg>
        <div>
          <h1>Your invitation is live.</h1>
          <p className="done-sub">Everything is ready to share.</p>
        </div>
        <div className="done-link">
          <LinkBox url={url} />
        </div>
        <div className="done-actions">
          <button type="button" className="btn btn-solid btn-block" onClick={share}>Share Invitation</button>
          <div className="done-grid">
            <a className="btn btn-quiet" href={url} target="_blank" rel="noopener">Open Invitation</a>
            <a className="btn btn-quiet" href={`/invites/${id}/guests`}>Manage Guests</a>
          </div>
          <a className="btn btn-quiet btn-block" href={`/invites/${id}/rsvps`}>View RSVPs</a>
        </div>
        <div className="sheet qr" id="qr">
          <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="hint">Print this code on a card or show it on a screen. It opens your invitation.</p>
        </div>
        <p><a className="text-link" href="/dashboard">Go to my invitations</a></p>
      </main>
    </div>
  );
}
