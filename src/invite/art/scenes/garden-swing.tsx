import React from "react";
import type { Template } from "@/data/templates";
import { Layer, Bush, Clouds, Cluster, Couple, Dome, Garland, Petals, Treeline, linePts, quadPts, ridge, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { Monogram } from "./_shared";

const MIX: ["rose" | "blossom" | "cherry" | "bud", "blush" | "peach" | "ivory" | "pink" | "rose"][] = [["rose", "blush"], ["rose", "ivory"], ["blossom", "ivory"], ["rose", "peach"], ["cherry", "pink"], ["rose", "rose"]];
const GREEN: ("leaf" | "sage" | "moss")[] = ["leaf", "sage", "moss"];
const STRINGS: [number, number][] = [[12, 330], [36, 230], [58, 150], [334, 150], [356, 240], [380, 340]];

function Canopy({ rows = 1 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <g key={r}>
          {[10, 75, 140, 205, 270, 335, 385].map((x, i) => (
            <g key={x}>
              <Bush x={x} y={20 + r * 90 + (i % 2) * 22} seed={i + r * 7 + 2} count={22} spread={[56, 44]} greens={GREEN} size={[0.8, 1.5]} />
              <Cluster x={x} y={30 + r * 90 + (i % 2) * 22} seed={i * 3 + r * 11 + 1} count={8} spread={[50, 40]} mix={MIX} greens={GREEN} sprigs={3} sprigLen={[40, 80]} size={[0.6, 1.5]} />
            </g>
          ))}
        </g>
      ))}
    </>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D9EAE4" />
            <stop offset=".4" stopColor="#F2F2DE" />
            <stop offset=".7" stopColor="#FFF6E0" />
          </linearGradient>
          <linearGradient id="gs-lawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#D2DFA8" />
            <stop offset="1" stopColor="#93B06E" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#gs-sky)" />
        <circle cx="290" cy="420" r="260" fill="url(#glow-sun)" opacity=".85" />
        <Clouds seed={6} count={4} y={440} spreadY={80} color="#fff" o={0.8} />
      </Layer>
      <Layer depth={0.14}>
        <path d={ridge(4, 548, 40, { sharp: 0.4, freq: 1.1 })} fill="#BCD2CC" />
        <path d={ridge(11, 572, 28, { sharp: 0.2, freq: 1.5 })} fill="#A9C6B0" />
        <g transform="translate(292 546)">
          {[-12, -4, 4, 12].map((x) => <rect key={x} x={x - 1.2} y="-20" width="2.4" height="20" fill="#FFFBF2" />)}
          <rect x="-16" y="-23" width="32" height="3.4" fill="#F1E6D2" />
          <Dome y={-23} hw={14} h={14} fill="#FBF1E2" trim="#D9BE8E" />
        </g>
      </Layer>
      <Layer depth={0.26}>
        <rect x="-20" y="596" width={VW + 40} height="270" fill="url(#gs-lawn)" />
        <Treeline seed={3} x0={-10} x1={400} y={604} h={26} fill="#9DB884" fill2="#86A66F" count={20} spires={0.22} />
        <path d="M-20 690C80 660 160 700 240 676C300 660 360 670 410 660V700C340 700 290 706 240 716C160 734 80 700-20 730Z" fill="#F4EBD3" opacity=".8" />
        <Garland pts={quadPts([-10, 650], [100, 630], [200, 652], 12)} seed={5} mix={MIX} greens={GREEN} size={[0.25, 0.5]} jitter={8} />
        <Garland pts={quadPts([230, 650], [320, 628], [400, 646], 10)} seed={9} mix={MIX} greens={GREEN} size={[0.25, 0.5]} jitter={8} />
      </Layer>
      <Layer depth={0.38} role="couple">
        <Couple x={352} y={722} s={0.56} dress="#FBE3DC" dressDeep="#E3A9A2" suit="#5B5560" />
      </Layer>
      <Layer depth={0.56} role="swing">
        <ellipse cx="200" cy="744" rx="130" ry="10" fill="#55703F" opacity=".35" filter="url(#f-blur3)" />
        <path d="M92-20V650M298-20V650" stroke="#C9B48A" strokeWidth="2.4" />
        <path d="M84 652C84 584 124 556 195 556C266 556 306 584 306 652" fill="#FFFBF2" stroke="#D9C6A0" strokeWidth="2" />
        <path d="M100 650C102 600 134 574 195 574C256 574 288 600 290 650" fill="none" stroke="#D9C6A0" strokeWidth="1.2" />
        {[124, 148, 172, 195, 218, 242, 266].map((x) => <path key={x} d={`M${x} ${584 - Math.abs(x - 195) * -0.14}V650`} stroke="#E4D5B6" strokeWidth="1" />)}
        <rect x="70" y="646" width="250" height="15" rx="5" fill="#FFFBF2" stroke="#D9C6A0" strokeWidth="1.4" />
        <rect x="84" y="630" width="222" height="18" rx="8" fill="#F7D6CF" />
        <rect x="84" y="630" width="222" height="6" rx="3" fill="#fff" opacity=".45" />
        <rect x="100" y="600" width="46" height="34" rx="9" fill="#FBE9E3" stroke="#E9C4BC" strokeWidth="1" />
        <rect x="244" y="600" width="46" height="34" rx="9" fill="#FBE9E3" stroke="#E9C4BC" strokeWidth="1" />
        <Garland pts={linePts(92, 20, 92, 630, 26)} seed={12} mix={MIX} greens={GREEN} size={[0.3, 0.66]} jitter={8} />
        <Garland pts={linePts(298, 20, 298, 630, 26)} seed={19} mix={MIX} greens={GREEN} size={[0.3, 0.66]} jitter={8} />
      </Layer>
      <Layer depth={0.82} anchor="xMidYMin" role="canopy" className="sc-soft">
        {STRINGS.map(([x, len], i) => (
          <Garland key={x} pts={linePts(x, 60, x + (i % 2 ? 6 : -6), 60 + len, Math.round(len / 17))} seed={i + 30} mix={MIX} greens={GREEN} size={[0.3, 0.7]} jitter={9} />
        ))}
        <Canopy />
      </Layer>
      <Layer depth={1} anchor="xMidYMax" role="fore" className="sc-soft">
        <Bush x={4} y={816} seed={41} count={30} spread={[70, 48]} greens={GREEN} size={[0.8, 1.5]} />
        <Cluster x={18} y={806} seed={44} count={11} spread={[66, 48]} mix={MIX} greens={GREEN} sprigs={6} sprigLen={[50, 100]} size={[0.7, 1.6]} />
        <Bush x={388} y={822} seed={47} count={30} spread={[70, 48]} greens={GREEN} size={[0.8, 1.5]} />
        <Cluster x={374} y={812} seed={52} count={11} spread={[66, 48]} mix={MIX} greens={GREEN} sprigs={6} sprigLen={[50, 100]} size={[0.7, 1.6]} />
        <Petals seed={3} count={6} c="blush" box={[50, 480, 290, 280]} />
      </Layer>
    </>
  );
}

