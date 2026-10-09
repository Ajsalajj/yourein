import React from "react";
import { pairOf, type Template } from "@/data/templates";
import { Layer, Bush, Clouds, Cluster, Crescent, Garland, Lantern, Palace, Stars, quadPts, ridge, rng, n2, VW, VH } from "../kit";
import type { ArtModule } from "../types";

const JAS: ["jasmine" | "bud" | "blossom", "white" | "night"][] = [["jasmine", "white"], ["jasmine", "white"], ["bud", "white"], ["blossom", "night"]];
const col = { wall: "#E9D9B4", shade: "#A68C5C", open: "#FFE3A4", dome: "#F4E6C2", lit: true };

function Dust({ seed, count = 40, box }: { seed: number; count?: number; box: [number, number, number, number] }) {
  const R = rng(seed);
  return (
    <g fill="#F4DFA0">
      {Array.from({ length: count }, (_, i) => (
        <circle key={i} cx={n2(box[0] + R() * box[2])} cy={n2(box[1] + R() * box[3])} r={n2(0.5 + R() * 1.3)} opacity={n2(0.35 + R() * 0.6)} />
      ))}
    </g>
  );
}

function Veil({ o = 1 }: { o?: number }) {
  return (
    <g opacity={o}>
      <path d="M-40 470C60 380 150 520 250 470C330 430 380 500 430 470V700C360 760 300 690 230 740C140 800 50 720-40 800Z" fill="url(#cv-veil)" />
      <path d="M-40 560C70 500 160 620 260 570C340 530 390 580 430 560" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1.2" />
      <path d="M-40 640C60 590 150 700 250 650C340 606 390 660 430 640" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth="1" />
      <path d="M-40 520C60 440 150 570 250 520C330 480 380 546 430 520" fill="none" stroke="#fff" strokeOpacity=".3" strokeWidth="8" filter="url(#f-blur3)" />
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <linearGradient id="cv-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#040823" />
        <stop offset=".45" stopColor="#0E1A4C" />
        <stop offset=".8" stopColor="#2C3C82" />
        <stop offset="1" stopColor="#4F5596" />
      </linearGradient>
      <linearGradient id="cv-veil" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".34" />
        <stop offset=".5" stopColor="#DCE3FF" stopOpacity=".12" />
        <stop offset="1" stopColor="#fff" stopOpacity=".3" />
      </linearGradient>
    </defs>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.04}>
        <Defs />
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#cv-sky)" />
        <Stars seed={7} count={130} y0={0} y1={700} />
      </Layer>
      <Layer depth={0.1} role="moon">
        <Crescent x={268} y={178} R={58} r={-22} fill="#F8EFD2" />
        <Clouds seed={3} count={3} y={236} spreadY={40} color="#C3CCF0" o={0.4} />
        <Clouds seed={9} count={2} y={150} spreadY={30} color="#C3CCF0" o={0.22} />
      </Layer>
      <Layer depth={0.22} role="horizon">
        <path d={ridge(5, 760, 22, { freq: 1.3 })} fill="#0A1136" />
        <circle cx="195" cy="756" r="150" fill="url(#glow-warm)" opacity=".4" />
        <Palace x={195} y={772} s={0.78} mosque col={col} />
        <rect x="-20" y="770" width={VW + 40} height="100" fill="#070C2A" />
        <path d="M110 786H280M80 806H310M40 830H350" stroke="#FFE3A4" strokeOpacity=".2" strokeWidth="1" />
      </Layer>
      <Layer depth={0.4} role="veil-a">
        <Veil />
      </Layer>
      <Layer depth={0.66} role="lanterns">
        <Lantern x={38} y={148} drop={180} s={1.2} />
        <Lantern x={84} y={248} drop={280} s={0.8} />
        <Lantern x={352} y={352} drop={380} s={1} />
      </Layer>
      <Layer depth={0.86} role="jasmine" className="sc-soft">
        <Garland pts={quadPts([396, 380], [340, 520], [392, 700], 14)} seed={4} mix={JAS} greens={["night", "deep"]} size={[0.5, 1.05]} jitter={22} />
        <Cluster x={378} y={300} seed={8} count={9} spread={[40, 60]} mix={JAS} greens={["night", "deep"]} sprigs={5} sprigLen={[40, 80]} size={[0.6, 1.2]} />
        <Bush x={2} y={812} seed={5} count={24} spread={[56, 44]} greens={["night", "deep"]} size={[0.8, 1.4]} />
        <Cluster x={14} y={800} seed={12} count={10} spread={[52, 46]} mix={JAS} greens={["night", "deep"]} sprigs={5} sprigLen={[40, 90]} size={[0.6, 1.3]} />
      </Layer>
      <Layer depth={1} role="veil-b">
        <g transform="translate(0 110) scale(1 .7)"><Veil o={0.6} /></g>
        <Dust seed={6} count={46} box={[0, 430, 390, 330]} />
      </Layer>
    </>
  );
}

function Cover({ t }: { t: Template }) {
  const caps: React.CSSProperties = { fontFamily: "var(--f-caps)", fontWeight: 400 };
  return (
    <div className="cv-wrap" data-role="veil-cover">
      <div className="cv-frost" style={{ background: "linear-gradient(120deg, rgba(232,236,255,.5), rgba(160,172,226,.3) 45%, rgba(238,240,255,.52))" }} />
      <Layer>
        <path d="M-20 80L140 864M90-20L300 864M240-20L410 600M330-20L410 220" stroke="#fff" strokeOpacity=".4" strokeWidth="30" filter="url(#f-blur8)" />
        <path d="M-20 200C100 150 220 270 410 190M-20 520C120 460 240 600 410 510M-20 760C120 700 240 820 410 750" fill="none" stroke="#fff" strokeOpacity=".4" strokeWidth="1" />
        <Dust seed={14} count={60} box={[0, 0, 390, 844]} />
        <path d="M195 300A26 26 0 1 0 195 352A34 34 0 0 1 195 300Z" transform="rotate(-24 195 326)" fill="none" stroke="#F4DFA0" strokeWidth="1.1" />
        <text x="195" y="404" textAnchor="middle" fill="#FBF3DC" style={{ ...caps, fontSize: 15, letterSpacing: "0.26em" }}>{pairOf(t).toUpperCase()}</text>
        <path d="M168 424H222" stroke="#F4DFA0" strokeWidth=".8" />
        <text x="195" y="448" textAnchor="middle" fill="#FBF3DC" style={{ ...caps, fontSize: 9.6, letterSpacing: "0.26em" }}>{t.dateLabel.toUpperCase()}</text>
      </Layer>
    </div>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 400, anchor: "mid" },
  coverInk: "#FBF3DC",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="veil-cover"]'), { xPercent: 118, skewX: -9, duration: 2.8, ease: "power2.inOut" }, 0.1)
      .fromTo(q('[data-role="moon"]'), { opacity: 0.35, scale: 0.9 }, { opacity: 1, scale: 1, duration: 2.4, ease: "power2.out" }, 0.4)
      .fromTo(q(".hero-scene"), { scale: 1.08 }, { scale: 1, duration: 3, ease: "power2.out" }, 0.1)
      .from(q('[data-role="veil-a"]'), { xPercent: -14, opacity: 0, duration: 2.2, ease: "power2.out" }, 0.8)
      .from(q('[data-role="veil-b"]'), { xPercent: 14, opacity: 0, duration: 2.2, ease: "power2.out" }, 1)
      .from(q('[data-role="lanterns"]'), { opacity: 0, duration: 1.2 }, 1.4)
      .set(q(".cover"), { opacity: 0 }, 2.9);
  },
};

export default art;
