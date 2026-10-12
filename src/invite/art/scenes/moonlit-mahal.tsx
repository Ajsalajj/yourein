import React from "react";
import { Layer, ArchWall, Cluster, Crescent, Clouds, Stars, archD, rng, n2, VW, VH } from "../kit";
import type { ArtModule } from "../types";

/* A moonlit Indo-Islamic palace beside still water. Signature design. */

const HORIZON = 520;
const STONE = "url(#mm-stone)", STONE_D = "#0D1634", RIM = "#9DB0DA", LIT = "#FFD98A";

type Win = { x: number; y: number; w: number; h: number };
/* window openings, in the order they light up: centre first, then outwards and upwards */
const WINS: Win[] = [
  { x: 195, y: 470, w: 26, h: 48 },
  { x: 160, y: 482, w: 12, h: 24 }, { x: 230, y: 482, w: 12, h: 24 },
  { x: 140, y: 482, w: 12, h: 24 }, { x: 250, y: 482, w: 12, h: 24 },
  { x: 160, y: 440, w: 10, h: 18 }, { x: 230, y: 440, w: 10, h: 18 },
  { x: 140, y: 440, w: 10, h: 18 }, { x: 250, y: 440, w: 10, h: 18 },
  { x: 96, y: 494, w: 11, h: 22 }, { x: 294, y: 494, w: 11, h: 22 },
  { x: 112, y: 494, w: 11, h: 22 }, { x: 278, y: 494, w: 11, h: 22 },
  { x: 62, y: 412, w: 5, h: 9 }, { x: 328, y: 412, w: 5, h: 9 },
  { x: 62, y: 368, w: 5, h: 9 }, { x: 328, y: 368, w: 5, h: 9 },
];

function onion(cx: number, base: number, w: number, h: number) {
  const hw = w / 2;
  return `M${cx - hw} ${base}C${cx - hw} ${base - h * 0.55} ${cx - hw * 0.22} ${base - h * 0.6} ${cx} ${base - h}C${cx + hw * 0.22} ${base - h * 0.6} ${cx + hw} ${base - h * 0.55} ${cx + hw} ${base}Z`;
}

function Minaret({ x, top, h, w = 11 }: { x: number; top: number; h: number; w?: number }) {
  return (
    <g>
      <rect x={x - w / 2} y={top} width={w} height={h} fill={STONE} />
      <rect x={x + w / 2 - 2} y={top} width="2" height={h} fill={RIM} opacity=".35" />
      {[0.32, 0.62].map((k) => (
        <g key={k}>
          <rect x={x - w / 2 - 3} y={top + h * k} width={w + 6} height="3" fill={STONE_D} />
          <path d={`M${x - w / 2 - 3} ${top + h * k + 0.5}H${x + w / 2 + 3}`} stroke="url(#au)" strokeWidth=".6" />
        </g>
      ))}
      <path d={onion(x, top, w + 6, 18)} fill={STONE} />
      <path d={`M${x} ${top - 18}V${top - 27}`} stroke="url(#au)" strokeWidth=".8" />
      <circle cx={x} cy={top - 28} r="1.4" fill="url(#au-r)" />
    </g>
  );
}

/** The palace itself; drawn twice, once upright and once mirrored in the water. */
const BASE = 548; /* the palace is drawn on this base line, then lifted to the horizon */

