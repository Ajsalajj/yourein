"use client";

import React from "react";
import type { Template } from "@/data/templates";
import { Bush, Cluster, Couple, Crescent, Stars, archD, ridge } from "./art/kit";
import { FLORA, mixHex } from "./flora";
import { Motif } from "./Ornaments";

/**
 * Illustrated stand-ins for the couple's photographs. In a finished invitation
 * these frames hold the customer's own pictures.
 */

function Svg({ vb, children, className }: { vb: string; children: React.ReactNode; className?: string }) {
  return (
    <svg className={className} viewBox={vb} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

/** A spray of the design's flowers, drawn to sit in a bottom-left corner. */
export function FloraCorner({ slug, seed = 3, className, style, count = 9 }: { slug: string; seed?: number; className?: string; style?: React.CSSProperties; count?: number }) {
  const f = FLORA[slug];
  return (
    <svg className={`flora${className ? ` ${className}` : ""}`} style={style} viewBox="0 0 220 220" aria-hidden="true" focusable="false">
      <Bush x={40} y={176} seed={seed} count={26} spread={[62, 46]} greens={f.greens} size={[0.8, 1.5]} />
      <Cluster x={54} y={166} seed={seed * 5 + 1} count={f.sprigs ? 3 : count} spread={[60, 44]} mix={f.mix} greens={f.greens} sprigs={f.sprigs ?? 7} sprigLen={[60, 130]} size={[0.6, 1.4]} />
    </svg>
  );
}

function skyStops(t: Template): [string, string, string] {
  const th = t.theme;
  return th.dark ? [mixHex(th.bg, "#000000", 0.25), th.bgAlt, th.tint] : [mixHex(th.tint, th.bg, 0.25), mixHex(th.tint, th.bg, 0.7), th.bg];
}

/** The couple under an open sky: three layers so the frame can show depth. */
export function PortraitArt({ t, id }: { t: Template; id: string }) {
  const th = t.theme;
  const f = FLORA[t.slug];
  const [s0, s1, s2] = skyStops(t);
  const hill = th.dark ? mixHex(th.bg, "#000000", 0.2) : mixHex(th.tint, th.ink, 0.22);
  const hill2 = th.dark ? mixHex(th.bgAlt, "#000000", 0.1) : mixHex(th.tint, th.ink, 0.1);
  const ground = th.dark ? mixHex(th.bg, "#000000", 0.35) : mixHex(th.bgAlt, th.tint, 0.5);
  return (
    <>
      <Svg vb="0 0 390 520" className="vg-layer" >
        <defs>
          <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s0} />
            <stop offset=".55" stopColor={s1} />
            <stop offset="1" stopColor={s2} />
          </linearGradient>
        </defs>
        <rect x="-20" y="-40" width="430" height="620" fill={`url(#${id}-sky)`} />
        {th.dark ? (
          <>
            <Stars seed={5} count={50} y0={0} y1={320} />
            <Crescent x={280} y={110} R={30} r={-24} />
          </>
        ) : (
          <circle cx="250" cy="250" r="230" fill="url(#glow-sun)" />
        )}
        <path d={ridge(4, 356, 30, { sharp: 0.4, bottom: 600 })} fill={hill2} opacity=".8" />
        <path d={ridge(9, 384, 20, { freq: 1.5, bottom: 600 })} fill={hill} opacity=".8" />
      </Svg>
      <Svg vb="0 0 390 520" className="vg-layer" >
        <g data-par="0.5">
          <rect x="-20" y="440" width="430" height="140" fill={ground} />
          <ellipse cx="195" cy="444" rx="230" ry="16" fill={th.dark ? "#FFE2A0" : "#fff"} opacity={th.dark ? 0.12 : 0.4} filter="url(#f-blur8)" />
          <Couple x={200} y={482} s={2.05} dress={f.dress[0]} dressDeep={f.dress[1]} suit={th.dark ? "#2A2A38" : "#4A4250"} rim={th.dark ? "#FFE2A0" : "#FFD9A6"} />
        </g>
      </Svg>
      <Svg vb="0 0 390 520" className="vg-layer" >
        <g data-par="1">
          <Bush x={10} y={500} seed={3} count={26} spread={[70, 50]} greens={f.greens} size={[0.9, 1.6]} />
          <Cluster x={24} y={490} seed={5} count={f.sprigs ? 3 : 9} spread={[64, 46]} mix={f.mix} greens={f.greens} sprigs={f.sprigs ?? 6} sprigLen={[50, 110]} size={[0.7, 1.5]} />
          <Bush x={384} y={506} seed={8} count={22} spread={[60, 44]} greens={f.greens} size={[0.9, 1.5]} />
          <Cluster x={370} y={498} seed={11} count={f.sprigs ? 2 : 7} spread={[54, 40]} mix={f.mix} greens={f.greens} sprigs={f.sprigs ?? 5} sprigLen={[50, 100]} size={[0.7, 1.4]} />
        </g>
      </Svg>
    </>
  );
}

/** Gallery tile: two wedding bands. */
export function RingsArt({ t }: { t: Template }) {
  const th = t.theme;
  const f = FLORA[t.slug];
  return (
    <Svg vb="0 0 300 300">
      <rect width="300" height="300" fill={th.dark ? th.bgAlt : mixHex(th.bgAlt, th.tint, 0.25)} />
      <circle cx="150" cy="150" r="170" fill={th.dark ? "url(#glow-moon)" : "url(#glow-white)"} opacity=".7" />
      <ellipse cx="150" cy="212" rx="80" ry="10" fill="#000" opacity=".16" filter="url(#f-blur8)" />
      <g fill="none" strokeLinecap="round">
        <ellipse cx="128" cy="160" rx="44" ry="46" stroke="url(#au)" strokeWidth="9" transform="rotate(-14 128 160)" />
        <ellipse cx="176" cy="150" rx="40" ry="42" stroke="url(#au-h)" strokeWidth="7" transform="rotate(16 176 150)" />
        <path d="M100 126C108 114 122 108 136 110" stroke="#fff" strokeOpacity=".8" strokeWidth="2.4" />
        <path d="M156 118C164 108 178 104 190 108" stroke="#fff" strokeOpacity=".8" strokeWidth="2" />
      </g>
      <path d="M176 100l7 9-7 10-7-10z" fill="#fff" stroke="url(#au)" strokeWidth="1.2" />
      <Cluster x={20} y={280} seed={4} count={f.sprigs ? 2 : 6} spread={[46, 34]} mix={f.mix} greens={f.greens} sprigs={f.sprigs ?? 5} sprigLen={[40, 90]} size={[0.6, 1.2]} />
    </Svg>
  );
}

/** Gallery tile: the flowers, close up. */
export function BloomArt({ t, seed = 6 }: { t: Template; seed?: number }) {
  const th = t.theme;
  const f = FLORA[t.slug];
  return (
    <Svg vb="0 0 300 300">
      <rect width="300" height="300" fill={th.dark ? mixHex(th.bg, "#000000", 0.2) : mixHex(th.bg, th.tint, 0.35)} />
      <Bush x={150} y={160} seed={seed} count={46} spread={[150, 150]} greens={f.greens} size={[1.4, 2.6]} />
      <Cluster x={150} y={156} seed={seed + 4} count={f.sprigs ? 5 : 12} spread={[120, 120]} mix={f.mix} greens={f.greens} sprigs={f.sprigs ?? 5} sprigLen={[80, 150]} size={[1.3, 2.9]} />
    </Svg>
  );
}

/** Gallery tile: a doorway with light beyond it. */
export function DoorwayArt({ t }: { t: Template }) {
  const th = t.theme;
  const f = FLORA[t.slug];
  const kind = th.frame === "ogee" ? "cusped" : "round";
  const wall = th.dark ? th.bg : mixHex(th.bgAlt, th.tint, 0.35);
  const hole = archD(150, 62, 150, 420, kind);
  return (
    <Svg vb="0 0 300 380">
      <rect width="300" height="380" fill={th.dark ? th.tint : mixHex(th.bg, "#ffffff", 0.5)} />
      <circle cx="150" cy="250" r="170" fill={th.dark ? "url(#glow-warm)" : "url(#glow-sun)"} />
      <path d={ridge(3, 300, 18, { x0: 0, x1: 300, bottom: 400, freq: 2 })} fill={th.dark ? mixHex(th.bg, "#000000", 0.3) : mixHex(th.tint, th.ink, 0.18)} opacity=".8" />
      <path d={`M-10-10H310V400H-10Z ${hole}`} fill={wall} fillRule="evenodd" />
      <path d={`M-10-10H310V400H-10Z ${hole}`} fill="url(#pat-ogee)" fillRule="evenodd" opacity={th.dark ? 0.12 : 0.5} />
      <path d={hole} fill="none" stroke="url(#au)" strokeWidth="2" />
      <path d={archD(150, 52, 166, 420, kind)} fill="none" stroke="url(#au)" strokeWidth=".8" />
      <Cluster x={26} y={356} seed={9} count={f.sprigs ? 2 : 7} spread={[50, 36]} mix={f.mix} greens={f.greens} sprigs={f.sprigs ?? 5} sprigLen={[40, 90]} size={[0.6, 1.3]} />
      <Cluster x={278} y={362} seed={14} count={f.sprigs ? 2 : 6} spread={[44, 32]} mix={f.mix} greens={f.greens} sprigs={f.sprigs ?? 5} sprigLen={[40, 90]} size={[0.6, 1.2]} />
    </Svg>
  );
}

/** Gallery tile: the design's own ornament, pressed in foil. */
export function CrestArt({ t }: { t: Template }) {
  const th = t.theme;
  return (
    <div className="vg-crest" style={{ background: th.dark ? th.bgAlt : th.bgAlt }}>
      <span className="vg-crest-ring">
        <Motif motif={th.motif} size={64} />
        <span className="vg-crest-initials">{t.couple[0][0]}{t.couple[1] && <> <i>&amp;</i> {t.couple[1][0]}</>}</span>
      </span>
    </div>
  );
}
