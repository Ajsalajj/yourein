import React from "react";
import type { Template } from "@/data/templates";
import { Layer, Bush, Clouds, Cluster, Dome, Garland, Petals, Treeline, arcPts, archD, linePts, ridge, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { Monogram, Plate } from "./_shared";

const ROSES: ["rose" | "blossom" | "bud", "blush" | "rose" | "ivory" | "peach"][] = [["rose", "blush"], ["rose", "rose"], ["rose", "ivory"], ["rose", "peach"], ["blossom", "ivory"], ["rose", "blush"]];
const GREEN: ("sage" | "leaf" | "moss")[] = ["sage", "leaf", "moss"];

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="rg-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F7D9D6" />
            <stop offset=".4" stopColor="#FCEBE0" />
            <stop offset=".75" stopColor="#FFF8EC" />
          </linearGradient>
          <linearGradient id="rg-lawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#CBD8AA" />
            <stop offset="1" stopColor="#95AE77" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#rg-sky)" />
        <circle cx="195" cy="560" r="250" fill="url(#glow-sun)" opacity=".8" />
        <Clouds seed={3} count={4} y={520} spreadY={60} color="#fff" o={0.7} />
        <path d={ridge(5, 612, 26, { freq: 1.2 })} fill="#DCC6C6" />
        <path d={ridge(9, 630, 16, { freq: 1.6 })} fill="#C6CFB2" />
      </Layer>
      <Layer depth={0.2}>
        <rect x="-20" y="646" width={VW + 40} height="230" fill="url(#rg-lawn)" />
        <Treeline seed={3} x0={-10} x1={160} y={654} h={26} fill="#9DB184" fill2="#8AA273" count={10} spires={0.3} />
        <Treeline seed={7} x0={232} x1={404} y={654} h={26} fill="#9DB184" fill2="#8AA273" count={10} spires={0.3} />
        {/* garden pavilion */}
        <g transform="translate(195 652)">
          <rect x="-24" y="-34" width="48" height="4" fill="#F3E6D6" />
          {[-21, -8, 8, 21].map((x) => <rect key={x} x={x - 1.6} y="-30" width="3.2" height="30" fill="#FFF9F0" />)}
          <Dome y={-34} hw={22} h={20} fill="#FFF6EA" trim="#D9BE8E" />
          <rect x="-27" y="-2" width="54" height="4" fill="#EBDCC8" />
        </g>
        <path d="M178 656H212L306 864H84Z" fill="#F8EEE0" />
        <path d="M178 656L84 864M212 656L306 864" stroke="#E2D2BC" strokeWidth="1.2" />
        <Garland pts={linePts(160, 668, 20, 850, 9)} seed={4} mix={ROSES} greens={GREEN} size={[0.3, 0.75]} jitter={12} />
        <Garland pts={linePts(230, 668, 372, 850, 9)} seed={8} mix={ROSES} greens={GREEN} size={[0.3, 0.75]} jitter={12} />
      </Layer>
      <Layer depth={0.38} role="arch">
        <path d="M67 864V690A128 190 0 0 1 323 690V864" fill="none" stroke="#EADBC5" strokeWidth="5" />
        <path d="M81 864V690A114 172 0 0 1 309 690V864" fill="none" stroke="#EADBC5" strokeWidth="3" />
        <Garland pts={arcPts(195, 690, 122, 182, 182, 358, 30)} seed={11} mix={ROSES} greens={GREEN} size={[0.42, 0.9]} jitter={14} />
        <Garland pts={linePts(72, 700, 72, 860, 9)} seed={13} mix={ROSES} greens={GREEN} size={[0.42, 0.86]} jitter={14} />
        <Garland pts={linePts(318, 700, 318, 860, 9)} seed={17} mix={ROSES} greens={GREEN} size={[0.42, 0.86]} jitter={14} />
      </Layer>
      <Layer depth={0.5} role="plate">
        <Plate d={archD(195, 122, 240, 474, "round")} fill="#FFFBF7" o={0.92} inner={archD(195, 130, 224, 466, "round")} />
      </Layer>
      <Layer depth={0.85} className="sc-soft" role="fore">
        <Bush x={8} y={86} seed={2} count={30} spread={[60, 60]} greens={GREEN} size={[0.8, 1.4]} />
        <Cluster x={22} y={96} seed={3} count={12} spread={[62, 80]} mix={ROSES} greens={GREEN} sprigs={6} sprigLen={[50, 96]} size={[0.6, 1.5]} />
        <Bush x={384} y={110} seed={6} count={26} spread={[52, 60]} greens={GREEN} size={[0.8, 1.4]} />
        <Cluster x={372} y={120} seed={9} count={10} spread={[52, 76]} mix={ROSES} greens={GREEN} sprigs={6} sprigLen={[50, 96]} size={[0.6, 1.4]} />
        <Bush x={4} y={806} seed={12} count={30} spread={[70, 50]} greens={GREEN} size={[0.8, 1.5]} />
        <Cluster x={16} y={800} seed={15} count={12} spread={[70, 54]} mix={ROSES} greens={GREEN} sprigs={6} sprigLen={[50, 100]} size={[0.7, 1.6]} />
        <Bush x={388} y={812} seed={18} count={30} spread={[70, 50]} greens={GREEN} size={[0.8, 1.5]} />
        <Cluster x={376} y={804} seed={21} count={12} spread={[70, 54]} mix={ROSES} greens={GREEN} sprigs={6} sprigLen={[50, 100]} size={[0.7, 1.6]} />
      </Layer>
      <Layer depth={1}>
        <Petals seed={6} count={7} c="rose" box={[40, 440, 310, 320]} />
      </Layer>
    </>
  );
}

