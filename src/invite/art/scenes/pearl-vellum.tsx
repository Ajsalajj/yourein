import React from "react";
import { pairOf, type Template } from "@/data/templates";
import { Layer, Bud, Leaf, Orchid, Petals, Sprig, quadPts, rng, VW, VH } from "../kit";
import type { Pt } from "../kit";
import type { ArtModule } from "../types";
import { Plate } from "./_shared";

function Spray({ p0, p1, p2, seed, count = 6 }: { p0: Pt; p1: Pt; p2: Pt; seed: number; count?: number }) {
  const R = rng(seed);
  const pts = quadPts(p0, p1, p2, count + 4);
  return (
    <g filter="url(#f-drop-s)">
      <path d={`M${p0[0]} ${p0[1]}Q${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]}`} fill="none" stroke="#8FA06F" strokeWidth="2.2" strokeLinecap="round" />
      <Leaf c="sage" x={p0[0]} y={p0[1]} r={R() * 60 - 30} s={2.4} />
      <Leaf c="moss" x={p0[0]} y={p0[1]} r={R() * 60 + 40} s={2} />
      {pts.slice(1, count + 1).map((p, i) => (
        <Orchid key={i} x={p[0] + (R() - 0.5) * 34} y={p[1] + (R() - 0.5) * 34} r={R() * 50 - 25} s={1.9 - i * 0.12 + R() * 0.25} />
      ))}
      {pts.slice(count + 1).map((p, i) => <Bud key={`b${i}`} x={p[0]} y={p[1]} r={R() * 360} s={1.3 - i * 0.2} c="ivory" />)}
    </g>
  );
}

function Silk() {
  return (
    <g>
      <path d="M-20 60C90 10 230 150 410 40V190C250 290 110 130-20 250Z" fill="url(#satin-pearl)" />
      <path d="M-20 250C110 130 250 290 410 190" fill="none" stroke="#B9AE98" strokeOpacity=".35" strokeWidth="10" filter="url(#f-blur8)" />
      <path d="M-20 560C120 500 240 660 410 560V700C260 800 120 640-20 760Z" fill="url(#satin-pearl)" />
      <path d="M-20 760C120 640 260 800 410 700" fill="none" stroke="#B9AE98" strokeOpacity=".35" strokeWidth="10" filter="url(#f-blur8)" />
      <path d="M-20 120C100 70 240 200 410 110M-20 620C120 560 240 720 410 620" fill="none" stroke="#fff" strokeWidth="12" filter="url(#f-blur3)" />
    </g>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="#F8F5EE" />
        <Silk />
      </Layer>
      <Layer depth={0.3} role="plate">
        <Plate d="M195 168C270 168 326 244 326 340C326 436 270 512 195 512C120 512 64 436 64 340C64 244 120 168 195 168Z" inner="M195 177C264 177 317 248 317 340C317 432 264 503 195 503C126 503 73 432 73 340C73 248 126 177 195 177Z" />
      </Layer>
      <Layer depth={0.6} role="orchid-a" className="sc-soft">
        <Spray p0={[410, 70]} p1={[290, 60]} p2={[300, 250]} seed={3} count={6} />
        <Sprig x={398} y={120} r={-150} len={110} c="gilt" count={8} bend={18} />
      </Layer>
      <Layer depth={0.82} role="orchid-b" className="sc-soft">
        <Spray p0={[-18, 770]} p1={[110, 780]} p2={[110, 570]} seed={8} count={7} />
        <Sprig x={-6} y={720} r={50} len={120} c="gilt" count={8} bend={-18} />
        <Spray p0={[410, 810]} p1={[330, 800]} p2={[300, 720]} seed={15} count={4} />
      </Layer>
      <Layer depth={1}>
        <Petals seed={5} count={5} c="white" box={[40, 520, 310, 260]} />
      </Layer>
    </>
  );
}

function Cover({ t }: { t: Template }) {
  const caps: React.CSSProperties = { fontFamily: "var(--f-caps)", fontWeight: 500 };
  return (
    <div className="cv-wrap" data-role="vellum">
      <div className="cv-frost" style={{ background: "linear-gradient(160deg, rgba(255,255,255,.62), rgba(250,247,240,.42) 45%, rgba(255,255,255,.6))" }} />
      <Layer>
        <path d="M-20 30L160 844M120-20L330 864M270-20L410 520" stroke="#fff" strokeOpacity=".5" strokeWidth="26" filter="url(#f-blur8)" />
        <rect x="26" y="-20" width="338" height="884" fill="none" stroke="url(#au)" strokeWidth=".8" opacity=".8" />
        <g transform="translate(195 300)" fill="none" stroke="url(#au)" strokeWidth="1" strokeLinecap="round">
          <path d="M0-30C-9-18-9-6 0 0C9-6 9-18 0-30ZM0 0C-16-4-28-16-30-32C-16-30-4-18 0 0ZM0 0C16-4 28-16 30-32C16-30 4-18 0 0ZM0 0C-6 10-6 20 0 28C6 20 6 10 0 0Z" />
        </g>
        <text x="195" y="380" textAnchor="middle" fill="#8E7646" style={{ ...caps, fontSize: 15, letterSpacing: "0.32em" }}>{pairOf(t).toUpperCase()}</text>
        <path d="M168 400H222" stroke="url(#au)" strokeWidth=".8" />
        <text x="195" y="424" textAnchor="middle" fill="#8E7646" style={{ ...caps, fontSize: 9.6, letterSpacing: "0.3em" }}>{t.dateLabel.toUpperCase()}</text>
      </Layer>
    </div>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 340, anchor: "mid", scale: 0.84 },
  coverInk: "#8E7646",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="vellum"]'), { yPercent: -108, duration: 2.4, ease: "power2.inOut" }, 0.1)
      .fromTo(q(".hero-scene"), { scale: 1.06 }, { scale: 1, duration: 2.6, ease: "power2.out" }, 0.1)
      .from(q('[data-role="orchid-a"]'), { xPercent: 6, yPercent: -4, duration: 2.2, ease: "power2.out" }, 0.4)
      .from(q('[data-role="orchid-b"]'), { xPercent: -6, yPercent: 4, duration: 2.2, ease: "power2.out" }, 0.4)
      .set(q(".cover"), { opacity: 0 }, 2.5);
  },
};

export default art;
