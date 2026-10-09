import React from "react";
import { Layer, BananaLeaf, BrassLamp, Bush, Cluster, Garland, Gopuram, Leaf, Marigold, Palm, Petals, archD, linePts, ridge, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { Plate, openDoors } from "./_shared";

const MG: ["marigold" | "jasmine", "marigold" | "saffron" | "white"][] = [["marigold", "marigold"], ["marigold", "saffron"], ["jasmine", "white"]];

function BananaTree({ x, y, flip }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -0.56 : 0.56} 0.56)`}>
      <path d="M-7 0C-6-60-4-110-2-160H6C6-110 8-60 9 0Z" fill="#8FA65E" />
      <path d="M-7 0C-6-60-4-110-2-160H6C6-110 8-60 9 0Z" fill="url(#shade-side)" />
      {[[-58, 220, "leaf"], [-28, 250, "deep"], [4, 262, "leaf"], [34, 240, "deep"], [62, 200, "leaf"], [-82, 170, "deep"]].map(([r, len, c], i) => (
        <BananaLeaf key={i} x={2} y={-150} r={r as number} len={len as number} c={c as "leaf"} />
      ))}
    </g>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="th-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F6DDAA" />
            <stop offset=".35" stopColor="#FDEFCB" />
            <stop offset=".6" stopColor="#FFF8E6" />
          </linearGradient>
          <linearGradient id="th-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F3E1B8" />
            <stop offset="1" stopColor="#D9BE86" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#th-sky)" />
        <circle cx="195" cy="300" r="280" fill="url(#glow-sun)" />
        <path d={ridge(4, 438, 18, { freq: 1.4 })} fill="#E6D3A6" />
      </Layer>
      <Layer depth={0.14} role="palms">
        <Palm x={28} y={446} h={250} lean={34} c="olive" s={1} o={0.75} />
        <Palm x={362} y={446} h={230} lean={-30} c="olive" s={1} o={0.75} />
        <Palm x={92} y={446} h={170} lean={-14} c="moss" s={0.9} o={0.6} />
        <Palm x={304} y={446} h={160} lean={16} c="moss" s={0.9} o={0.6} />
      </Layer>
      <Layer depth={0.26} role="temple">
        <Gopuram x={195} y={446} s={1.0} />
        {/* compound wall */}
        <rect x="-20" y="398" width="126" height="48" fill="#F4E6C8" />
        <rect x="284" y="398" width="126" height="48" fill="#F4E6C8" />
        {Array.from({ length: 6 }, (_, i) => <rect key={i} x={-14 + i * 22} y="398" width="11" height="48" fill="#B5533C" opacity=".55" />)}
        {Array.from({ length: 6 }, (_, i) => <rect key={`r${i}`} x={288 + i * 22} y="398" width="11" height="48" fill="#B5533C" opacity=".55" />)}
        <rect x="-20" y="392" width="126" height="7" fill="#C9A866" />
        <rect x="284" y="392" width="126" height="7" fill="#C9A866" />
        <rect x="-20" y="444" width={VW + 40} height="440" fill="url(#th-floor)" />
        <path d="M-20 490H410M-20 560H410" stroke="#C4A56C" strokeOpacity=".3" strokeWidth="1" />
      </Layer>
      <Layer depth={0.44} role="banana" className="sc-soft">
        <BananaTree x={22} y={530} />
        <BananaTree x={368} y={530} flip />
      </Layer>
      <Layer depth={0.56} role="card">
        <Plate d={archD(195, 440, 272, 704, "cusped", 34)} fill="#FFFBF0" inner={archD(195, 450, 256, 696, "cusped", 30)} />
      </Layer>
      <Layer depth={0.7} role="toran" anchor="xMidYMin">
        <path d="M-20 26H410" stroke="#8A5A1C" strokeWidth="2" />
        {Array.from({ length: 28 }, (_, i) => <Leaf key={i} c={i % 2 ? "deep" : "leaf"} x={-6 + i * 15} y={26} r={180 + (i % 2 ? 6 : -6)} s={1.2} />)}
        {Array.from({ length: 27 }, (_, i) => <Marigold key={`m${i}`} x={1.5 + i * 15} y={28} s={0.36} c={i % 2 ? "saffron" : "marigold"} />)}
        {[[14, 250], [40, 170], [350, 170], [376, 250]].map(([x, len], i) => (
          <Garland key={x} pts={linePts(x, 34, x, len, Math.round(len / 19))} seed={i + 5} mix={MG} leaves={false} size={[0.44, 0.6]} jitter={3} />
        ))}
      </Layer>
      <Layer depth={0.82} role="lamps" anchor="xMidYMax">
        <BrassLamp x={40} y={826} s={1.16} />
        <BrassLamp x={350} y={826} s={1.16} />
      </Layer>
      <Layer depth={1} role="fore" anchor="xMidYMax" className="sc-soft">
        <Bush x={110} y={842} seed={3} count={16} spread={[40, 14]} greens={["deep", "leaf"]} size={[0.7, 1.2]} />
        <Cluster x={110} y={836} seed={5} count={8} spread={[44, 14]} mix={MG} greens={["deep"]} sprigs={0} size={[0.6, 1.05]} />
        <Bush x={280} y={842} seed={8} count={16} spread={[40, 14]} greens={["deep", "leaf"]} size={[0.7, 1.2]} />
        <Cluster x={280} y={836} seed={11} count={8} spread={[44, 14]} mix={MG} greens={["deep"]} sprigs={0} size={[0.6, 1.05]} />
        <Petals seed={5} count={5} c="marigold" box={[60, 700, 270, 120]} size={[4, 7]} />
      </Layer>
    </>
  );
}

function Door({ side }: { side: "l" | "r" }) {
  const l = side === "l";
  const x0 = l ? 44 : 195;
  return (
    <g data-role={`door-${side}`}>
      <rect x={x0} y="96" width="151" height="790" fill="url(#wood)" />
      {[120, 330, 560].map((y, k) => (
        <g key={y}>
          <rect x={x0 + 14} y={y} width="123" height={k === 2 ? 250 : 190} fill="#3A2010" opacity=".5" />
          <rect x={x0 + 14} y={y} width="123" height={k === 2 ? 250 : 190} fill="url(#pat-carve)" />
          <rect x={x0 + 14} y={y} width="123" height={k === 2 ? 250 : 190} fill="none" stroke="#D9B463" strokeOpacity=".7" strokeWidth="1.2" />
        </g>
      ))}
      {[104, 318, 532, 820].map((y) => <rect key={y} x={x0} y={y} width="151" height="9" fill="url(#au-v)" />)}
      {Array.from({ length: 15 }, (_, i) => <circle key={i} cx={l ? x0 + 144 : x0 + 7} cy={126 + i * 50} r="3" fill="url(#au-r)" />)}
      <g transform={`translate(${l ? 178 : 212} 540)`}>
        <circle r="8" fill="url(#au-r)" />
        <circle cy="13" r="10" fill="none" stroke="url(#au)" strokeWidth="2.8" />
      </g>
      <rect x={x0} y="96" width="151" height="790" fill="url(#shade-side)" opacity=".6" />
      <rect data-role="door-shade" x={x0} y="96" width="151" height="790" fill="#140A04" opacity="0" />
    </g>
  );
}

function Cover() {
  return (
    <Layer>
      <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="#F1DFB8" data-role="door-wall-bg" opacity="0" />
      <rect data-role="door-glow" x="191" y="100" width="8" height="780" fill="#FFF0C4" opacity="0" filter="url(#f-blur3)" />
      <Door side="l" />
      <Door side="r" />
      {/* stone doorway */}
      <path d="M-20-20H410V884H-20ZM44 96V884H346V96Z" fill="#EBD8AE" fillRule="evenodd" />
      <path d="M-20-20H410V884H-20ZM44 96V884H346V96Z" fill="url(#pat-carve)" fillRule="evenodd" opacity=".7" />
      <path d="M44 884V96H346V884" fill="none" stroke="#B4832A" strokeWidth="2.4" />
      <path d="M36 884V88H354V884" fill="none" stroke="#B4832A" strokeWidth="1" />
      <rect x="-20" y="60" width={VW + 40} height="22" fill="#D9BE86" />
      <path d="M195 30l10 16h-20z" fill="url(#au-v)" />
      <circle cx="195" cy="52" r="5" fill="url(#au-r)" />
    </Layer>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 584, anchor: "mid", scale: 0.76 },
  open(root, tl) {
    openDoors(root, tl, 44, 346);
    const q = (s: string) => root.querySelectorAll(s);
    tl.from(q('[data-role="card"]'), { yPercent: 4, opacity: 0, duration: 1.3, ease: "power2.out" }, 1.6)
      .from(q('[data-role="lamps"]'), { opacity: 0, duration: 1.2 }, 1.8);
  },
};

export default art;
