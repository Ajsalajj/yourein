import React from "react";
import { Layer, Bush, Clouds, Cluster, Couple, Petals, Sprig, Treeline, ridge, rng, n2, VW, VH } from "../kit";
import type { ArtModule } from "../types";

const BALUSTER = "M-4 0C-7.4 8-7.4 16-3 22C-6.4 30-6.4 38-4 44H4C6.4 38 6.4 30 3 22C7.4 16 7.4 8 4 0Z";

function Hero() {
  const R = rng(41);
  return (
    <>
      {/* sky */}
      <Layer depth={0.04}>
        <defs>
          <linearGradient id="sr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E3AEB1" />
            <stop offset=".2" stopColor="#F2C4AE" />
            <stop offset=".42" stopColor="#FBDDB8" />
            <stop offset=".62" stopColor="#FFF0D6" />
          </linearGradient>
        </defs>
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#sr-sky)" />
        <circle cx="236" cy="498" r="250" fill="url(#glow-sun)" />
        <Clouds seed={5} count={5} y={300} spreadY={130} color="#FFF3E4" o={0.75} />
        <Clouds seed={11} count={4} y={380} spreadY={60} color="#F7B9A6" o={0.45} />
      </Layer>

      {/* far range */}
      <Layer depth={0.12}>
        <defs>
          <linearGradient id="sr-far" gradientUnits="userSpaceOnUse" x1="0" y1="410" x2="0" y2="530">
            <stop offset="0" stopColor="#CFA6B7" />
            <stop offset="1" stopColor="#F3D2C0" />
          </linearGradient>
          <linearGradient id="sr-far2" gradientUnits="userSpaceOnUse" x1="0" y1="440" x2="0" y2="530">
            <stop offset="0" stopColor="#BC93AB" />
            <stop offset="1" stopColor="#EBC3B6" />
          </linearGradient>
        </defs>
        <circle cx="236" cy="500" r="26" fill="#FFF9EA" />
        <circle cx="236" cy="500" r="80" fill="url(#glow-sun)" />
        <path d={ridge(3, 470, 46, { sharp: 0.6, freq: 1.1 })} fill="url(#sr-far)" />
        <path d={ridge(8, 494, 34, { sharp: 0.55, freq: 1.7 })} fill="url(#sr-far2)" />
        <path d="M150 300q6-5 12 0q6-5 12 0M196 322q5-4 10 0q5-4 10 0M128 334q4-3 8 0q4-3 8 0" fill="none" stroke="#8A6474" strokeWidth="1" strokeLinecap="round" opacity=".55" />
      </Layer>

      {/* nearer range and lake */}
      <Layer depth={0.24}>
        <defs>
          <linearGradient id="sr-lake" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFEBCB" />
            <stop offset=".3" stopColor="#F8CBA8" />
            <stop offset="1" stopColor="#BA8D9D" />
          </linearGradient>
          <linearGradient id="sr-m1" gradientUnits="userSpaceOnUse" x1="0" y1="420" x2="0" y2="540">
            <stop offset="0" stopColor="#9C7896" />
            <stop offset="1" stopColor="#D2A9A8" />
          </linearGradient>
        </defs>
        <path d="M-20 540L-20 470L24 452L58 418L84 440L112 412L138 452L160 470L178 500L204 524Z" fill="url(#sr-m1)" />
        <path d="M58 418L84 440L112 412L120 452L96 478L70 462Z" fill="#fff" opacity=".12" />
        <path d="M410 540L410 440L384 420L356 396L330 428L306 414L284 456L262 492L240 524Z" fill="url(#sr-m1)" />
        <path d="M356 396L330 428L306 414L296 452L326 470L350 440Z" fill="#fff" opacity=".13" />
        <rect x="-20" y="520" width={VW + 40} height="340" fill="url(#sr-lake)" />
        {/* the hills, mirrored in the water */}
        <path d="M-20 524H204L170 548L120 566L60 572L-20 566Z" fill="#9C7896" opacity=".28" filter="url(#f-blur3)" />
        <path d="M410 524H240L276 550L330 566L410 566Z" fill="#9C7896" opacity=".28" filter="url(#f-blur3)" />
        {Array.from({ length: 28 }, (_, i) => {
          const y = 526 + i * 6.6 + R() * 3;
          const w = 8 + i * 3.6 + R() * 16;
          return <rect key={i} x={n2(236 - w / 2 + (R() - 0.5) * 12)} y={n2(y)} width={n2(w)} height={n2(1 + R() * 1.7)} rx="1" fill="#FFF8E4" opacity={n2(0.9 - i * 0.022)} />;
        })}
        {Array.from({ length: 22 }, (_, i) => (
          <rect key={`w${i}`} x={n2(R() * VW)} y={n2(540 + R() * 150)} width={n2(14 + R() * 30)} height="1" rx=".5" fill="#fff" opacity={n2(0.18 + R() * 0.2)} />
        ))}
        <rect x="-20" y="512" width={VW + 40} height="18" fill="#FFF3DC" opacity=".6" filter="url(#f-blur3)" />
      </Layer>

      {/* wooded shore */}
      <Layer depth={0.36}>
        <defs>
          <linearGradient id="sr-shore" gradientUnits="userSpaceOnUse" x1="0" y1="540" x2="0" y2="640">
            <stop offset="0" stopColor="#7A6577" />
            <stop offset="1" stopColor="#A58793" />
          </linearGradient>
        </defs>
        <path d="M-20 606C6 560 56 536 104 552C130 562 146 580 160 596L-20 650Z" fill="url(#sr-shore)" />
        <path d="M410 616C394 566 352 540 312 556C292 566 280 582 268 598L410 650Z" fill="url(#sr-shore)" />
        <Treeline seed={5} x0={-14} x1={150} y={590} h={24} fill="#5D5364" fill2="#6C5E70" count={11} spires={0.34} />
        <Treeline seed={9} x0={270} x1={404} y={594} h={26} fill="#5D5364" fill2="#6C5E70" count={9} spires={0.36} />
        <Treeline seed={14} x0={-14} x1={120} y={612} h={20} fill="#4F4858" fill2="#5A4F60" count={8} spires={0.1} />
        <Treeline seed={17} x0={300} x1={404} y={618} h={20} fill="#4F4858" fill2="#5A4F60" count={6} spires={0.1} />
        {/* a small boathouse on the far shore */}
        <g transform="translate(138 586)">
          <rect x="-9" y="-8" width="18" height="8" fill="#F1D9C2" />
          <path d="M-12-8L0-16L12-8Z" fill="#8A5E5A" />
          <rect x="-2" y="-5" width="4" height="5" fill="#FFE8B8" />
        </g>
        <path d="M-20 600C30 590 96 588 164 596" fill="none" stroke="#FFF1DC" strokeOpacity=".5" strokeWidth="1" />
        <path d="M410 608C370 596 320 594 266 598" fill="none" stroke="#FFF1DC" strokeOpacity=".5" strokeWidth="1" />
      </Layer>

      {/* terrace */}
      <Layer depth={0.5} anchor="xMidYMax">
        <defs>
          <linearGradient id="sr-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F3DCC4" />
            <stop offset="1" stopColor="#C9A894" />
          </linearGradient>
          <linearGradient id="sr-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E7C9B0" />
            <stop offset="1" stopColor="#B08C82" />
          </linearGradient>
        </defs>
        <rect x="-20" y="762" width={VW + 40} height="100" fill="url(#sr-floor)" />
        {[-200, -90, 20, 130, 240, 350, 460, 570].map((x) => (
          <path key={x} d={`M${195 + (x - 195) * 0.42} 764L${x} 850`} stroke="#8E6E66" strokeOpacity=".3" strokeWidth="1" />
        ))}
        <path d="M-20 792H410M-20 826H410" stroke="#8E6E66" strokeOpacity=".22" strokeWidth="1" />
        {Array.from({ length: 19 }, (_, i) => (
          <g key={i} transform={`translate(${6 + i * 21} 712)`}>
            <path d={BALUSTER} fill="url(#sr-stone)" />
            <path d={BALUSTER} fill="url(#shade-side)" />
          </g>
        ))}
        <rect x="-20" y="700" width={VW + 40} height="12" fill="url(#sr-stone)" />
        <rect x="-20" y="700" width={VW + 40} height="3" fill="#FFF3E2" opacity=".8" />
        <rect x="-20" y="756" width={VW + 40} height="10" fill="url(#sr-stone)" />
        <rect x="-20" y="764" width={VW + 40} height="5" fill="#8E6E66" opacity=".35" />
        {[36, 354].map((x) => (
          <g key={x}>
            <rect x={x - 13} y="690" width="26" height="78" fill="url(#sr-stone)" />
            <rect x={x - 13} y="690" width="26" height="78" fill="url(#shade-side)" />
            <rect x={x - 16} y="686" width="32" height="7" fill="#F7E5D0" />
            <path d={`M${x - 9} 686C${x - 13} 676 ${x - 10} 668 ${x - 6} 664H${x + 6}C${x + 10} 668 ${x + 13} 676 ${x + 9} 686Z`} fill="#E3C6AE" />
          </g>
        ))}
        <Cluster x={36} y={654} seed={12} count={7} spread={[20, 14]} mix={[["rose", "peach"], ["rose", "blush"], ["blossom", "ivory"]]} greens={["olive", "moss"]} sprigs={5} sprigLen={[20, 38]} size={[0.3, 0.55]} />
        <Cluster x={354} y={654} seed={19} count={7} spread={[20, 14]} mix={[["rose", "blush"], ["rose", "peach"], ["blossom", "ivory"]]} greens={["olive", "moss"]} sprigs={5} sprigLen={[20, 38]} size={[0.3, 0.55]} />
      </Layer>

      {/* the two of them */}
      <Layer depth={0.6} anchor="xMidYMax" role="couple">
        <Couple x={236} y={816} s={1.62} dress="#F6D3CB" dressDeep="#DDA29C" suit="#4A4250" hair="#2E1F1A" />
      </Layer>

      {/* foreground foliage */}
      <Layer depth={0.92} anchor="xMidYMin" className="sc-soft" role="fore-top">
        <path d="M-10 -10C30 20 70 50 96 110M40 -10C90 30 130 60 170 90" fill="none" stroke="#6B5A3E" strokeWidth="3" strokeLinecap="round" />
        <path d="M400 -10C370 30 340 60 300 96M400 30C380 60 366 86 350 120" fill="none" stroke="#6B5A3E" strokeWidth="3" strokeLinecap="round" />
        <Bush x={10} y={10} seed={3} count={46} spread={[70, 46]} greens={["olive", "moss", "leaf"]} size={[0.7, 1.4]} />
        {[[-8, -6, 128, 150, "olive"], [20, -14, 150, 176, "moss"], [60, -18, 164, 96, "olive"], [-14, 40, 112, 140, "moss"], [110, -20, 172, 70, "leaf"], [20, 30, 128, 104, "leaf"]].map(([x, y, r, len, c], i) => (
          <Sprig key={i} x={x as number} y={y as number} r={r as number} len={len as number} c={c as "olive"} count={10} bend={26} leaf={1.4} />
        ))}
        <Bush x={388} y={6} seed={8} count={34} spread={[58, 40]} greens={["moss", "olive", "leaf"]} size={[0.7, 1.3]} />
        {[[400, -10, -134, 150, "moss"], [380, -20, -160, 120, "olive"], [404, 50, -118, 116, "leaf"], [350, -16, -170, 90, "olive"]].map(([x, y, r, len, c], i) => (
          <Sprig key={`r${i}`} x={x as number} y={y as number} r={r as number} len={len as number} c={c as "olive"} count={9} bend={-22} leaf={1.35} />
        ))}
        <Cluster x={26} y={62} seed={31} count={8} spread={[40, 36]} mix={[["blossom", "ivory"], ["cherry", "pink"], ["rose", "blush"]]} greens={["olive"]} sprigs={0} size={[0.42, 0.8]} />
        <Cluster x={366} y={44} seed={44} count={7} spread={[34, 30]} mix={[["cherry", "pink"], ["blossom", "ivory"], ["rose", "peach"]]} greens={["olive"]} sprigs={0} size={[0.42, 0.76]} />
      </Layer>
      <Layer depth={1} anchor="xMidYMax" className="sc-soft" role="fore-bottom">
        <Bush x={0} y={820} seed={21} count={40} spread={[76, 50]} greens={["olive", "moss", "deep"]} size={[0.8, 1.5]} />
        <Bush x={394} y={836} seed={27} count={30} spread={[60, 40]} greens={["moss", "olive", "deep"]} size={[0.8, 1.4]} />
        <Cluster x={2} y={812} seed={7} count={11} spread={[62, 50]} mix={[["rose", "peach"], ["rose", "blush"], ["blossom", "ivory"], ["rose", "ivory"]]} greens={["olive", "moss"]} sprigs={8} sprigLen={[60, 116]} size={[0.6, 1.25]} />
        <Cluster x={396} y={832} seed={23} count={8} spread={[50, 38]} mix={[["rose", "blush"], ["blossom", "ivory"], ["rose", "peach"]]} greens={["moss", "olive"]} sprigs={7} sprigLen={[50, 104]} size={[0.5, 1.05]} />
        <Petals seed={4} count={6} c="blush" box={[20, 560, 350, 240]} />
      </Layer>
    </>
  );
}

