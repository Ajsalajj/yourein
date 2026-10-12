"use client";

import { useEffect, useRef, useState } from "react";
import type { Theme } from "@/data/templates";
import "@/invite/fonts";

const SCRIPT = { pinyon: "Pinyon Script", allura: "Allura" } as const;
const CAPS = { cinzel: "Cinzel", cormorant: "Cormorant Garamond Variable" } as const;
const SERIF = "Cormorant Garamond Variable";
const W = 1080, H = 1920;

type Props = {
  couple: [string, string];
  eventTitle: string;
  dateLabel: string;
  time: string;
  venue: string;
  url: string;
  theme: Pick<Theme, "bg" | "ink" | "accent" | "script" | "caps">;
  slug: string;
};

/** Draws text centred at y, shrinking the font until it fits the width. */
function line(g: CanvasRenderingContext2D, text: string, y: number, size: number, family: string, max = W - 260) {
  let s = size;
  do {
    g.font = `${s}px "${family}"`;
    s -= 4;
  } while (g.measureText(text).width > max && s > 20);
  g.fillText(text, W / 2, y);
}

/** Splits text into lines that fit the width. */
function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const out: string[] = [];
  let cur = "";
  for (const word of text.split(/\s+/)) {
    const next = cur ? `${cur} ${word}` : word;
    if (g.measureText(next).width > max && cur) {
      out.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out.slice(0, 3);
}

/**
 * A phone-sized picture of the invitation (names, date, venue and a QR code to the link),
 * drawn in the design's colours and typefaces, for WhatsApp status or printing.
 */
export function InviteImage({ couple, eventTitle, dateLabel, time, venue, url, theme, slug }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [png, setPng] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const c = canvas.current;
      if (!c) return;
      const script = SCRIPT[theme.script], caps = CAPS[theme.caps];
      await Promise.all([`120px "${script}"`, `48px "${caps}"`, `44px "${SERIF}"`].map((f) => document.fonts.load(f).catch(() => null)));
      const QRCode = (await import("qrcode")).default;
      const qr = new Image();
      /* dark on light so every phone camera can read it, whatever the design's colours */
      qr.src = await QRCode.toDataURL(url, { width: 420, margin: 0, color: { dark: "#1c1a17", light: "#fffdf8" } });
      await qr.decode().catch(() => null);
      if (cancelled) return;

      const g = c.getContext("2d")!;
      g.fillStyle = theme.bg;
      g.fillRect(0, 0, W, H);
      g.strokeStyle = theme.accent;
      g.lineWidth = 4;
      g.strokeRect(54, 54, W - 108, H - 108);
      g.lineWidth = 1.5;
      g.strokeRect(74, 74, W - 148, H - 148);

      g.textAlign = "center";
      g.textBaseline = "alphabetic";
      g.fillStyle = theme.accent;
      g.letterSpacing = "10px";
      line(g, `YOU ARE INVITED`, 300, 40, caps);
      g.letterSpacing = "0px";
      g.fillStyle = theme.ink;
      line(g, `to the ${eventTitle.toLowerCase()} of`, 380, 46, SERIF);

      const [a, b] = couple;
      line(g, a || "Your names", b ? 600 : 680, 170, script);
      if (b) {
        g.fillStyle = theme.accent;
        line(g, "&", 730, 110, script);
        g.fillStyle = theme.ink;
        line(g, b, 880, 170, script);
      }

      g.fillStyle = theme.accent;
      g.fillRect(W / 2 - 60, 960, 120, 2);
      g.fillStyle = theme.ink;
      g.letterSpacing = "6px";
      line(g, [dateLabel, time].filter(Boolean).join(" · ").toUpperCase(), 1060, 46, caps);
      g.letterSpacing = "0px";
      g.font = `44px "${SERIF}"`;
      wrap(g, venue, W - 300).forEach((l, i) => g.fillText(l, W / 2, 1140 + i * 56));

      const qs = 330, pad = 26;
      g.fillStyle = "#fffdf8";
      g.beginPath();
      g.roundRect((W - qs) / 2 - pad, 1300 - pad, qs + pad * 2, qs + pad * 2, 22);
      g.fill();
      g.drawImage(qr, (W - qs) / 2, 1300, qs, qs);
      g.fillStyle = theme.accent;
      line(g, "Scan to open the invitation", 1730, 38, SERIF);
      g.fillStyle = theme.ink;
      line(g, url.replace(/^https?:\/\//, ""), 1790, 30, SERIF, W - 300);

      setPng(c.toDataURL("image/png"));
    })();
    return () => {
      cancelled = true;
    };
  }, [couple, eventTitle, dateLabel, time, venue, url, theme]);

  return (
    <div className="sheet" style={{ display: "grid", justifyItems: "center", gap: 10, padding: 16 }}>
      <canvas ref={canvas} width={W} height={H} style={{ display: "none" }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {png ? <img src={png} alt="Your invitation as a picture" style={{ width: "min(100%, 260px)", height: "auto", aspectRatio: "9 / 16", borderRadius: 10, boxShadow: "0 10px 30px -14px rgba(0,0,0,.4)" }} /> : <p className="hint">Preparing your picture…</p>}
      <p className="hint" style={{ textAlign: "center" }}>Phone-sized, for WhatsApp status or printing. The QR code opens your invitation.</p>
      {png && <a className="btn btn-quiet btn-sm" href={png} download={`${slug}-invitation.png`}>Download picture</a>}
    </div>
  );
}
