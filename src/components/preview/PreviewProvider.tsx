"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

/* The overlay and the whole invitation engine load only when a preview is first opened. */
const PreviewOverlay = dynamic(() => import("./PreviewOverlay"), { ssr: false });

type Ctx = { open: (slug: string) => void; close: () => void; current: string | null };
const PreviewCtx = createContext<Ctx>({ open: () => {}, close: () => {}, current: null });

export const usePreview = () => useContext(PreviewCtx);

export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [everOpened, setEverOpened] = useState(false);
  const opener = useRef<HTMLElement | null>(null);

  const open = useCallback((s: string) => {
    opener.current = document.activeElement as HTMLElement | null;
    setEverOpened(true);
    setSlug((cur) => {
      /* one history entry per preview session, so the phone's Back button closes it */
      if (!cur) window.history.pushState({ yiPreview: true }, "");
      return s;
    });
  }, []);

  const close = useCallback(() => {
    if (window.history.state?.yiPreview) window.history.back();
    else setSlug(null);
  }, []);

  useEffect(() => {
    const onPop = () => setSlug(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (slug) {
      const { overflow } = document.documentElement.style;
      document.documentElement.style.overflow = "hidden";
      return () => { document.documentElement.style.overflow = overflow; };
    }
    opener.current?.focus?.({ preventScroll: true });
  }, [slug]);

  return (
    <PreviewCtx.Provider value={{ open, close, current: slug }}>
      {children}
      {everOpened && <PreviewOverlay slug={slug} onClose={close} onPick={open} />}
    </PreviewCtx.Provider>
  );
}

/** Any element that opens a design's preview. */
export function PreviewButton({ slug, className, children, label }: { slug: string; className?: string; children: React.ReactNode; label?: string }) {
  const { open } = usePreview();
  return (
    <button type="button" className={className} onClick={() => open(slug)} aria-label={label} aria-haspopup="dialog">
      {children}
    </button>
  );
}
