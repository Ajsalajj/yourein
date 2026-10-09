import React from "react";
import { Layer, ArchWall, Bush, Cluster, Lantern, Palace, Stars, Treeline, archD, VW, VH } from "../kit";
import type { ArtModule } from "../types";

const OUT = { top: 120, w: 330 };
const INN = { top: 172, w: 290 };
const STAR = "M0-22L5.6-13.6L15.6-15.6L13.6-5.6L22 0L13.6 5.6L15.6 15.6L5.6 13.6L0 22L-5.6 13.6L-15.6 15.6L-13.6 5.6L-22 0L-13.6-5.6L-15.6-15.6L-5.6-13.6Z";

function Rosette({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d={STAR} fill="none" stroke="url(#au)" strokeWidth="1.3" />
      <circle r="9" fill="none" stroke="url(#au)" strokeWidth="1" />
      <circle r="3" fill="url(#au)" />
    </g>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="re-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#04180F" />
            <stop offset=".45" stopColor="#0B3529" />
            <stop offset=".72" stopColor="#3E4B2C" />
            <stop offset=".8" stopColor="#8A6A30" />
          </linearGradient>
          <linearGradient id="re-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1B4A39" />
            <stop offset="1" stopColor="#061C15" />
          </linearGradient>
          <linearGradient id="re-carpet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#B43A3C" />
            <stop offset="1" stopColor="#6E1620" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#re-sky)" />
        <Stars seed={6} count={46} y0={130} y1={470} color="#F6E7B8" />
        <circle cx="195" cy="640" r="270" fill="url(#glow-warm)" opacity=".8" />
      </Layer>
      <Layer depth={0.18} role="palace">
        <Treeline seed={4} x0={10} x1={120} y={670} h={30} fill="#0A2A20" fill2="#0E3529" count={7} spires={0.5} />
        <Treeline seed={9} x0={270} x1={380} y={670} h={30} fill="#0A2A20" fill2="#0E3529" count={7} spires={0.5} />
        <rect x="-20" y="666" width={VW + 40} height="200" fill="url(#re-floor)" />
        <ellipse cx="195" cy="676" rx="170" ry="16" fill="#FFD98A" opacity=".22" filter="url(#f-blur8)" />
        <Palace x={195} y={668} s={1.12} col={{ wall: "#EBD4A4", shade: "#A98549", open: "#FFE3A2", dome: "#F4E2B8", lit: true }} />
        <path d="M181 668H209L262 864H128Z" fill="url(#re-carpet)" />
        <path d="M181 668L128 864M209 668L262 864" stroke="url(#au)" strokeWidth="1.6" fill="none" />
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <circle cx={150 - i * 22} cy={700 + i * 44} r={2 + i * 0.7} fill="#FFE3A2" />
            <circle cx={150 - i * 22} cy={700 + i * 44} r={10 + i * 4} fill="url(#glow-warm)" opacity=".7" />
            <circle cx={240 + i * 22} cy={700 + i * 44} r={2 + i * 0.7} fill="#FFE3A2" />
            <circle cx={240 + i * 22} cy={700 + i * 44} r={10 + i * 4} fill="url(#glow-warm)" opacity=".7" />
          </g>
        ))}
      </Layer>
      <Layer depth={0.36} role="arch-in">
        <ArchWall top={INN.top} w={INN.w} kind="cusped" fill="#10402F" pattern="pat-ogee" patternOpacity={0.14} trim="url(#au)" trimWidth={2.4} />
        {[50, 340].map((x) => (
          <g key={x}>
            <rect x={x - 7} y="430" width="14" height="440" fill="#0B2F24" />
            <rect x={x - 7} y="430" width="14" height="440" fill="url(#shade-side)" />
            <path d={`M${x - 12} 430h24l-4-10h-16zM${x - 10} 420h20v-5h-20z`} fill="url(#au-h)" />
            <path d={`M${x - 7} 440v430M${x + 7} 440v430`} stroke="url(#au)" strokeWidth=".8" />
          </g>
        ))}
      </Layer>
      <Layer depth={0.55} role="arch-out">
        <ArchWall top={OUT.top} w={OUT.w} kind="cusped" fill="#0A2B21" pattern="pat-ogee" patternOpacity={0.16} trim="url(#au)" trimWidth={2.8} />
        <Rosette x={46} y={176} s={0.9} />
        <Rosette x={344} y={176} s={0.9} />
        <path d="M6 96H384" stroke="url(#au)" strokeWidth="1" opacity=".8" />
        <path d="M6 102H384" stroke="url(#au)" strokeWidth=".5" opacity=".7" />
      </Layer>
      <Layer depth={0.76} role="lanterns">
        <Lantern x={70} y={394} drop={420} s={1.2} />
        <Lantern x={320} y={394} drop={420} s={1.2} />
        <Lantern x={104} y={300} drop={330} s={0.74} />
        <Lantern x={286} y={300} drop={330} s={0.74} />
      </Layer>
      <Layer depth={1} role="fore" className="sc-soft">
        <Bush x={6} y={800} seed={5} count={34} spread={[66, 46]} greens={["emerald", "deep", "gilt"]} size={[0.8, 1.5]} />
        <Bush x={384} y={804} seed={11} count={34} spread={[66, 46]} greens={["emerald", "deep", "gilt"]} size={[0.8, 1.5]} />
        <Cluster x={20} y={792} seed={7} count={7} spread={[44, 30]} mix={[["jasmine", "white"], ["rose", "ivory"], ["bud", "white"]]} greens={["gilt"]} sprigs={4} sprigLen={[50, 90]} size={[0.5, 1]} />
        <Cluster x={370} y={796} seed={15} count={7} spread={[44, 30]} mix={[["jasmine", "white"], ["rose", "ivory"], ["bud", "white"]]} greens={["gilt"]} sprigs={4} sprigLen={[50, 90]} size={[0.5, 1]} />
      </Layer>
    </>
  );
}

