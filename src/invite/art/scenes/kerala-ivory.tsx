import React from "react";
import { Layer, BananaLeaf, BrassLamp, Cluster, Garland, KeralaHouse, Palm, Petals, linePts, quadPts, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { Plate, openDoors } from "./_shared";

const JAS: ["jasmine" | "bud", "white" | "ivory"][] = [["jasmine", "white"], ["jasmine", "white"], ["bud", "ivory"]];

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="ki-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D5E6DD" />
            <stop offset=".3" stopColor="#F0F1DC" />
            <stop offset=".56" stopColor="#FFF8E6" />
          </linearGradient>
          <linearGradient id="ki-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F1E6C6" />
            <stop offset="1" stopColor="#DCC998" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#ki-sky)" />
        <circle cx="270" cy="250" r="240" fill="url(#glow-sun)" opacity=".8" />
      </Layer>
      <Layer depth={0.14} role="palms-far">
        <Palm x={66} y={434} h={290} lean={-30} c="moss" s={0.9} o={0.55} />
        <Palm x={330} y={434} h={310} lean={26} c="moss" s={0.9} o={0.55} />
        <Palm x={200} y={434} h={320} lean={-10} c="moss" s={0.8} o={0.4} />
      </Layer>
      <Layer depth={0.22} role="palms">
        <Palm x={20} y={440} h={260} lean={40} c="deep" s={1.1} />
        <Palm x={372} y={440} h={240} lean={-36} c="deep" s={1.1} />
      </Layer>
      <Layer depth={0.32} role="house">
        <rect x="-20" y="430" width={VW + 40} height="450" fill="url(#ki-ground)" />
        <KeralaHouse x={195} y={436} s={0.94} />
        <path d="M-20 500H410M-20 600H410" stroke="#C4AE78" strokeOpacity=".25" strokeWidth="1" />
      </Layer>
      <Layer depth={0.52} role="card">
        <Plate d="M58 452h274a3 3 0 0 1 3 3v248a3 3 0 0 1-3 3h-274a3 3 0 0 1-3-3v-248a3 3 0 0 1 3-3Z" fill="#FFFDF5" />
        <rect x="63" y="460" width="264" height="238" fill="none" stroke="url(#au-h)" strokeWidth="5" />
        <rect x="71" y="468" width="248" height="222" fill="none" stroke="url(#au)" strokeWidth=".7" />
      </Layer>
      <Layer depth={0.68} role="jasmine" anchor="xMidYMin">
        <Garland pts={quadPts([-12, 20], [92, 92], [195, 26], 26)} seed={3} mix={JAS} leaves={false} size={[0.4, 0.56]} jitter={3} />
        <Garland pts={quadPts([195, 26], [298, 92], [402, 20], 26)} seed={7} mix={JAS} leaves={false} size={[0.4, 0.56]} jitter={3} />
        {[[14, 300], [38, 210], [62, 140], [328, 140], [352, 210], [376, 300]].map(([x, len], i) => (
          <g key={x}>
            <Garland pts={linePts(x, 20, x, len, Math.round(len / 13))} seed={i + 12} mix={JAS} leaves={false} size={[0.38, 0.5]} jitter={2.4} />
            <circle cx={x} cy={len + 8} r="4.6" fill="#F7961F" stroke="#CF650B" strokeOpacity=".5" strokeWidth=".5" />
          </g>
        ))}
      </Layer>
      <Layer depth={0.82} role="lamps" anchor="xMidYMax">
        <BrassLamp x={36} y={826} s={1.14} />
        <BrassLamp x={354} y={826} s={1.14} />
      </Layer>
      <Layer depth={1} role="fore" anchor="xMidYMax" className="sc-soft">
        <BananaLeaf x={-24} y={870} r={40} len={150} c="deep" />
        <BananaLeaf x={-26} y={850} r={74} len={120} c="leaf" />
        <BananaLeaf x={414} y={870} r={-40} len={150} c="deep" />
        <BananaLeaf x={416} y={850} r={-74} len={120} c="leaf" />
        <Cluster x={110} y={838} seed={4} count={7} spread={[40, 12]} mix={JAS} greens={["deep"]} sprigs={3} sprigLen={[26, 44]} size={[0.6, 1]} />
        <Cluster x={280} y={838} seed={9} count={7} spread={[40, 12]} mix={JAS} greens={["deep"]} sprigs={3} sprigLen={[26, 44]} size={[0.6, 1]} />
        <Petals seed={6} count={5} c="white" box={[60, 700, 270, 110]} size={[4, 7]} />
      </Layer>
    </>
  );
}

