import React from "react";
import { Layer, ArchWall, Bush, Clouds, Cluster, Garland, Palace, Petals, Treeline, archD, quadPts, ridge, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { openDoors } from "./_shared";

const OUT = { top: 122, w: 328 };
const col = { wall: "#FBF1D9", shade: "#C6A15C", open: "#B98D4B", dome: "#F0CF83" };
const PINK: ["cherry" | "rose" | "blossom", "pink" | "rose" | "ivory"][] = [["cherry", "pink"], ["rose", "rose"], ["blossom", "ivory"], ["cherry", "pink"]];

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="gp-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F7D99C" />
            <stop offset=".4" stopColor="#FDECC4" />
            <stop offset=".75" stopColor="#FFF9EA" />
          </linearGradient>
          <linearGradient id="gp-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FCF2DC" />
            <stop offset="1" stopColor="#E6CC98" />
          </linearGradient>
          <linearGradient id="gp-pool" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E3EEE6" />
            <stop offset="1" stopColor="#A4C6C6" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#gp-sky)" />
        <circle cx="195" cy="400" r="290" fill="url(#glow-sun)" />
        <Clouds seed={4} count={4} y={470} spreadY={70} color="#fff" o={0.8} />
        <path d={ridge(6, 640, 22, { freq: 1.3 })} fill="#EBD5A6" />
      </Layer>
      <Layer depth={0.18} role="palace">
        <Treeline seed={3} x0={0} x1={110} y={690} h={30} fill="#B7B87C" fill2="#A3A868" count={7} spires={0.45} />
        <Treeline seed={8} x0={280} x1={390} y={690} h={30} fill="#B7B87C" fill2="#A3A868" count={7} spires={0.45} />
        <rect x="-20" y="688" width={VW + 40} height="190" fill="url(#gp-floor)" />
        <Palace x={195} y={690} s={1.2} col={col} />
        {[-260, -120, 20, 370, 510, 650].map((x) => <path key={x} d={`M${195 + (x - 195) * 0.3} 696L${x} 870`} stroke="#C9AE74" strokeOpacity=".4" strokeWidth="1" />)}
        <path d="M-20 730H410M-20 780H410" stroke="#C9AE74" strokeOpacity=".3" strokeWidth="1" />
        <path d="M181 694H209L262 866H128Z" fill="url(#gp-pool)" />
        <path d="M181 694L128 866M209 694L262 866" stroke="url(#au)" strokeWidth="1.8" fill="none" />
        <path d="M187 760q8-26 16 0M183 800q12-34 24 0" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".9" />
        <ellipse cx="195" cy="700" rx="150" ry="10" fill="#fff" opacity=".5" filter="url(#f-blur8)" />
      </Layer>
      <Layer depth={0.36} role="arch-in">
        <ArchWall top={176} w={288} kind="cusped" fill="#F4E3BA" pattern="pat-ogee" patternOpacity={0.5} trim="url(#au)" trimWidth={2.2} />
        {[51, 339].map((x) => (
          <g key={x}>
            <rect x={x - 8} y="436" width="16" height="440" fill="#EEDBAC" />
            <rect x={x - 8} y="436" width="16" height="440" fill="url(#shade-side)" />
            <path d={`M${x - 13} 436h26l-4-10h-18zM${x - 11} 426h22v-5h-22z`} fill="url(#au-h)" />
          </g>
        ))}
      </Layer>
      <Layer depth={0.55} role="arch-out">
        <ArchWall top={OUT.top} w={OUT.w} kind="cusped" fill="#FBF0D6" pattern="pat-ogee" patternOpacity={0.7} trim="url(#au)" trimWidth={2.8} />
        <path d="M6 98H384" stroke="url(#au)" strokeWidth="1" />
        <path d="M6 104H384" stroke="url(#au)" strokeWidth=".5" />
        {[46, 344].map((x) => (
          <g key={x} transform={`translate(${x} 178)`} fill="none" stroke="url(#au)">
            <circle r="14" strokeWidth="1.2" />
            <path d="M0-14C6-6 6 6 0 14C-6 6-6-6 0-14ZM-14 0C-6-6 6-6 14 0C6 6-6 6-14 0Z" strokeWidth=".9" />
          </g>
        ))}
      </Layer>
      <Layer depth={0.78} role="drape" className="sc-soft">
        <Garland pts={quadPts([-10, 96], [40, 250], [18, 430], 14)} seed={3} mix={PINK} greens={["leaf", "moss"]} size={[0.45, 0.95]} jitter={26} />
        <Garland pts={quadPts([400, 96], [350, 230], [374, 380], 12)} seed={8} mix={PINK} greens={["leaf", "moss"]} size={[0.45, 0.95]} jitter={26} />
        <Bush x={10} y={90} seed={5} count={26} spread={[60, 40]} greens={["leaf", "moss", "olive"]} size={[0.8, 1.4]} />
        <Cluster x={18} y={104} seed={6} count={9} spread={[56, 40]} mix={PINK} greens={["leaf"]} sprigs={3} size={[0.6, 1.2]} />
        <Bush x={384} y={90} seed={9} count={22} spread={[50, 36]} greens={["leaf", "moss", "olive"]} size={[0.8, 1.4]} />
        <Cluster x={378} y={100} seed={12} count={8} spread={[48, 36]} mix={PINK} greens={["leaf"]} sprigs={3} size={[0.6, 1.2]} />
      </Layer>
      <Layer depth={1} role="fore" className="sc-soft">
        <Bush x={6} y={806} seed={15} count={30} spread={[64, 46]} greens={["olive", "leaf", "gilt"]} size={[0.8, 1.5]} />
        <Cluster x={18} y={798} seed={18} count={9} spread={[52, 38]} mix={[["rose", "peach"], ["rose", "ivory"], ["marigold", "marigold"], ["blossom", "ivory"]]} greens={["olive"]} sprigs={5} sprigLen={[50, 90]} size={[0.6, 1.3]} />
        <Bush x={384} y={810} seed={21} count={30} spread={[64, 46]} greens={["olive", "leaf", "gilt"]} size={[0.8, 1.5]} />
        <Cluster x={372} y={800} seed={24} count={9} spread={[52, 38]} mix={[["rose", "ivory"], ["rose", "peach"], ["marigold", "marigold"], ["blossom", "ivory"]]} greens={["olive"]} sprigs={5} sprigLen={[50, 90]} size={[0.6, 1.3]} />
        <Petals seed={7} count={6} c="rose" box={[60, 470, 270, 300]} />
      </Layer>
    </>
  );
}