function Cover() {
  return (
    <>
      <div className="cv-frost" data-role="frost" style={{ background: "linear-gradient(180deg, rgba(255,238,226,.5), rgba(255,246,236,.34) 55%, rgba(246,214,200,.5))" }} />
      <Layer role="mist-l">
        <g filter="url(#f-blur18)" fill="#FFF7EF">
          <ellipse cx="40" cy="250" rx="190" ry="70" opacity=".9" />
          <ellipse cx="10" cy="520" rx="200" ry="86" opacity=".85" />
          <ellipse cx="80" cy="760" rx="210" ry="70" opacity=".8" />
        </g>
      </Layer>
      <Layer role="mist-r">
        <g filter="url(#f-blur18)" fill="#FFF7EF">
          <ellipse cx="360" cy="150" rx="190" ry="66" opacity=".85" />
          <ellipse cx="380" cy="420" rx="190" ry="80" opacity=".9" />
          <ellipse cx="330" cy="660" rx="200" ry="70" opacity=".8" />
        </g>
      </Layer>
    </>
  );
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 166, anchor: "top", width: 0.74 },
  namesOnCover: true,
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.fromTo(q(".hero-scene"), { scale: 1.14 }, { scale: 1, duration: 3.2, ease: "power2.out" }, 0)
      .to(q('[data-role="mist-l"]'), { xPercent: -70, opacity: 0, duration: 2.6, ease: "power1.inOut" }, 0)
      .to(q('[data-role="mist-r"]'), { xPercent: 70, opacity: 0, duration: 2.6, ease: "power1.inOut" }, 0)
      .to(q('[data-role="frost"]'), { opacity: 0, duration: 2.2, ease: "power1.inOut" }, 0.2)
      .from(q('[data-role="couple"]'), { yPercent: 2.4, duration: 2.8, ease: "power2.out" }, 0.2)
      .from(q('[data-role="fore-top"]'), { yPercent: -6, xPercent: -3, duration: 3, ease: "power2.out" }, 0)
      .from(q('[data-role="fore-bottom"]'), { yPercent: 7, duration: 3, ease: "power2.out" }, 0);
  },
};

export default art;