function Curtain({ seed }: { seed: number }) {
  return (
    <>
      <path d="M-30-20H200V870H-30Z" fill="#F6E1DD" />
      <path d="M-30-20H200V870H-30Z" fill="url(#shade-side)" opacity=".5" />
      {[[30, 70], [150, 150], [40, 300], [140, 420], [30, 560], [150, 700], [50, 800]].map(([x, y], i) => (
        <g key={i}>
          <Bush x={x} y={y} seed={seed + i} count={22} spread={[70, 66]} greens={GREEN} size={[0.8, 1.5]} />
          <Cluster x={x} y={y} seed={seed * 3 + i} count={9} spread={[66, 70]} mix={ROSES} greens={GREEN} sprigs={4} sprigLen={[50, 90]} size={[0.8, 1.8]} />
        </g>
      ))}
    </>
  );
}

function Cover({ t }: { t: Template }) {
  return (
    <>
      <Layer role="cur-l"><Curtain seed={5} /></Layer>
      <Layer role="cur-r"><g transform="translate(390 0) scale(-1 1)"><Curtain seed={23} /></g></Layer>
      <Layer role="cur-plate"><Monogram t={t} y={404} ink="#8A4A46" /></Layer>
    </>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 310, anchor: "mid", scale: 0.86 },
  coverInk: "#7A3F3C",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="cur-plate"]'), { opacity: 0, scale: 0.9, duration: 0.6, ease: "power1.in" }, 0)
      .to(q('[data-role="cur-l"]'), { xPercent: -62, rotation: -5, duration: 2.6, ease: "power2.inOut" }, 0.2)
      .to(q('[data-role="cur-r"]'), { xPercent: 62, rotation: 5, duration: 2.6, ease: "power2.inOut" }, 0.2)
      .fromTo(q(".hero-scene"), { scale: 1.12 }, { scale: 1, duration: 3, ease: "power2.out" }, 0.2)
      .from(q('[data-role="plate"]'), { opacity: 0, yPercent: 3, duration: 1.2, ease: "power2.out" }, 1.4)
      .to(q(".cover"), { opacity: 0, duration: 0.6 }, 2.3);
  },
};

export default art;
