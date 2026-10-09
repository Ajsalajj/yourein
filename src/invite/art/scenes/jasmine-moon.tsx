import React from "react";
import { Layer, ArchWall, Bush, Clouds, Cluster, Crescent, Garland, Lantern, Palace, Stars, linePts, quadPts, VW, VH } from "../kit";
import type { ArtModule } from "../types";

const JAS: ["jasmine" | "bud" | "blossom", "white" | "night"][] = [["jasmine", "white"], ["jasmine", "white"], ["bud", "white"], ["blossom", "night"]];
const col = { wall: "#EAD7AC", shade: "#A88A52", open: "#FFE19C", dome: "#F5E5BC", lit: true };

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="jm-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#060A20" />
            <stop offset=".45" stopColor="#111C48" />
            <stop offset=".78" stopColor="#35407A" />
            <stop offset=".86" stopColor="#6E5E7A" />
          </linearGradient>
          <linearGradient id="jm-pool" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2B376D" />
            <stop offset="1" stopColor="#0A1030" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#jm-sky)" />
        <Stars seed={4} count={90} y0={90} y1={560} />
        <Clouds seed={8} count={3} y={470} spreadY={50} color="#8E9AD0" o={0.25} />
      </Layer>
      <Layer depth={0.12} role="moon">
        <Crescent x={195} y={188} R={25} r={-28} />
      </Layer>
      <Layer depth={0.22} role="mosque">
        <circle cx="195" cy="650" r="230" fill="url(#glow-warm)" opacity=".5" />
        <rect x="-20" y="694" width={VW + 40} height="180" fill="url(#jm-pool)" />
        <g transform="translate(195 698) scale(1.12 -0.9)" opacity=".2"><Palace mosque col={col} /></g>
        <Palace x={195} y={694} s={1.12} mosque col={col} />
        <path d="M60 720H330M40 748H350M10 782H380" stroke="#FFE19C" strokeOpacity=".16" strokeWidth="1" />
        <rect x="-20" y="692" width={VW + 40} height="6" fill="#C9AE74" opacity=".5" />
      </Layer>
      <Layer depth={0.42} role="arch">
        <ArchWall top={104} w={326} kind="pointed" rise={250} fill="#0A1130" pattern="pat-ogee" patternOpacity={0.1} trim="url(#au)" trimWidth={2.6} />
        {[32, 358].map((x) => (
          <g key={x}>
            <rect x={x - 6} y="354" width="12" height="520" fill="#0E1638" />
            <rect x={x - 6} y="354" width="12" height="520" fill="url(#shade-side)" />
            <path d={`M${x - 11} 356h22l-4-9h-14zM${x - 9} 347h18v-5h-18z`} fill="url(#au-h)" />
          </g>
        ))}
        <path d="M195 64l5 12 12 5-12 5-5 12-5-12-12-5 12-5z" fill="url(#au)" />
      </Layer>
      <Layer depth={0.7} role="lanterns">
        <Lantern x={60} y={420} drop={440} s={1.12} />
        <Lantern x={330} y={420} drop={440} s={1.12} />
        <Lantern x={92} y={222} drop={250} s={0.66} />
        <Lantern x={298} y={222} drop={250} s={0.66} />
      </Layer>
      <Layer depth={0.86} role="jasmine-a" className="sc-soft">
        <Garland pts={quadPts([392, 250], [330, 420], [386, 640], 16)} seed={5} mix={JAS} greens={["night", "deep"]} size={[0.5, 1]} jitter={22} />
        <Garland pts={linePts(372, 560, 392, 850, 10)} seed={9} mix={JAS} greens={["night", "deep"]} size={[0.6, 1.2]} jitter={30} />
        <Cluster x={372} y={770} seed={12} count={12} spread={[50, 70]} mix={JAS} greens={["deep", "night"]} sprigs={7} sprigLen={[50, 100]} size={[0.7, 1.35]} />
      </Layer>
      <Layer depth={1} role="jasmine-b" className="sc-soft">
        <Bush x={6} y={800} seed={3} count={30} spread={[62, 50]} greens={["deep", "night", "emerald"]} size={[0.8, 1.5]} />
        <Cluster x={18} y={790} seed={7} count={12} spread={[58, 56]} mix={JAS} greens={["deep", "night"]} sprigs={6} sprigLen={[50, 100]} size={[0.7, 1.4]} />
        <Garland pts={quadPts([-4, 520], [44, 640], [0, 760], 10)} seed={15} mix={JAS} greens={["night", "deep"]} size={[0.5, 1]} jitter={20} />
      </Layer>
    </>
  );
}

function Cover() {
  return (
    <>
      <div className="cv-solid" data-role="dark" style={{ background: "radial-gradient(120% 80% at 50% 30%, #0B1230 0%, #050817 70%)" }} />
      <Layer role="dark-mark">
        <Crescent x={195} y={330} R={30} r={-28} glow={false} fill="none" />
        <path d="M195 300A30 30 0 1 0 195 360A39.6 39.6 0 0 1 195 300Z" transform="rotate(-28 195 330)" fill="none" stroke="url(#au)" strokeWidth="1" opacity=".8" />
        <path d="M150 400H240" stroke="url(#au)" strokeWidth=".7" opacity=".7" />
      </Layer>
    </>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 338, anchor: "mid" },
  coverInk: "#E6CE92",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="dark-mark"]'), { opacity: 0, duration: 0.5 }, 0)
      .set(q('[data-role="mosque"], [data-role="lanterns"], [data-role="jasmine-a"], [data-role="jasmine-b"], [data-role="arch"]'), { opacity: 0 }, 0)
      .to(q('[data-role="dark"]'), { opacity: 0, duration: 1.6, ease: "power1.inOut" }, 0.4)
      .fromTo(q('[data-role="moon"]'), { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 1.4, ease: "power2.out" }, 0.3)
      .to(q('[data-role="arch"]'), { opacity: 1, duration: 1.2, ease: "power1.out" }, 1)
      .to(q('[data-role="mosque"]'), { opacity: 1, duration: 1.4, ease: "power1.out" }, 1.3)
      .to(q('[data-role="lanterns"]'), { opacity: 1, duration: 0.9, ease: "power1.out" }, 1.7)
      .fromTo(q('[data-role="jasmine-a"]'), { opacity: 0, xPercent: 8 }, { opacity: 1, xPercent: 0, duration: 1.3, ease: "power2.out" }, 2.2)
      .fromTo(q('[data-role="jasmine-b"]'), { opacity: 0, xPercent: -8 }, { opacity: 1, xPercent: 0, duration: 1.3, ease: "power2.out" }, 2.4)
      .set(q(".cover"), { opacity: 0 }, 2.6);
  },
};

export default art;