function Cover({ t }: { t: Template }) {
  return (
    <>
      <Layer role="curtain" anchor="xMidYMin">
        <defs>
          <linearGradient id="gs-cur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C8D8A8" />
            <stop offset="1" stopColor="#EEF0D8" />
          </linearGradient>
        </defs>
        <path d={"M-20-20H410V640" + Array.from({ length: 10 }, () => "q-21.5 40-43 0").join("") + "Z"} fill="url(#gs-cur)" />
        {[20, 62, 104, 146, 244, 286, 328, 370].map((x, i) => (
          <Garland key={x} pts={linePts(x, 560, x, 720 + (i % 3) * 36, 9 + (i % 3) * 2)} seed={i + 60} mix={MIX} greens={GREEN} size={[0.3, 0.7]} jitter={9} />
        ))}
        <Canopy rows={7} />
      </Layer>
      <Layer role="cur-plate"><Monogram t={t} y={404} ink="#6B4A2A" /></Layer>
    </>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 268, anchor: "top", scale: 0.92 },
  coverInk: "#5B4526",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="cur-plate"]'), { opacity: 0, duration: 0.5 }, 0)
      .to(q('[data-role="curtain"]'), { yPercent: -92, duration: 2.5, ease: "power2.inOut" }, 0.15)
      .fromTo(q(".hero-scene"), { scale: 1.1 }, { scale: 1, duration: 3, ease: "power2.out" }, 0.2)
      .from(q('[data-role="swing"]'), { rotation: 2.4, transformOrigin: "50% 0%", duration: 2.2, ease: "sine.inOut" }, 1)
      .from(q('[data-role="fore"]'), { yPercent: 8, opacity: 0, duration: 1.6, ease: "power2.out" }, 1.2)
      .set(q(".cover"), { opacity: 0 }, 2.7);
  },
};

export default art;
