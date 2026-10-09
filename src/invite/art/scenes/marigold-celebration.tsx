import React from "react";
import type { Template } from "@/data/templates";
import { Layer, BrassLamp, Bush, Cluster, Garland, Leaf, Mandap, Marigold, Petals, linePts, quadPts, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { Monogram } from "./_shared";

const MG: ["marigold", "marigold" | "saffron"][] = [["marigold", "marigold"], ["marigold", "saffron"], ["marigold", "marigold"]];

function Toran() {
  return (
    <g>
      <path d="M-20 92H410" stroke="#8A5A1C" strokeWidth="2" />
      {Array.from({ length: 28 }, (_, i) => <Leaf key={i} c={i % 2 ? "deep" : "leaf"} x={-6 + i * 15} y={92} r={180 + (i % 2 ? 6 : -6)} s={1.25} />)}
      {Array.from({ length: 27 }, (_, i) => <Marigold key={`m${i}`} x={1.5 + i * 15} y={94} s={0.36} c={i % 2 ? "saffron" : "marigold"} />)}
    </g>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="mc-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFE9B4" />
            <stop offset=".5" stopColor="#FFF4D8" />
            <stop offset="1" stopColor="#FCE4AC" />
          </linearGradient>
          <linearGradient id="mc-cloth" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#FFF6E0" />
            <stop offset=".5" stopColor="#F3DDA8" />
            <stop offset="1" stopColor="#FFF6E0" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#mc-bg)" />
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#pat-ogee)" opacity=".5" />
        <circle cx="195" cy="470" r="280" fill="url(#glow-sun)" />
      </Layer>
      <Layer depth={0.2}>
        {[-14, 26, 66, 284, 324, 364].map((x, i) => (
          <g key={x}>
            <rect x={x} y="80" width="40" height="700" fill="url(#mc-cloth)" opacity={i % 2 ? 0.9 : 0.7} />
          </g>
        ))}
        <rect x="-20" y="742" width={VW + 40} height="130" fill="#F5DDA4" />
        <rect x="-20" y="742" width={VW + 40} height="130" fill="url(#shade-down)" opacity=".3" />
      </Layer>
      <Layer depth={0.36} role="mandap">
        <ellipse cx="195" cy="760" rx="190" ry="14" fill="#8A5A1C" opacity=".25" filter="url(#f-blur8)" />
        <Mandap x={195} y={752} s={1.5} />
        <g transform="translate(195 812) scale(2.6 0.9)" opacity=".85"><Marigold c="marigold" /></g>
      </Layer>
      <Layer depth={0.56} role="swags">
        <Garland pts={quadPts([-12, 100], [92, 236], [195, 112], 20)} seed={4} mix={MG} leaves={false} size={[0.5, 0.7]} jitter={4} />
        <Garland pts={quadPts([195, 112], [298, 236], [402, 100], 20)} seed={9} mix={MG} leaves={false} size={[0.5, 0.7]} jitter={4} />
        <Garland pts={quadPts([-12, 96], [92, 168], [195, 104], 20)} seed={14} mix={[["jasmine", "white"]]} leaves={false} size={[0.36, 0.5]} jitter={3} />
        <Garland pts={quadPts([195, 104], [298, 168], [402, 96], 20)} seed={19} mix={[["jasmine", "white"]]} leaves={false} size={[0.36, 0.5]} jitter={3} />
        {[[16, 540], [44, 430], [346, 430], [374, 540]].map(([x, len], i) => (
          <Garland key={x} pts={linePts(x, 100, x, len, Math.round((len - 100) / 21))} seed={i + 22} mix={MG} leaves={false} size={[0.5, 0.66]} jitter={3} />
        ))}
        <Toran />
        <g transform="translate(195 120)"><Marigold s={1.1} /><Marigold y={24} s={0.7} c="saffron" /><Marigold y={42} s={0.5} /></g>
      </Layer>
      <Layer depth={0.74} anchor="xMidYMax" role="lamps">
        <BrassLamp x={44} y={828} s={1.08} />
        <BrassLamp x={346} y={828} s={1.08} />
      </Layer>
      <Layer depth={1} anchor="xMidYMax" role="fore" className="sc-soft">
        <Bush x={2} y={826} seed={5} count={24} spread={[50, 30]} greens={["deep", "leaf"]} size={[0.8, 1.4]} />
        <Cluster x={100} y={840} seed={8} count={8} spread={[50, 16]} mix={MG} greens={["deep"]} sprigs={3} sprigLen={[30, 50]} size={[0.6, 1.1]} />
        <Bush x={390} y={826} seed={11} count={24} spread={[50, 30]} greens={["deep", "leaf"]} size={[0.8, 1.4]} />
        <Cluster x={290} y={840} seed={14} count={8} spread={[50, 16]} mix={MG} greens={["deep"]} sprigs={3} sprigLen={[30, 50]} size={[0.6, 1.1]} />
        <Petals seed={6} count={7} c="marigold" box={[50, 480, 290, 240]} size={[4, 8]} />
      </Layer>
    </>
  );
}

function Curtain({ seed }: { seed: number }) {
  return (
    <>
      <rect x="-30" y="-20" width="228" height="890" fill="#FBE7B4" />
      {[0, 40, 80, 120, 160].map((x) => <rect key={x} x={x - 20} y="-20" width="20" height="890" fill="#C98A1C" opacity=".12" />)}
      {[6, 37, 68, 99, 130, 161, 190].map((x, i) => (
        <Garland key={x} pts={linePts(x, -6 + (i % 2) * 14, x, 856, 31)} seed={seed + i} mix={MG} leaves={false} size={[0.66, 0.8]} jitter={2.5} />
      ))}
    </>
  );
}

function Cover({ t }: { t: Template }) {
  return (
    <>
      <Layer role="cur-l"><Curtain seed={3} /></Layer>
      <Layer role="cur-r"><g transform="translate(390 0) scale(-1 1)"><Curtain seed={31} /></g></Layer>
      <Layer role="cur-top"><Toran /></Layer>
      <Layer role="cur-plate"><Monogram t={t} y={404} ink="#7A2E0C" fill="#FFF8E6" /></Layer>
    </>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 368, anchor: "mid", scale: 0.9 },
  coverInk: "#6A2D0F",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="cur-plate"]'), { opacity: 0, scale: 0.9, duration: 0.5 }, 0)
      .to(q('[data-role="cur-l"]'), { xPercent: -56, skewX: 3, duration: 2.6, ease: "power2.inOut" }, 0.2)
      .to(q('[data-role="cur-r"]'), { xPercent: 56, skewX: -3, duration: 2.6, ease: "power2.inOut" }, 0.2)
      .fromTo(q(".hero-scene"), { scale: 1.1 }, { scale: 1, duration: 3, ease: "power2.out" }, 0.2)
      .from(q('[data-role="mandap"]'), { opacity: 0.3, duration: 1.6 }, 0.6)
      .to(q(".cover"), { opacity: 0, duration: 0.6 }, 2.4);
  },
};

export default art;