function Leaf2({ side }: { side: "l" | "r" }) {
  const l = side === "l";
  const x0 = l ? 30 : 195;
  return (
    <g data-role={`door-${side}`} clipPath={`url(#re-clip-${side})`}>
      <rect x={x0} y="100" width="165" height="780" fill="url(#re-door)" />
      {/* arched upper panel */}
      <path d={archD(195, 150, 270, 300, "cusped")} fill="none" stroke="url(#au)" strokeWidth="1.4" />
      <g transform="translate(195 262)">
        <path d={STAR} transform="scale(2.5)" fill="#0E3C2E" stroke="url(#au)" strokeWidth=".7" />
        <path d={STAR} transform="scale(1.5) rotate(22.5)" fill="none" stroke="url(#au)" strokeWidth=".9" />
        <circle r="13" fill="none" stroke="url(#au)" strokeWidth="1.2" />
      </g>
      {/* lattice panel */}
      <rect x={l ? 50 : 207} y="336" width="133" height="210" fill="#082219" />
      <rect x={l ? 50 : 207} y="336" width="133" height="210" fill="url(#pat-jali)" opacity=".85" />
      <rect x={l ? 50 : 207} y="336" width="133" height="210" fill="none" stroke="url(#au)" strokeWidth="1.6" />
      <rect x={l ? 44 : 201} y="330" width="145" height="222" fill="none" stroke="url(#au)" strokeWidth=".6" />
      {/* lower panel */}
      <rect x={l ? 50 : 207} y="580" width="133" height="250" fill="#0C3327" />
      <rect x={l ? 50 : 207} y="580" width="133" height="250" fill="url(#pat-ogee)" opacity=".2" />
      <rect x={l ? 50 : 207} y="580" width="133" height="250" fill="none" stroke="url(#au)" strokeWidth="1.2" />
      {/* studs */}
      {Array.from({ length: 16 }, (_, i) => (
        <circle key={i} cx={l ? 189 : 201} cy={150 + i * 46} r="2.2" fill="url(#au-r)" />
      ))}
      {/* ring handle */}
      <g transform={`translate(${l ? 176 : 214} 566)`}>
        <circle r="6.5" fill="url(#au-r)" />
        <circle cy="11" r="9" fill="none" stroke="url(#au)" strokeWidth="2.4" />
      </g>
      <rect x={x0} y="100" width="165" height="780" fill="url(#shade-side)" opacity={l ? 0.5 : 0.8} />
      <rect data-role="door-shade" x={x0} y="100" width="165" height="780" fill="#020B08" opacity="0" />
    </g>
  );
}

function Cover() {
  const hole = archD(195, OUT.top, OUT.w, VH + 20, "cusped");
  return (
    <Layer>
      <defs>
        <linearGradient id="re-door" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#0B3125" />
          <stop offset=".5" stopColor="#12493A" />
          <stop offset="1" stopColor="#0B3125" />
        </linearGradient>
        <clipPath id="re-clip-l"><path d={hole} /></clipPath>
        <clipPath id="re-clip-r"><path d={hole} /></clipPath>
      </defs>
      <rect data-role="door-glow" x="191" y="130" width="8" height="740" fill="#FFE3A2" opacity=".0" filter="url(#f-blur3)" />
      <g data-role="doors">
        <Leaf2 side="l" />
        <Leaf2 side="r" />
        <path data-role="door-seam" d="M195 122V870" stroke="#041511" strokeWidth="1.4" />
        <path d={hole} fill="none" stroke="url(#au)" strokeWidth="2.8" />
      </g>
    </Layer>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 318, anchor: "mid", width: 0.5, widthTall: 0.4 },
  coverInk: "#F0DDA6",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="door-seam"]'), { opacity: 0, duration: 0.3 }, 0.25)
      .fromTo(q('[data-role="door-glow"]'), { opacity: 0 }, { opacity: 0.9, duration: 0.5, ease: "power1.in" }, 0)
      .to(q('[data-role="door-l"]'), { scaleX: 0.03, skewY: 7, svgOrigin: "30 500", duration: 2.3, ease: "power2.inOut" }, 0.3)
      .to(q('[data-role="door-r"]'), { scaleX: 0.03, skewY: -7, svgOrigin: "360 500", duration: 2.3, ease: "power2.inOut" }, 0.3)
      .to(q('[data-role="door-shade"]'), { opacity: 0.55, duration: 2.1, ease: "power1.in" }, 0.4)
      .to(q('[data-role="door-glow"]'), { scaleX: 46, opacity: 0, svgOrigin: "195 500", duration: 1.8, ease: "power2.out" }, 0.5)
      .fromTo(q(".hero-scene"), { scale: 1.1 }, { scale: 1, duration: 3.2, ease: "power2.out" }, 0.3)
      .from(q('[data-role="palace"]'), { opacity: 0.2, duration: 1.8, ease: "power1.out" }, 0.5)
      .from(q('[data-role="lanterns"]'), { yPercent: -5, opacity: 0, duration: 1.6, ease: "power2.out" }, 1.2)
      .to(q(".cover"), { opacity: 0, duration: 0.5 }, 2.5);
  },
};

export default art;
