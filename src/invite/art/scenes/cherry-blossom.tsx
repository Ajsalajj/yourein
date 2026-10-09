import React from "react";
import type { Template } from "@/data/templates";
import { Layer, Branch, Clouds, Cluster, Petals, Treeline, ridge, VW, VH } from "../kit";
import type { ArtModule } from "../types";
import { Monogram } from "./_shared";

const MIX: ["cherry" | "bud", "pink" | "blush"][] = [["cherry", "pink"], ["cherry", "pink"], ["cherry", "blush"], ["bud", "pink"]];

function Tree({ x, y, s = 1, seed }: { x: number; y: number; s?: number; seed: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-7 0C-6-24-5-40-12-56C-18-68-30-74-40-84L-36-88C-26-80-14-74-8-64C-6-74-8-86-4-98L0-98C-2-86 0-74 4-64C10-76 22-82 34-90L37-86C26-78 16-70 10-56C5-40 7-22 8 0Z" fill="#6E4439" />
      <path d="M-2 0C-2-24 0-44-4-62" fill="none" stroke="#fff" strokeOpacity=".15" strokeWidth="2" />
      <Treeline seed={seed} x0={-70} x1={66} y={-62} h={34} fill="#F4B4C7" fill2="#F8C6D4" count={10} spires={0} />
      <Treeline seed={seed + 3} x0={-50} x1={48} y={-84} h={30} fill="#FBD6DF" fill2="#FDE6EB" count={7} spires={0} />
      <Treeline seed={seed + 5} x0={-30} x1={30} y={-106} h={24} fill="#FDE6EB" fill2="#F8C3D2" count={5} spires={0} />
      <Cluster x={0} y={-84} seed={seed + 9} count={16} spread={[64, 34]} mix={MIX} greens={["sage"]} sprigs={0} size={[0.3, 0.6]} />
    </g>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}>
        <defs>
          <linearGradient id="cb-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FADADF" />
            <stop offset=".4" stopColor="#FDEDE8" />
            <stop offset=".72" stopColor="#FFF8F0" />
          </linearGradient>
          <linearGradient id="cb-pond" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F3DCE6" />
            <stop offset="1" stopColor="#C9A6C4" />
          </linearGradient>
          <linearGradient id="cb-lawn" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E7E3C4" />
            <stop offset="1" stopColor="#C4CDA0" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#cb-sky)" />
        <circle cx="195" cy="520" r="250" fill="url(#glow-sun)" opacity=".7" />
        <Clouds seed={5} count={4} y={500} spreadY={60} color="#fff" o={0.8} />
      </Layer>
      <Layer depth={0.14}>
        <path d={ridge(4, 588, 34, { sharp: 0.35, freq: 1.1 })} fill="#E9CAD4" />
        <path d={ridge(9, 610, 22, { freq: 1.6 })} fill="#DDB9CA" />
        <Treeline seed={7} x0={-10} x1={400} y={628} h={18} fill="#F3C2CF" fill2="#EBB2C4" count={24} spires={0} />
      </Layer>
      <Layer depth={0.28}>
        <rect x="-20" y="626" width={VW + 40} height="250" fill="url(#cb-lawn)" />
        <path d="M-20 700C60 660 150 668 210 690C280 714 350 700 410 676V866H-20Z" fill="url(#cb-pond)" />
        <path d="M30 740h60M130 770h90M250 736h70M90 810h110M260 800h80" stroke="#fff" strokeOpacity=".6" strokeWidth="1.2" strokeLinecap="round" />
        {/* arched footbridge */}
        <path d="M108 700C150 660 240 660 282 700" fill="none" stroke="#B4544F" strokeWidth="6" strokeLinecap="round" />
        <path d="M108 686C150 646 240 646 282 686" fill="none" stroke="#B4544F" strokeWidth="2.4" strokeLinecap="round" />
        {[124, 150, 176, 195, 214, 240, 266].map((x, i) => {
          const dy = Math.abs(i - 3) * 5.2 + (i === 0 || i === 6 ? 4 : 0);
          return <path key={x} d={`M${x} ${656 + dy}V${670 + dy}`} stroke="#B4544F" strokeWidth="2" />;
        })}
        <path d="M108 700C150 676 240 676 282 700" fill="none" stroke="#7A2F33" strokeOpacity=".3" strokeWidth="4" filter="url(#f-blur3)" transform="translate(0 22)" />
      </Layer>
      <Layer depth={0.42} role="trees">
        <Tree x={52} y={700} s={1.5} seed={3} />
        <Tree x={346} y={692} s={1.36} seed={11} />
      </Layer>
      <Layer depth={0.84} role="branch-a" className="sc-soft">
        <Branch x={-14} y={86} r={14} seed={5} len={310} kind="cherry" c="pink" bark="#6E4439" flowers={46} twigs={6} />
      </Layer>
      <Layer depth={0.92} role="branch-b" className="sc-soft">
        <Branch x={404} y={150} r={166} seed={12} len={220} kind="cherry" c="pink" bark="#6E4439" flowers={36} twigs={5} />
      </Layer>
      <Layer depth={1} role="fore" className="sc-soft">
        <Branch x={-16} y={800} r={-24} seed={21} len={170} kind="cherry" c="pink" bark="#6E4439" flowers={30} twigs={4} />
        <Branch x={406} y={826} r={-152} seed={27} len={150} kind="cherry" c="pink" bark="#6E4439" flowers={26} twigs={4} />
        <Cluster x={10} y={822} seed={7} count={12} spread={[60, 34]} mix={MIX} greens={["sage"]} sprigs={3} size={[0.7, 1.5]} />
        <Cluster x={382} y={830} seed={17} count={10} spread={[52, 30]} mix={MIX} greens={["sage"]} sprigs={3} size={[0.7, 1.4]} />
        <Petals seed={4} count={8} c="pink" box={[30, 420, 330, 360]} />
      </Layer>
    </>
  );
}

function Cover({ t }: { t: Template }) {
  return (
    <>
      <div className="cv-solid" data-role="veil" style={{ background: "linear-gradient(170deg, #FEF6F3 0%, #FCEBEA 60%, #F9DFE2 100%)" }} />
      <Layer role="veil-art">
        <Monogram t={t} y={380} ink="#7B2F40" />
        <Petals seed={9} count={5} c="pink" box={[60, 180, 270, 440]} />
      </Layer>
    </>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 372, anchor: "mid", scale: 0.94 },
  coverInk: "#7B2F40",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.set(q('[data-role="branch-a"]'), { xPercent: -80, rotation: -14 }, 0)
      .set(q('[data-role="branch-b"]'), { xPercent: 80, rotation: 12 }, 0)
      .to(q('[data-role="veil-art"]'), { opacity: 0, duration: 0.6 }, 0)
      .to(q('[data-role="veil"]'), { opacity: 0, duration: 1.6, ease: "power1.inOut" }, 0.3)
      .fromTo(q(".hero-scene"), { scale: 1.08 }, { scale: 1, duration: 3, ease: "power2.out" }, 0.2)
      .to(q('[data-role="branch-a"]'), { xPercent: 0, rotation: 0, duration: 2.2, ease: "power3.out" }, 0.5)
      .to(q('[data-role="branch-b"]'), { xPercent: 0, rotation: 0, duration: 2.2, ease: "power3.out" }, 0.9)
      .from(q('[data-role="fore"]'), { opacity: 0, yPercent: 5, duration: 1.4, ease: "power2.out" }, 1.4)
      .set(q(".cover"), { opacity: 0 }, 2.2);
  },
};

export default art;