function Mahal({ lit = true, reflect = false }: { lit?: boolean; reflect?: boolean }) {
  return (
    <g transform="translate(0 -28)">
      {/* outer minarets */}
      <Minaret x={62} top={330} h={210} />
      <Minaret x={328} top={330} h={210} />
      {/* wings with chhatris */}
      {[95 + 8, 295 - 8].map((cx) => (
        <g key={cx}>
          <rect x={cx - 34} y={468} width="68" height={BASE - 468} fill={STONE} />
          <path d={`M${cx - 36} 468H${cx + 36}`} stroke="url(#au)" strokeWidth=".7" />
          <rect x={cx - 18} y={452} width="36" height="16" fill={STONE_D} />
          <path d={onion(cx, 452, 34, 34)} fill={STONE} />
          <path d={onion(cx, 452, 34, 34)} fill="none" stroke={RIM} strokeWidth=".5" opacity=".5" />
          <path d={`M${cx} 418V408`} stroke="url(#au)" strokeWidth=".8" />
        </g>
      ))}
      {/* inner minarets beside the dome */}
      <Minaret x={122} top={392} h={150} w={9} />
      <Minaret x={268} top={392} h={150} w={9} />
      {/* main hall */}
      <rect x={128} y={420} width="134" height={BASE - 420} fill={STONE} />
      <rect x={250} y={420} width="12" height={BASE - 420} fill={RIM} opacity=".12" />
      <path d="M126 420H264M126 424H264" stroke="url(#au)" strokeWidth=".6" />
      {/* crenellations along the hall and wings */}
      {Array.from({ length: 17 }, (_, i) => <path key={`c${i}`} d={`M${130 + i * 8} 420v-5a3 3 0 0 1 6 0v5z`} fill={STONE_D} />)}
      {[69, 261].map((x0) => Array.from({ length: 8 }, (_, i) => <path key={`w${x0}${i}`} d={`M${x0 + i * 8} 468v-4a3 3 0 0 1 6 0v4z`} fill={STONE_D} />))}
      {/* carved bands */}
      <path d="M128 432H262M128 508H262" stroke="url(#au)" strokeWidth=".5" opacity=".7" />
      <rect x="128" y="434" width="134" height="6" fill="url(#pat-jali)" opacity=".18" />
      {/* iwan: the great arched portal */}
      <path d={archD(195, 452, 48, BASE, "ogee")} fill={STONE_D} />
      <path d={archD(195, 446, 58, BASE, "ogee")} fill="none" stroke="url(#au)" strokeWidth="1.2" />
      <rect x="161" y="444" width="68" height={BASE - 444} fill="none" stroke="url(#au)" strokeWidth=".6" opacity=".8" />
      {[170, 220].map((x) => (
        <g key={x} transform={`translate(${x} 454)`}>
          <circle r="4.5" fill="none" stroke="url(#au)" strokeWidth=".7" />
          <circle r="1.4" fill="url(#au-r)" />
        </g>
      ))}
      {/* central dome on its drum */}
      <rect x={150} y={398} width="90" height="22" fill={STONE_D} />
      <path d="M150 398H240" stroke="url(#au)" strokeWidth=".8" />
      <path d={onion(195, 398, 112, 104)} fill={STONE} />
      <path d={onion(195, 398, 112, 104)} fill="none" stroke={RIM} strokeWidth=".7" opacity=".55" />
      <path d={onion(195, 398, 112, 104)} fill="url(#mm-dome-lit)" />
      <path d="M150 384H240M154 372H236" stroke="url(#au)" strokeWidth=".5" opacity=".6" />
      <path d="M195 296C186 330 166 356 152 392" fill="none" stroke="url(#au)" strokeWidth=".45" opacity=".55" />
      <path d="M195 296C204 330 224 356 238 392" fill="none" stroke="url(#au)" strokeWidth=".45" opacity=".55" />
      <path d="M195 294V278" stroke="url(#au)" strokeWidth="1.2" />
      <Crescent x={195} y={272} R={5} glow={false} />
      {/* terrace with its lamps */}
      <rect x={30} y={BASE - 12} width={330} height="14" fill={STONE_D} />
      <path d={`M30 ${BASE - 12}H360`} stroke="url(#au)" strokeWidth=".8" />
      {lit && [44, 84, 124, 164, 226, 266, 306, 346].map((x) => (
        <g key={`l${x}`} data-role={reflect ? undefined : "win"}>
          <circle cx={x} cy={BASE - 16} r="9" fill="url(#glow-warm)" opacity=".8" />
          <circle cx={x} cy={BASE - 16} r="1.6" fill="#FFE8B0" />
        </g>
      ))}
      {/* windows */}
      {WINS.map((w, i) => (
        <g key={i}>
          <path d={archD(w.x, w.y, w.w, w.y + w.h, "ogee")} fill="#0A1230" />
          {lit && (
            <g data-role={reflect ? undefined : "win"}>
              <circle cx={w.x} cy={w.y + w.h * 0.6} r={w.w * 1.6} fill="url(#glow-warm)" opacity=".75" />
              <path d={archD(w.x, w.y, w.w, w.y + w.h, "ogee")} fill={LIT} opacity=".95" />
            </g>
          )}
        </g>
      ))}
    </g>
  );
}

