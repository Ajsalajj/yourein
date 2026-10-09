import React from "react";
import { Layer, Branch, Bush, Cluster, Petals, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { Plate } from "./_shared";

const MIX: ["rose" | "blossom" | "cherry" | "bud", "blush" | "peach" | "ivory" | "pink"][] = [["rose", "blush"], ["blossom", "ivory"], ["rose", "peach"], ["cherry", "pink"], ["bud", "blush"]];

function Folds({ flip }: { flip?: boolean }) {
  return (
    <g transform={flip ? "translate(390 844) scale(-1 -1)" : undefined}>
      <path d="M-20-20H290C230 50 150 80 90 150C40 208 0 236-20 250Z" fill="url(#satin-blush-h)" />
      <path d="M-20 40C60 30 150 10 250-20M-20 110C50 96 130 60 200-20M-20 180C30 160 80 120 120 70" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="9" filter="url(#f-blur3)" />
      <path d="M-20 76C60 62 150 34 230-20M-20 146C40 130 110 90 160 30" fill="none" stroke="#C98A85" strokeOpacity=".35" strokeWidth="7" filter="url(#f-blur3)" />
      <path d="M290-20C230 50 150 80 90 150C40 208 0 236-20 250" fill="none" stroke="#B9817C" strokeOpacity=".3" strokeWidth="5" filter="url(#f-blur3)" transform="translate(4 6)" />
    </g>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="sk-bg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FDF1EC" />
            <stop offset="1" stopColor="#F5D9D2" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#sk-bg)" />
      </Layer>
      <Layer depth={0.14} role="silk">
        <Folds />
        <Folds flip />
      </Layer>
      <Layer depth={0.34} role="card">
        <Plate d="M64 150h262a3 3 0 0 1 3 3v386a3 3 0 0 1-3 3h-262a3 3 0 0 1-3-3v-386a3 3 0 0 1 3-3Z" inner="M71 159h248v376h-248Z" />
      </Layer>
      <Layer depth={0.64} role="bloom" className="sc-soft">
        <Branch x={404} y={110} r={168} seed={4} len={210} kind="cherry" c="pink" bark="#9A6E60" flowers={26} twigs={5} />
        <Bush x={70} y={540} seed={5} count={18} spread={[40, 30]} greens={["sage", "moss"]} size={[0.6, 1.1]} />
        <Cluster x={66} y={540} seed={8} count={9} spread={[48, 36]} mix={MIX} greens={["sage"]} sprigs={5} sprigLen={[40, 80]} size={[0.5, 1.15]} />
        <Cluster x={326} y={156} seed={14} count={6} spread={[34, 28]} mix={MIX} greens={["sage"]} sprigs={4} sprigLen={[36, 70]} size={[0.45, 0.95]} />
      </Layer>
      <Layer depth={1}>
        <Petals seed={11} count={7} c="blush" box={[30, 520, 330, 280]} />
      </Layer>
    </>
  );
}

const LOOP = "M0 0C-26-62-136-76-150-16C-158 30-64 38 0 0Z";
const LOOP_IN = "M0 0C-44-24-96-30-126-10C-96 6-44 10 0 0Z";
const TAIL = "M-8 4C-34 56-66 110-92 168L-56 156L-44 188C-26 132-8 66 8 8Z";

function Cover() {
  const band = (x: number) => (
    <>
      <rect x={x} y="596" width="216" height="74" fill="url(#satin-blush)" />
      <rect x={x} y="596" width="216" height="74" fill="url(#shade-down)" opacity=".25" />
      <path d={`M${x} 597.5h216M${x} 668.5h216`} stroke="#fff" strokeOpacity=".6" strokeWidth="1" />
    </>
  );
  return (
    <Layer>
      <rect x="-20" y="604" width={VW + 40} height="78" fill="#8E5C56" opacity=".25" filter="url(#f-blur8)" data-role="rib-shadow" />
      <g data-role="rib-l">{band(-21)}</g>
      <g data-role="rib-r">{band(195)}</g>
      <g transform="translate(195 633) scale(1.22)">
        <g data-role="bow-tails">
          <path d={TAIL} fill="url(#satin-blush-h)" />
          <path d={TAIL} fill="url(#shade-down)" opacity=".35" />
          <g transform="scale(-1 1)">
            <path d={TAIL} fill="url(#satin-blush-h)" />
            <path d={TAIL} fill="url(#shade-down)" opacity=".2" />
          </g>
        </g>
        <g data-role="bow-loop-l">
          <path d={LOOP} fill="#8E5C56" opacity=".3" filter="url(#f-blur3)" transform="translate(0 7)" />
          <path d={LOOP} fill="url(#satin-blush)" />
          <path d={LOOP_IN} fill="#B9736F" opacity=".4" />
          <path d="M-18-22C-50-52-110-56-134-22" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" filter="url(#f-blur1)" />
        </g>
        <g data-role="bow-loop-r" transform="scale(-1 1)">
          <path d={LOOP} fill="#8E5C56" opacity=".3" filter="url(#f-blur3)" transform="translate(0 7)" />
          <path d={LOOP} fill="url(#satin-blush)" />
          <path d={LOOP_IN} fill="#B9736F" opacity=".4" />
          <path d="M-18-22C-50-52-110-56-134-22" fill="none" stroke="#fff" strokeOpacity=".7" strokeWidth="4" strokeLinecap="round" filter="url(#f-blur1)" />
        </g>
        <g data-role="bow-knot">
          <rect x="-18" y="-19" width="36" height="38" rx="11" fill="url(#satin-blush-h)" />
          <rect x="-18" y="-19" width="36" height="38" rx="11" fill="url(#shade-side)" />
          <path d="M-8-12C-4-2-4 4-8 12M6-12C10-2 10 4 6 12" fill="none" stroke="#B9736F" strokeOpacity=".5" strokeWidth="1.4" />
        </g>
      </g>
    </Layer>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 340, anchor: "mid", scale: 0.9 },
  namesOnCover: true,
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="bow-loop-l"]'), { scaleX: 0, scaleY: 0.3, svgOrigin: "195 633", duration: 0.9, ease: "power2.in" }, 0)
      .to(q('[data-role="bow-loop-r"]'), { scaleX: 0, scaleY: 0.3, svgOrigin: "195 633", duration: 0.9, ease: "power2.in" }, 0.08)
      .to(q('[data-role="bow-tails"]'), { scaleY: 1.5, opacity: 0, svgOrigin: "195 633", duration: 0.9, ease: "power1.in" }, 0.35)
      .to(q('[data-role="bow-knot"]'), { scale: 0, opacity: 0, svgOrigin: "195 633", duration: 0.4, ease: "power1.in" }, 0.8)
      .to(q('[data-role="rib-shadow"]'), { opacity: 0, duration: 0.6 }, 0.9)
      .to(q('[data-role="rib-l"]'), { x: -260, duration: 1.3, ease: "power2.inOut" }, 1)
      .to(q('[data-role="rib-r"]'), { x: 260, duration: 1.3, ease: "power2.inOut" }, 1)
      .fromTo(q('[data-role="card"]'), { yPercent: 0 }, { yPercent: 2.6, duration: 1.4, ease: "power2.out" }, 1.2)
      .from(q('[data-role="bloom"]'), { opacity: 0.4, scale: 0.96, duration: 1.4, ease: "power2.out" }, 1.2)
      .set(q(".cover"), { opacity: 0 }, 2.4);
  },
};

export default art;