function Door({ side }: { side: "l" | "r" }) {
  const l = side === "l";
  const x0 = l ? 62 : 195;
  return (
    <g data-role={`door-${side}`}>
      <rect x={x0} y="128" width="133" height="760" fill="url(#wood)" />
      {[150, 400, 640].map((y, k) => (
        <g key={y}>
          <rect x={x0 + 13} y={y} width="107" height={k === 0 ? 226 : 216} fill="#2E180B" opacity=".45" />
          <rect x={x0 + 13} y={y} width="107" height={k === 0 ? 226 : 216} fill="url(#pat-carve)" />
          <rect x={x0 + 13} y={y} width="107" height={k === 0 ? 226 : 216} fill="none" stroke="#E0BD6A" strokeOpacity=".6" strokeWidth="1" />
          <circle cx={x0 + 66.5} cy={y + (k === 0 ? 113 : 108)} r="13" fill="url(#au-r)" />
          <circle cx={x0 + 66.5} cy={y + (k === 0 ? 113 : 108)} r="5" fill="#8C6827" />
        </g>
      ))}
      {Array.from({ length: 16 }, (_, i) => <circle key={i} cx={l ? x0 + 127 : x0 + 6} cy={150 + i * 46} r="2.8" fill="url(#au-r)" />)}
      <rect x={x0} y="128" width="133" height="760" fill="url(#shade-side)" opacity=".6" />
      <rect data-role="door-shade" x={x0} y="128" width="133" height="760" fill="#120904" opacity="0" />
    </g>
  );
}

function Cover() {
  return (
    <Layer>
      <rect data-role="door-glow" x="191" y="130" width="8" height="760" fill="#FFF3CE" opacity="0" filter="url(#f-blur3)" />
      <Door side="l" />
      <Door side="r" />
      <g data-role="door-seam" transform="translate(195 560)">
        <rect x="-15" y="-22" width="30" height="44" rx="4" fill="url(#au-h)" />
        <circle r="7" fill="#8C6827" />
        <path d="M-2-2h4v10h-4z" fill="#3A2408" />
      </g>
      {/* ivory wall with kasavu bands around the doorway */}
      <path d="M-20-20H410V884H-20ZM62 128V884H328V128Z" fill="#FBF6E8" fillRule="evenodd" />
      <path d="M52 884V118H338V884" fill="none" stroke="url(#wood)" strokeWidth="20" />
      <path d="M40 884V106H350V884" fill="none" stroke="url(#au-h)" strokeWidth="4" />
      <path d="M32 884V98H358V884" fill="none" stroke="url(#au)" strokeWidth="1" />
      <rect x="-20" y="54" width={VW + 40} height="10" fill="url(#au-h)" />
      <rect x="-20" y="70" width={VW + 40} height="2" fill="url(#au-h)" />
      <Garland pts={quadPts([52, 116], [195, 190], [338, 116], 30)} seed={5} mix={JAS} leaves={false} size={[0.4, 0.54]} jitter={3} />
      <BrassLamp x={24} y={800} s={0.9} />
      <BrassLamp x={366} y={800} s={0.9} />
    </Layer>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 582, anchor: "mid", scale: 0.76 },
  open(root, tl) {
    openDoors(root, tl, 62, 328);
    const q = (s: string) => root.querySelectorAll(s);
    tl.from(q('[data-role="card"]'), { yPercent: 4, opacity: 0, duration: 1.3, ease: "power2.out" }, 1.6)
      .from(q('[data-role="jasmine"]'), { yPercent: -6, opacity: 0, duration: 1.4, ease: "power2.out" }, 1.5);
  },
};

export default art;
