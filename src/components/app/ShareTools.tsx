"use client";

import { useEffect, useState } from "react";
import { mailShare, shareText, whatsappShare } from "@/lib/share";
import { copyText } from "./client";

export function useToast() {
  const [toast, setToast] = useState("");
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(""), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);
  return { toast, setToast, node: toast ? <div className="toast" role="status">{toast}</div> : null };
}

export function LinkBox({ url, onCopied }: { url: string; onCopied?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="link-box">
      <code>{url.replace(/^https?:\/\//, "")}</code>
      <button
        type="button"
        className="btn btn-solid btn-sm"
        onClick={async () => {
          if (await copyText(url)) {
            setCopied(true);
            onCopied?.();
            window.setTimeout(() => setCopied(false), 2000);
          }
        }}
      >
        {copied ? "Copied" : "Copy Link"}
      </button>
    </div>
  );
}

/** Ways to send a published invitation. These share it; nothing here is a purchase. */
export function ShareButtons({ url, names, dateLabel, primary }: { url: string; names: string; dateLabel: string; primary?: boolean }) {
  const text = shareText(names, dateLabel, url);
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);
  const native = async () => {
    try {
      await navigator.share({ title: names, text: `You’re invited 💛\n\n${names}\n${dateLabel}`, url });
    } catch {
      /* closed */
    }
  };
  return (
    <div className="share-grid">
      <a className={`btn ${primary ? "btn-solid" : "btn-quiet"}`} href={whatsappShare(text)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      <a className="btn btn-quiet" href={mailShare(`You’re invited: ${names}`, text)}>Email</a>
      {canShare && <button type="button" className="btn btn-quiet" onClick={native}>More…</button>}
      <a className="btn btn-quiet" href="#qr">QR code</a>
    </div>
  );
}
