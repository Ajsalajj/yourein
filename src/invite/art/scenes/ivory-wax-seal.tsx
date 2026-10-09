import React from "react";
import { Layer, Bush, Cluster, Emboss, FoilFrame, Petals, Sprig, WaxSeal, VW, VH } from "../kit";
import { pairOf } from "@/data/templates";
import type { ArtModule } from "../types";

const MIX_IVORY: [("rose" | "blossom" | "bud"), ("ivory" | "white" | "peach")][] = [["rose", "ivory"], ["rose", "white"], ["blossom", "white"], ["rose", "peach"], ["bud", "ivory"]];

function PaperDefs() {
  return (
    <defs>
      <linearGradient id="iw-paper" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFCF5" />
        <stop offset=".5" stopColor="#F9F2E3" />
        <stop offset="1" stopColor="#F1E6CF" />
      </linearGradient>
      <linearGradient id="iw-flap" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#F7EFDD" />
        <stop offset="1" stopColor="#FFFDF8" />
      </linearGradient>
      <linearGradient id="iw-liner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#E7D6B0" />
        <stop offset="1" stopColor="#D8C294" />
      </linearGradient>
      <clipPath id="iw-half-l"><path d="M150 290H193L199 312L189 330L200 350L191 368L196 390H150Z" /></clipPath>
      <clipPath id="iw-half-r"><path d="M240 290H193L199 312L189 330L200 350L191 368L196 390H240Z" /></clipPath>
    </defs>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.06}>
        <PaperDefs />
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#iw-paper)" />
        <Emboss seed={12} count={26} />
      </Layer>
      <Layer depth={0.2}>
        <FoilFrame x={24} y={104} w={VW - 48} h={VH - 208} />
        <path d="M150 232H240M165 239H225" stroke="url(#au)" strokeWidth=".8" />
        <g transform="translate(195 196)" fill="none" stroke="url(#au)" strokeWidth="1" strokeLinecap="round">
          <path d="M-26 10C-22-6-10-16 0-18C10-16 22-6 26 10" />
          <path d="M-20 4l-5-4M-14-4l-5-5M-6-10l-3-6M20 4l5-4M14-4l5-5M6-10l3-6M0-18v-8" />
        </g>
        <path d="M195 664c-10 8-26 8-40 0M195 664c10 8 26 8 40 0M195 658v14" fill="none" stroke="url(#au)" strokeWidth=".9" strokeLinecap="round" />
      </Layer>
      <Layer depth={0.62} role="bloom-a" className="sc-soft">
        <Bush x={18} y={96} seed={4} count={30} spread={[60, 44]} greens={["sage", "olive", "moss"]} size={[0.7, 1.3]} />
        <Cluster x={30} y={112} seed={5} count={14} spread={[84, 62]} mix={MIX_IVORY} greens={["sage", "olive"]} sprigs={8} sprigLen={[60, 120]} size={[0.5, 1.2]} />
        <Sprig x={90} y={120} r={110} len={110} c="gilt" count={9} bend={16} leaf={0.9} />
      </Layer>
      <Layer depth={0.8} role="bloom-b" className="sc-soft">
        <Bush x={376} y={752} seed={9} count={30} spread={[60, 44]} greens={["sage", "olive", "moss"]} size={[0.7, 1.3]} />
        <Cluster x={360} y={736} seed={17} count={14} spread={[84, 62]} mix={MIX_IVORY} greens={["sage", "olive"]} sprigs={8} sprigLen={[60, 120]} size={[0.5, 1.2]} />
        <Sprig x={300} y={730} r={-70} len={110} c="gilt" count={9} bend={16} leaf={0.9} />
      </Layer>
      <Layer depth={1}>
        <Petals seed={8} count={5} c="ivory" box={[30, 200, 330, 480]} size={[4, 9]} />
      </Layer>
    </>
  );
}

