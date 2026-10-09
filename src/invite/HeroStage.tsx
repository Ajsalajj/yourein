"use client";

import React from "react";
import { heroNameScale, nameLines, pairOf, type Template } from "@/data/templates";
import type { ArtModule } from "./art/types";
import { artY } from "./art/types";
import { Motif } from "./Ornaments";
import { FLORA } from "./flora";
import { PETALS } from "./art/kit";

const useIsoLayoutEffect = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect;

/** Names and date, lettered over the scene. Names are measured and shrunk until the widest line fits the artwork. */
export function HeroText({ t, art }: { t: Template; art: ArtModule }) {
  const [a, b] = t.couple;
  const names = React.useRef<HTMLHeadingElement>(null);
  const tall = nameLines(a).length + nameLines(b).length > 2;
  const room = (tall ? art.names.widthTall : undefined) ?? art.names.width ?? 0.84;
  useIsoLayoutEffect(() => {
    const el = names.current;
    const box = el?.closest<HTMLElement>(".hero-text");
    if (!el || !box) return;
    const fit = () => {
      el.style.setProperty("--names-fit", "1");
      let widest = 0;
      el.querySelectorAll<HTMLElement>(".nm-line").forEach((n) => { widest = Math.max(widest, n.offsetWidth); });
      const allowed = box.clientWidth * room;
      if (widest > 0 && allowed > 0) el.style.setProperty("--names-fit", String(Math.min(1, allowed / widest)));
    };
    fit();
    const fonts = document.fonts;
    fonts?.ready.then(fit).catch(() => {});
    fonts?.addEventListener?.("loadingdone", fit);
    return () => fonts?.removeEventListener?.("loadingdone", fit);
  }, [a, b, room, t.slug]);
  const line = (name: string) => (
    <span className="nm">{nameLines(name).map((l, i) => <span className="nm-line" key={i}>{l}</span>)}</span>
  );
  return (
    <div className="hero-text" style={{ ...artY(art.names.y, art.names.anchor), color: t.theme.heroInk, ["--names-scale" as string]: (art.names.scale ?? 1) * heroNameScale(t) }}>
      <div className="hero-text-in">
        <Motif motif={t.theme.motif} className="hero-motif" />
        <h1 className="hero-names" ref={names} aria-label={pairOf(t)}>
          {line(a)}
          {b && <span className="amp" aria-hidden="true">&amp;</span>}
          {b && line(b)}
        </h1>
        <span className="hero-rule" aria-hidden="true" />
        <p className="hero-date">{t.dateLabel}</p>
      </div>
    </div>
  );
}

/** A few loose petals crossing the first screen. Kept to six on purpose. */
const DRIFT = [
  [12, 0, 15, 0.9], [34, 5.5, 18, 0.7], [58, 2.2, 14, 1], [76, 8, 19, 0.75], [88, 4, 16, 0.85], [46, 10.5, 21, 0.6],
];
function Drift({ slug }: { slug: string }) {
  const p = PETALS[FLORA[slug].petal];
  return (
    <div className="drift" aria-hidden="true">
      {DRIFT.map(([left, delay, dur, size], i) => (
        <svg key={i} viewBox="-8 -18 16 20" style={{ left: `${left}%`, width: `${size * 3.4}cqw`, animationDelay: `${delay}s`, animationDuration: `${dur}s` }}>
          <path d="M0 0C6-4 7-12 0-17C-7-11-5-4 0 0Z" fill={i % 2 ? p[1] : p[2]} />
        </svg>
      ))}
    </div>
  );
}

export function TapCue({ label, ink }: { label: string; ink?: string }) {
  return (
    <span className="tap-cue" style={ink ? { color: ink } : undefined}>
      <span className="tap-label">{label}</span>
      <span className="tap-ring" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="14" height="14"><path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
    </span>
  );
}

/**
 * The first screen of an invitation: layered scene, lettering and the sealed
 * cover on top. `sealed` controls whether the cover is still in place.
 */
export function HeroStage({
  t, art, sealed, showCue = true, children,
}: { t: Template; art: ArtModule; sealed: boolean; showCue?: boolean; children?: React.ReactNode }) {
  return (
    <section className={`inv-hero${sealed ? " is-sealed" : " is-open"}${art.namesOnCover ? " names-on-cover" : ""}`}>
      <div className="hero-scene"><art.Hero t={t} /></div>
      <div className="hero-vignette" aria-hidden="true" />
      {!sealed && <Drift slug={t.slug} />}
      <HeroText t={t} art={art} />
      {sealed && <div className="cover"><art.Cover t={t} /></div>}
      {sealed && showCue && <TapCue label={t.openLabel} ink={art.coverInk || t.theme.heroInk} />}
      {children}
    </section>
  );
}
