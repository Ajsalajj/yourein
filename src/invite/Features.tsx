"use client";

import React from "react";
import type { Template } from "@/data/templates";
import { ArchWall, Clouds, Crescent, Stars, Treeline, ridge } from "./art/kit";
import type { ArchKind } from "./art/kit";
import { FloraCorner } from "./Vignettes";
import { mixHex } from "./flora";

export function dateParts(iso: string, tz = "Asia/Kolkata") {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, ...o }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d).toLowerCase();
  return { weekday: f({ weekday: "long" }), day: f({ day: "numeric" }), month: f({ month: "long" }), year: f({ year: "numeric" }), time };
}

function DateBlock({ t }: { t: Template }) {
  const p = dateParts(t.date, t.tz);
  return (
    <div className="feat-date">
      <span className="fd-week">{p.weekday}</span>
      <span className="fd-day">{p.day}</span>
      <span className="fd-month">{p.month} {p.year}</span>
      <span className="fd-rule" aria-hidden="true" />
      <span className="fd-time">{p.time}</span>
      <span className="fd-city">{[t.venue.name, t.venue.city.split(",")[0]].filter(Boolean).join(", ")}</span>
    </div>
  );
}

function Art({ children, name }: { children: React.ReactNode; name: string }) {
  return (
    <div className="feat-layer" data-fl={name}>
      <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">{children}</svg>
    </div>
  );
}

/** Arch after arch: the guest walks through to the date. */
function FeatureArch({ t }: { t: Template }) {
  const th = t.theme;
  const kind: ArchKind = t.slug === "jasmine-moon" ? "pointed" : th.frame === "ogee" ? "cusped" : "round";
  const fills = th.dark ? [th.bg, th.bgAlt, th.tint] : [th.bg, th.bgAlt, mixHex(th.bgAlt, th.tint, 0.55)];
  const pat = th.dark ? 0.12 : 0.55;
  const walls: [number, number, number][] = [[300, 150, 0], [224, 246, 1], [156, 332, 2]];
  return (
    <section className="feat feat-arch" data-feat="arch">
      <div className="feat-pin" style={{ background: th.dark ? mixHex(th.tint, th.bg, 0.3) : mixHex(th.bg, "#ffffff", 0.6) }}>
        <div className="feat-glow" style={{ background: `radial-gradient(60% 46% at 50% 56%, ${th.dark ? "rgba(255,216,140,.42)" : "rgba(255,222,150,.7)"}, transparent 70%)` }} />
        <DateBlock t={t} />
        {walls.slice().reverse().map(([w, top, i]) => (
          <Art key={i} name={`wall-${i}`}>
            <ArchWall top={top} w={w} bottom={980} kind={kind} rise={kind === "pointed" ? w * 0.8 : undefined} fill={fills[i]} pattern="pat-ogee" patternOpacity={pat} trim="url(#au)" trimWidth={2.2} bounds={[-400, -500, 1190, 1900]} />
          </Art>
        ))}
        <p className="feat-lead">Save the date</p>
      </div>
    </section>
  );
}

/** A slow push across the landscape. */
function FeatureScenic({ t }: { t: Template }) {
  const th = t.theme;
  const id = `fs-${t.no}`;
  const sky = th.dark ? [mixHex(th.bg, "#000000", 0.3), th.bgAlt, th.tint] : [mixHex(th.tint, th.bg, 0.2), mixHex(th.tint, th.bg, 0.65), mixHex(th.bg, "#ffffff", 0.4)];
  const far = th.dark ? mixHex(th.tint, th.bg, 0.35) : mixHex(th.tint, th.bg, 0.45);
  const mid = th.dark ? mixHex(th.tint, th.bg, 0.65) : mixHex(th.tint, th.ink, 0.12);
  const near = th.dark ? mixHex(th.bg, "#000000", 0.25) : mixHex(th.tint, th.ink, 0.36);
  const tree = th.dark ? mixHex(th.bg, "#000000", 0.45) : mixHex(th.tint, th.ink, 0.44);
  return (
    <section className="feat feat-scenic" data-feat="scenic">
      <div className="feat-pin">
        <Art name="sky">
          <defs>
            <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={sky[0]} />
              <stop offset=".45" stopColor={sky[1]} />
              <stop offset=".72" stopColor={sky[2]} />
            </linearGradient>
            <linearGradient id={`${id}-water`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={sky[2]} />
              <stop offset="1" stopColor={far} />
            </linearGradient>
          </defs>
          <rect x="-40" y="-40" width="470" height="930" fill={`url(#${id}-sky)`} />
          {th.dark ? (
            <>
              <Stars seed={11} count={110} y0={0} y1={600} />
              <Crescent x={286} y={150} R={36} r={-22} fill="#F8EFD2" />
              <Clouds seed={4} count={3} y={220} spreadY={50} color="#C3CCF0" o={0.3} />
            </>
          ) : (
            <>
              <circle cx="220" cy="560" r="270" fill="url(#glow-sun)" />
              <Clouds seed={4} count={5} y={470} spreadY={90} color="#fff" o={0.75} />
            </>
          )}
        </Art>
        <Art name="far">
          <path d={ridge(21, 590, 44, { sharp: 0.55, freq: 1.1, x0: -60, x1: 450 })} fill={far} />
        </Art>
        <Art name="mid">
          <path d={ridge(27, 628, 34, { sharp: 0.4, freq: 1.5, x0: -60, x1: 450 })} fill={mid} />
          <rect x="-60" y="640" width="510" height="260" fill={`url(#${id}-water)`} />
          <rect x="-60" y="634" width="510" height="14" fill="#fff" opacity={th.dark ? 0.12 : 0.5} filter="url(#f-blur3)" />
        </Art>
        <Art name="near">
          <path d="M-60 720C20 660 110 650 170 700L-60 780Z" fill={near} />
          <path d="M450 730C390 664 320 650 250 706L450 790Z" fill={near} />
          <Treeline seed={5} x0={-50} x1={160} y={702} h={22} fill={tree} count={12} spires={0.2} />
          <Treeline seed={9} x0={258} x1={440} y={708} h={22} fill={tree} count={11} spires={0.2} />
          <path d="M-60 760C80 730 300 740 450 770V900H-60Z" fill={near} />
        </Art>
        <DateBlock t={t} />
        <FloraCorner slug={t.slug} seed={5} className="feat-flora feat-flora-l" count={11} />
        <FloraCorner slug={t.slug} seed={9} className="feat-flora feat-flora-r" count={11} />
        <p className="feat-lead">Save the date</p>
      </div>
    </section>
  );
}

/** Three sheets of stationery that fan apart. */
function FeaturePaper({ t }: { t: Template }) {
  return (
    <section className="feat feat-paper" data-feat="paper">
      <div className="feat-pin">
        <p className="feat-lead">Save the date</p>
        <div className="fp-stack">
          <div className="fp-card fp-c" />
          <div className="fp-card fp-b" />
          <div className="fp-card fp-a"><DateBlock t={t} /></div>
        </div>
        <FloraCorner slug={t.slug} seed={5} className="feat-flora feat-flora-l" />
        <FloraCorner slug={t.slug} seed={9} className="feat-flora feat-flora-r" />
      </div>
    </section>
  );
}

export function Feature({ t }: { t: Template }) {
  if (t.theme.family === "arch") return <FeatureArch t={t} />;
  if (t.theme.family === "scenic") return <FeatureScenic t={t} />;
  return <FeaturePaper t={t} />;
}