function Gate({ side }: { side: "l" | "r" }) {
  const l = side === "l";
  const x0 = l ? 31 : 195;
  const px = l ? 46 : 205;
  return (
    <g data-role={`door-${side}`} clipPath={`url(#gp-clip-${side})`}>
      <rect x={x0} y="100" width="164" height="780" fill="#FBF0D6" opacity=".5" />
      <rect x={x0} y="100" width="164" height="560" fill="url(#pat-jali)" />
      <rect x={px} y="330" width="139" height="320" fill="none" stroke="url(#au)" strokeWidth="3" />
      <path d={archD(195, 150, 276, 320, "cusped")} fill="none" stroke="url(#au)" strokeWidth="3" />
      <rect x={x0} y="660" width="164" height="220" fill="#EBD39A" />
      <rect x={x0} y="660" width="164" height="220" fill="url(#pat-ogee)" opacity=".6" />
      <rect x={px} y="676" width="139" height="170" fill="none" stroke="url(#au)" strokeWidth="1.6" />
      <rect x={x0} y="654" width="164" height="8" fill="url(#au-v)" />
      <rect x={l ? 186 : 195} y="100" width="9" height="780" fill="url(#au-h)" />
      <g transform={`translate(${l ? 178 : 212} 600)`}>
        <circle r="7" fill="url(#au-r)" />
        <circle cy="12" r="10" fill="none" stroke="url(#au)" strokeWidth="2.6" />
      </g>
      <rect data-role="door-shade" x={x0} y="100" width="164" height="780" fill="#5A3C10" opacity="0" />
    </g>
  );
}

function Cover() {
  const hole = archD(195, OUT.top, OUT.w, VH + 20, "cusped");
  return (
    <Layer>
      <defs>
        <clipPath id="gp-clip-l"><path d={hole} /></clipPath>
        <clipPath id="gp-clip-r"><path d={hole} /></clipPath>
      </defs>
      <rect data-role="door-glow" x="191" y="130" width="8" height="740" fill="#FFF6DA" opacity="0" filter="url(#f-blur3)" />
      <Gate side="l" />
      <Gate side="r" />
      <path d={hole} fill="none" stroke="url(#au)" strokeWidth="2.8" />
    </Layer>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 322, anchor: "mid" },
  coverInk: "#7A4B14",
  open(root, tl) {
    openDoors(root, tl, 31, 359);
    const q = (s: string) => root.querySelectorAll(s);
    tl.from(q('[data-role="drape"]'), { yPercent: -5, opacity: 0, duration: 1.6, ease: "power2.out" }, 1.4);
  },
};

export default art;