function Water() {
  const R = rng(14);
  /* gold streaks under each lit window and lamp, longer the nearer they are */
  const streaks = [...WINS.map((w) => w.x), 44, 84, 124, 164, 226, 266, 306, 346];
  return (
    <g>
      <rect x="-20" y={HORIZON} width={VW + 40} height={VH - HORIZON + 20} fill="url(#mm-water)" />
      <g data-role="reflection" transform={`translate(0 ${HORIZON * 2}) scale(1 -1)`} opacity=".55" filter="url(#f-blur1)" mask="url(#mm-fade)">
        <Mahal reflect />
      </g>
      <g filter="url(#f-blur3)">
        {streaks.map((x, i) => {
          const w = 1.5 + R() * 2.5;
          return <rect key={i} x={n2(x - w / 2)} y={HORIZON + 2} width={n2(w)} height={n2(26 + R() * 46)} fill="url(#mm-streak)" opacity={n2(0.35 + R() * 0.35)} />;
        })}
      </g>
      <ellipse cx="292" cy="700" rx="22" ry="170" fill="url(#glow-moon)" opacity=".55" />
      <g className="mm-ripples" stroke="#C3D0EE" strokeLinecap="round">
        {Array.from({ length: 70 }, (_, i) => {
          /* perspective: fine and dense at the horizon, longer and sparser near the viewer */
          const k = i / 70, y = HORIZON + 6 + k * k * (VH - HORIZON - 10), x = R() * VW, len = 6 + k * 70 + R() * 20;
          return <path key={i} d={`M${n2(x)} ${n2(y)}h${n2(len)}`} strokeWidth={n2(0.35 + k * 0.9)} opacity={n2(0.08 + R() * 0.2 * (1 - k * 0.4))} />;
        })}
        {Array.from({ length: 14 }, (_, i) => (
          <path key={`m${i}`} d={`M${n2(284 - R() * 10)} ${HORIZON + 20 + i * 22}h${n2(8 + i * 1.6 + R() * 12)}`} strokeWidth={n2(0.8 + i * 0.05)} opacity=".6" />
        ))}
      </g>
    </g>
  );
}

function JasmineStrings() {
  const R = rng(31);
  return (
    <g data-role="strings">
      {[58, 84, 306, 332].map((x, k) => {
        const len = 120 + (k % 2) * 46;
        return (
          <g key={x}>
            <path d={`M${x} 112V${112 + len}`} stroke="#3B4A6E" strokeWidth=".6" />
            {Array.from({ length: Math.floor(len / 9) }, (_, i) => (
              <circle key={i} cx={x + (R() - 0.5) * 2} cy={118 + i * 9} r={n2(2.2 + R() * 0.9)} fill="#F5F1E4" opacity={n2(0.82 + R() * 0.18)} />
            ))}
            <circle cx={x} cy={118 + len} r="3.4" fill="url(#au-r)" />
          </g>
        );
      })}
    </g>
  );
}

