"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "motion/react";
import type { Template } from "@/data/templates";

const Invitation = dynamic(() => import("@/invite/Invitation"), {
  ssr: false,
  loading: () => <div className="pv-loading" role="status">Preparing your invitation</div>,
});

export type Phase = "sealed" | "opening" | "open";

type Props = {
  t: Template;
  /** Shown in the top bar on phones. */
  title: string;
  note?: string;
  onClose: () => void;
  closeLabel?: string;
  /** Sticky bottom bar: the one primary action for this screen. */
  bar: React.ReactNode;
  /** Desktop only: text beside the phone, and controls on the other side. */
  side?: (phase: Phase, replay: () => void) => React.ReactNode;
  step?: React.ReactNode;
  /** Shown at the end of the invitation itself. */
  footer?: React.ReactNode;
};

/**
 * The immersive viewer: a dark room with the real invitation in it. On phones
 * the invitation fills the screen between a slim top bar and the action bar.
 * Used for catalog previews and for the host's own preview while editing.
 */
export function InvitationViewer({ t, title, note, onClose, closeLabel = "Close preview", bar, side, step, footer }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<Phase>("sealed");

  useEffect(() => { setPhase("sealed"); }, [t.slug, run]);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !dialogRef.current) return;
      const els = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])')).filter((el) => el.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      ref={dialogRef}
      className="pv"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} preview`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="pv-vignette" aria-hidden="true" onClick={onClose} />

      <div className="pv-top">
        <button ref={closeRef} type="button" className="pv-close" onClick={onClose} aria-label={closeLabel}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <span className="pv-title">{title}</span>
        {note && <span className="pv-top-note">{note}</span>}
      </div>

      {side && <aside className="pv-side">{side(phase, () => setRun((r) => r + 1))}</aside>}

      <motion.div
        key={`${t.slug}-${run}`}
        className="pv-phone"
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
      >
        <div className="pv-screen" data-inv-scroller tabIndex={-1}>
          <Invitation t={t} onPhase={setPhase} footer={footer} />
        </div>
      </motion.div>

      {step}
      <div className="pv-bar">{bar}</div>
    </motion.div>
  );
}