function Cover({ t }: { t: Parameters<ArtModule["Cover"]>[0]["t"] }) {
  const [a, b] = t.couple;
  const caps: React.CSSProperties = { fontFamily: "var(--f-caps)", fontWeight: 500 };
  return (
    <Layer>
      <PaperDefs />
      {/* inside of the envelope */}
      <g data-role="env-back">
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#iw-liner)" />
        <Emboss seed={3} count={30} light="#F6E7BF" dark="#8A6A2C" />
      </g>
      {/* the card */}
      <g data-role="card" transform="translate(0 330)">
        <rect x="30" y="66" width="330" height="712" rx="3" fill="#FFFDF7" filter="url(#f-drop)" />
        <FoilFrame x={42} y={78} w={306} h={688} />
        <path d="M165 150H225" stroke="url(#au)" strokeWidth=".9" />
      </g>
      {/* front pocket */}
      <g data-role="pocket">
        <path d="M-20-20L195 344L410-20V864H-20Z" fill="url(#iw-paper)" />
        <g clipPath="none"><Emboss seed={21} count={20} box={[0, 380, VW, 470]} /></g>
        <path d="M-20 864L195 470L410 864" fill="none" stroke="#B9A679" strokeOpacity=".28" strokeWidth="1" />
        <path d="M-20 866L195 472L410 866" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="1" />
        <text x="195" y="512" textAnchor="middle" fill="#9A7B3F" style={{ ...caps, fontSize: 36, letterSpacing: "0.1em" }}>
          {a[0]}
          {b && <><tspan dx="8" dy="-3" style={{ fontSize: 30, fontWeight: 300 }}>|</tspan><tspan dx="8" dy="3">{b[0]}</tspan></>}
        </text>
        <text x="195" y="556" textAnchor="middle" fill="#8C7040" style={{ ...caps, fontSize: 13.5, letterSpacing: "0.3em" }}>{pairOf(t).toUpperCase()}</text>
        <text x="195" y="584" textAnchor="middle" fill="#8C7040" style={{ ...caps, fontSize: 9.6, letterSpacing: "0.3em" }}>{t.dateLabel.toUpperCase()}</text>
      </g>
      {/* top flap */}
      <g data-role="flap">
        <path d="M-20-20H410L206 338Q195 352 184 338Z" fill="#6B5730" opacity=".3" filter="url(#f-blur8)" transform="translate(0 7)" />
        <path d="M-20-20H410L206 338Q195 352 184 338Z" fill="url(#iw-flap)" />
        <Emboss seed={33} count={12} box={[60, 0, 270, 200]} />
        <path d="M-20-20L184 338Q195 352 206 338L410-20" fill="none" stroke="#C9B587" strokeOpacity=".5" strokeWidth="1" />
        <path d="M-20-20H410L206 338Q195 352 184 338Z" data-role="flap-in" fill="url(#iw-liner)" opacity="0" />
      </g>
      {/* wax seal, in two halves so it can break */}
      <g data-role="seal-l" clipPath="url(#iw-half-l)"><WaxSeal x={195} y={340} s={1.12} /></g>
      <g data-role="seal-r" clipPath="url(#iw-half-r)"><WaxSeal x={195} y={340} s={1.12} /></g>
      {/* flowers laid over the envelope */}
      <g data-role="env-flowers">
        <Bush x={10} y={120} seed={4} count={26} spread={[54, 40]} greens={["sage", "olive", "moss"]} size={[0.7, 1.2]} />
        <Cluster x={18} y={126} seed={5} count={9} spread={[56, 44]} mix={MIX_IVORY} greens={["sage", "olive"]} sprigs={7} sprigLen={[50, 104]} size={[0.5, 1.1]} />
        <Bush x={8} y={730} seed={14} count={26} spread={[54, 44]} greens={["sage", "olive", "moss"]} size={[0.7, 1.2]} />
        <Cluster x={14} y={722} seed={29} count={9} spread={[56, 48]} mix={MIX_IVORY} greens={["sage", "olive"]} sprigs={7} sprigLen={[50, 104]} size={[0.5, 1.1]} />
        <Petals seed={2} count={4} c="ivory" box={[250, 110, 120, 620]} size={[4, 8]} />
      </g>
    </Layer>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 408, anchor: "mid" },
  coverInk: "#8C7040",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q('[data-role="seal-l"], [data-role="seal-r"]'), { scale: 0.95, svgOrigin: "195 340", duration: 0.12, ease: "power1.in" }, 0)
      .to(q('[data-role="seal-l"]'), { x: -26, y: 46, rotation: -22, opacity: 0, svgOrigin: "195 340", duration: 0.7, ease: "power2.in" }, 0.12)
      .to(q('[data-role="seal-r"]'), { x: 24, y: 40, rotation: 18, opacity: 0, svgOrigin: "195 340", duration: 0.7, ease: "power2.in" }, 0.14)
      .to(q('[data-role="env-flowers"]'), { x: -70, opacity: 0, duration: 0.9, ease: "power2.in" }, 0.25)
      .to(q('[data-role="flap"]'), { scaleY: -0.9, svgOrigin: "195 -20", duration: 1, ease: "power2.inOut" }, 0.45)
      .to(q('[data-role="flap-in"]'), { opacity: 1, duration: 0.1 }, 0.92)
      .to(q('[data-role="card"]'), { y: 40, duration: 0.85, ease: "power3.out" }, 1.1)
      .to(q('[data-role="pocket"], [data-role="flap"], [data-role="env-back"]'), { y: 980, duration: 1, ease: "power2.in" }, 1.7)
      .to(q('[data-role="card"]'), { y: 0, scale: 1.2, svgOrigin: "195 422", duration: 1, ease: "power2.inOut" }, 1.75)
      .to(q(".cover"), { opacity: 0, duration: 0.5, ease: "power1.out" }, 2.45)
      .from(q('[data-role="bloom-a"]'), { xPercent: -14, yPercent: -8, opacity: 0, duration: 1.2, ease: "power2.out" }, 2.4)
      .from(q('[data-role="bloom-b"]'), { xPercent: 14, yPercent: 8, opacity: 0, duration: 1.2, ease: "power2.out" }, 2.5);
  },
};

export default art;