function Defs() {
  return (
    <defs>
      <linearGradient id="mm-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#03071A" />
        <stop offset=".42" stopColor="#0A1638" />
        <stop offset=".62" stopColor="#1B2C5A" />
        <stop offset=".65" stopColor="#2E4170" />
      </linearGradient>
      <linearGradient id="mm-stone" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#0F1A3E" />
        <stop offset=".55" stopColor="#18285A" />
        <stop offset="1" stopColor="#2A3E78" />
      </linearGradient>
      <radialGradient id="mm-dome-lit" cx=".72" cy=".3" r=".7">
        <stop offset="0" stopColor="#B8C8EE" stopOpacity=".42" />
        <stop offset=".5" stopColor="#6E84BC" stopOpacity=".12" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="mm-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#14254F" />
        <stop offset=".35" stopColor="#0B1736" />
        <stop offset="1" stopColor="#040917" />
      </linearGradient>
      {/* the reflection is drawn upright then flipped, so its fade runs upwards in its own space */}
      <linearGradient id="mm-fade-g" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity=".95" />
        <stop offset=".55" stopColor="#fff" stopOpacity=".3" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <mask id="mm-fade" maskUnits="userSpaceOnUse" x="0" y={HORIZON - 300} width={VW} height="300">
        <rect x="0" y={HORIZON - 300} width={VW} height="300" fill="url(#mm-fade-g)" />
      </mask>
      <linearGradient id="mm-streak" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFD98A" stopOpacity=".7" />
        <stop offset="1" stopColor="#FFD98A" stopOpacity="0" />
      </linearGradient>
    </defs>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.03}>
        <Defs />
        <rect x="-20" y="-20" width={VW + 40} height={HORIZON + 40} fill="url(#mm-sky)" />
        <Stars seed={21} count={90} y0={40} y1={HORIZON - 80} color="#EEF2FF" />
        <ellipse cx="195" cy={HORIZON} rx="260" ry="70" fill="#5E74A8" opacity=".18" filter="url(#f-blur18)" />
      </Layer>
      <Layer depth={0.06} role="moon">
        <Crescent x={292} y={176} R={28} fill="#F4F1E6" />
        <circle cx="292" cy="176" r="62" fill="#DCE5FF" opacity=".08" />
      </Layer>
      <Layer depth={0.1} role="clouds">
        <Clouds seed={8} count={6} y={196} spreadY={60} color="#A9B9DF" o={0.16} blur="f-blur8" />
      </Layer>
      <Layer depth={0.2} role="palace">
        <Mahal />
      </Layer>
      <Layer depth={0.26} role="water">
        <Water />
      </Layer>
      <Layer depth={0.55} role="arch">
        <ArchWall top={96} w={352} kind="cusped" fill="#070E26" pattern="pat-jali" patternOpacity={0.1} trim="url(#au)" trimWidth={2.2} />
        <path d={archD(195, 108, 334, VH + 20, "cusped")} fill="none" stroke="url(#au)" strokeWidth=".7" opacity=".8" />
        <JasmineStrings />
      </Layer>
      <Layer depth={1} role="fore" className="sc-soft">
        <Cluster x={14} y={800} seed={3} count={9} spread={[52, 34]} mix={[["jasmine", "white"], ["bud", "white"], ["jasmine", "white"]]} greens={["night", "deep"]} sprigs={6} sprigLen={[60, 110]} size={[0.55, 1.05]} />
        <Cluster x={376} y={806} seed={12} count={9} spread={[52, 34]} mix={[["jasmine", "white"], ["bud", "white"], ["jasmine", "white"]]} greens={["night", "deep"]} sprigs={6} sprigLen={[60, 110]} size={[0.55, 1.05]} />
      </Layer>
    </>
  );
}

/** Before the first tap: the night almost black, a sliver of moon low on the horizon. */
function Cover() {
  return (
    <Layer>
      <rect data-role="night" x="-20" y="-20" width={VW + 40} height={VH + 40} fill="#02040C" />
      <g data-role="hint" opacity=".7">
        <path d={archD(195, 250, 150, 560, "cusped")} fill="none" stroke="url(#au)" strokeWidth=".8" opacity=".55" />
        <Crescent x={195} y={402} R={16} fill="#E9E6DA" />
      </g>
    </Layer>
  );
}

const EASE = "power3.out";

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 632, anchor: "mid", width: 0.62, widthTall: 0.52, scale: 0.86 },
  coverInk: "#E6DDBF",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    const wins = root.querySelectorAll('[data-role="palace"] [data-role="win"]');
    tl.to(q('[data-role="hint"]'), { opacity: 0, duration: 0.5, ease: "power1.out" }, 0)
      /* the night lifts slowly; the moon climbs from below the horizon */
      .to(q('[data-role="night"]'), { opacity: 0, duration: 2.2, ease: "power1.inOut" }, 0.2)
      .fromTo(q('[data-role="moon"]'), { yPercent: 22, opacity: 0.3 }, { yPercent: 0, opacity: 1, duration: 2.6, ease: EASE }, 0.1)
      .fromTo(q('[data-role="palace"]'), { opacity: 0.15, filter: "brightness(0.35)" }, { opacity: 1, filter: "brightness(1)", duration: 1.8, ease: "power2.out" }, 0.6)
      /* windows light one by one, centre outwards */
      .fromTo(wins, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power1.out", stagger: 0.07 }, 1.1)
      .fromTo(q('[data-role="water"]'), { opacity: 0 }, { opacity: 1, duration: 1.4, ease: "power1.out" }, 1.5)
      .fromTo(q('[data-role="arch"], [data-role="fore"]'), { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 1.8, ease: EASE }, 1.2)
      .fromTo(q(".hero-scene"), { scale: 1.06 }, { scale: 1, duration: 3.4, ease: EASE }, 0)
      .to(q(".cover"), { opacity: 0, duration: 0.4 }, 2.4);
  },
};

export default art;
