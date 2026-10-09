/**
 * YoureIn art kit.
 *
 * Every invitation scene is drawn from these original vector pieces: flowers,
 * foliage, architecture, lamps, paper and silk. Scenes stack them in separate
 * <Layer>s so each depth can move on its own while the guest scrolls.
 *
 * All drawing happens on a 390 x 844 artboard (a tall phone screen).
 */
import React from "react";

export const VW = 390;
export const VH = 844;

/* ------------------------------------------------------------------ utils */

/** Small seeded random generator so every scene draws the same way each time. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const n2 = (v: number) => Math.round(v * 100) / 100;
const rad = (d: number) => (d * Math.PI) / 180;

type At = { x?: number; y?: number; s?: number; r?: number; o?: number; flip?: boolean };
function tf({ x = 0, y = 0, s = 1, r = 0, flip }: At) {
  return `translate(${n2(x)} ${n2(y)})${r ? ` rotate(${n2(r)})` : ""} scale(${flip ? -n2(s) : n2(s)} ${n2(s)})`;
}

export type Pt = [number, number];

export function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, count: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rad(a0 + ((a1 - a0) * i) / Math.max(1, count - 1));
    return [n2(cx + Math.cos(a) * rx), n2(cy + Math.sin(a) * ry)] as Pt;
  });
}
export function linePts(x0: number, y0: number, x1: number, y1: number, count: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(1, count - 1);
    return [n2(x0 + (x1 - x0) * t), n2(y0 + (y1 - y0) * t)] as Pt;
  });
}
export function quadPts(p0: Pt, p1: Pt, p2: Pt, count: number): Pt[] {
  return Array.from({ length: count }, (_, i) => {
    const t = i / Math.max(1, count - 1);
    const u = 1 - t;
    return [n2(u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0]), n2(u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1])] as Pt;
  });
}

/* ------------------------------------------------------------------ layer */

type LayerProps = {
  /** 0 = far background (moves least), 1 = closest to the viewer (moves most). */
  depth?: number;
  role?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  /** Where the artwork anchors when the screen is not exactly 390:844. */
  anchor?: "xMidYMid" | "xMidYMin" | "xMidYMax";
};

export function Layer({ depth = 0, role, className, style, children, anchor = "xMidYMid" }: LayerProps) {
  return (
    <div className={`sc-layer${className ? ` ${className}` : ""}`} data-depth={depth} data-role={role} style={style}>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio={`${anchor} slice`} aria-hidden="true" focusable="false">
        {children}
      </svg>
    </div>
  );
}

/* --------------------------------------------------------------- palettes */

/** highlight, light, mid, deep */
export const PETALS = {
  blush: ["#FFF6F3", "#F9DAD5", "#EEB3B1", "#CF8088"],
  rose: ["#FFECEC", "#F7BFC5", "#E78E9C", "#BF5B6F"],
  pink: ["#FFF8FA", "#FFDFE7", "#F9B7C8", "#DE7F9B"],
  ivory: ["#FFFFFF", "#FCF6EA", "#EFE1C6", "#CBB48C"],
  white: ["#FFFFFF", "#F8F7F2", "#E3E7DC", "#B5BFA9"],
  peach: ["#FFF4E8", "#FCDBC0", "#F4B991", "#D98C65"],
  marigold: ["#FFE391", "#FFC13F", "#F7961F", "#CF650B"],
  saffron: ["#FFCB70", "#FFA232", "#F07712", "#BD4B07"],
  gold: ["#FFF3C8", "#EFD28E", "#CFA658", "#9A7430"],
  red: ["#F8B5AB", "#E26F66", "#BF3D3F", "#8D202A"],
  night: ["#FFFFFF", "#EEF1FA", "#C9D2EC", "#8E9CCB"],
} as const;
export type PetalColor = keyof typeof PETALS;

/** light, mid, dark */
export const GREENS = {
  sage: ["#CDD7BA", "#A1B28B", "#70865F"],
  leaf: ["#AEC78F", "#73A05F", "#3F6C3A"],
  deep: ["#679363", "#34653F", "#184029"],
  olive: ["#C7C993", "#999E5D", "#646B36"],
  emerald: ["#46947A", "#1F6149", "#0D3A2B"],
  gilt: ["#F2DCA4", "#CFA658", "#96712E"],
  night: ["#7E9CB3", "#46678A", "#22395A"],
  moss: ["#B9C59B", "#869A6C", "#566A48"],
} as const;
export type GreenColor = keyof typeof GREENS;

/* ------------------------------------------------------------------- defs */

/** Shared gradients, filters and patterns. Rendered once per invitation. */
export function ArtDefs() {
  return (
    <svg className="art-defs" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        {(Object.keys(PETALS) as PetalColor[]).map((k) => (
          <radialGradient key={k} id={`pg-${k}`} cx="50%" cy="30%" r="80%">
            <stop offset="0" stopColor={PETALS[k][0]} />
            <stop offset=".55" stopColor={PETALS[k][1]} />
            <stop offset="1" stopColor={PETALS[k][2]} />
          </radialGradient>
        ))}
        {(Object.keys(GREENS) as GreenColor[]).map((k) => (
          <linearGradient key={k} id={`lg-${k}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={GREENS[k][0]} />
            <stop offset=".55" stopColor={GREENS[k][1]} />
            <stop offset="1" stopColor={GREENS[k][2]} />
          </linearGradient>
        ))}
        {/* gold foil, three directions */}
        <linearGradient id="au" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F6E3A8" />
          <stop offset=".32" stopColor="#D2A956" />
          <stop offset=".55" stopColor="#F3DC9C" />
          <stop offset=".8" stopColor="#B58A3A" />
          <stop offset="1" stopColor="#E6C983" />
        </linearGradient>
        <linearGradient id="au-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#9C7630" />
          <stop offset=".28" stopColor="#F4DE9E" />
          <stop offset=".55" stopColor="#D0A552" />
          <stop offset="1" stopColor="#8C6827" />
        </linearGradient>
        <linearGradient id="au-v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F5E2A6" />
          <stop offset=".5" stopColor="#CFA555" />
          <stop offset="1" stopColor="#9A7430" />
        </linearGradient>
        <radialGradient id="au-r" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#F7E2A4" />
          <stop offset=".45" stopColor="#D4A853" />
          <stop offset="1" stopColor="#8F6A28" />
        </radialGradient>
        {/* satin sheen */}
        <linearGradient id="satin-blush" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3C3BC" />
          <stop offset=".22" stopColor="#FCE7E2" />
          <stop offset=".45" stopColor="#EDB4AD" />
          <stop offset=".7" stopColor="#F9D8D2" />
          <stop offset="1" stopColor="#DFA19B" />
        </linearGradient>
        <linearGradient id="satin-blush-h" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#E3A8A2" />
          <stop offset=".3" stopColor="#FBE3DE" />
          <stop offset=".6" stopColor="#ECB3AC" />
          <stop offset="1" stopColor="#F7D3CD" />
        </linearGradient>
        <linearGradient id="satin-pearl" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset=".3" stopColor="#EFE9DD" />
          <stop offset=".5" stopColor="#FFFFFF" />
          <stop offset=".75" stopColor="#E6DFD0" />
          <stop offset="1" stopColor="#FBF8F1" />
        </linearGradient>
        {/* light */}
        <radialGradient id="glow-warm">
          <stop offset="0" stopColor="#FFE9B0" stopOpacity=".95" />
          <stop offset=".35" stopColor="#FFD27A" stopOpacity=".45" />
          <stop offset="1" stopColor="#FFC65C" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-sun">
          <stop offset="0" stopColor="#FFF6DC" stopOpacity="1" />
          <stop offset=".25" stopColor="#FFE2B0" stopOpacity=".75" />
          <stop offset="1" stopColor="#FFC98F" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-moon">
          <stop offset="0" stopColor="#FFF7DD" stopOpacity=".9" />
          <stop offset=".3" stopColor="#E9DFC0" stopOpacity=".32" />
          <stop offset="1" stopColor="#C9C7E8" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-white">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="shade-r">
          <stop offset="0" stopColor="#000" stopOpacity=".34" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="shade-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity=".18" />
          <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <linearGradient id="shade-down" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".28" />
        </linearGradient>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4A2A16" />
          <stop offset=".3" stopColor="#7A4A26" />
          <stop offset=".6" stopColor="#5E371C" />
          <stop offset="1" stopColor="#3C2010" />
        </linearGradient>
        <linearGradient id="flame" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#F59A2C" />
          <stop offset=".5" stopColor="#FFD77A" />
          <stop offset="1" stopColor="#FFF8DE" />
        </linearGradient>
        {/* filters */}
        <filter id="f-blur1" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.2" /></filter>
        <filter id="f-blur3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
        <filter id="f-blur8" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8" /></filter>
        <filter id="f-blur18" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="18" /></filter>
        <filter id="f-drop" x="-30%" y="-30%" width="160%" height="170%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="5" />
          <feOffset dy="6" />
          <feComponentTransfer><feFuncA type="linear" slope=".28" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="f-drop-s" x="-30%" y="-30%" width="160%" height="170%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" />
          <feOffset dy="2.5" />
          <feComponentTransfer><feFuncA type="linear" slope=".24" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        {/* watercolour edge for painted foliage */}
        <filter id="f-wash" x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5" />
        </filter>
        {/* patterns */}
        <pattern id="pat-ogee" width="46" height="66" patternUnits="userSpaceOnUse">
          <path d="M23 0C23 14 46 19 46 33C46 47 23 52 23 66C23 52 0 47 0 33C0 19 23 14 23 0Z" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" />
          <path d="M23 24l4 9-4 9-4-9z" fill="#fff" fillOpacity=".4" />
          <circle cx="0" cy="0" r="2" fill="#fff" fillOpacity=".35" />
          <circle cx="46" cy="0" r="2" fill="#fff" fillOpacity=".35" />
          <circle cx="0" cy="66" r="2" fill="#fff" fillOpacity=".35" />
          <circle cx="46" cy="66" r="2" fill="#fff" fillOpacity=".35" />
        </pattern>
        <pattern id="pat-jali" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M12 0l12 12-12 12L0 12z" fill="none" stroke="url(#au)" strokeWidth="1" />
          <circle cx="12" cy="12" r="4.4" fill="none" stroke="url(#au)" strokeWidth=".9" />
          <path d="M0 0l5 5M24 0l-5 5M0 24l5-5M24 24l-5-5" stroke="url(#au)" strokeWidth=".8" />
        </pattern>
        <pattern id="pat-tile" width="12" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8Q6 2 12 8" fill="none" stroke="#000" strokeOpacity=".22" strokeWidth="1" />
          <path d="M-6 4Q0 -2 6 4M6 4Q12 -2 18 4" fill="none" stroke="#fff" strokeOpacity=".12" strokeWidth=".8" />
        </pattern>
        <pattern id="pat-carve" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M10 2c4 2 6 6 0 16c-6-10-4-14 0-16z" fill="none" stroke="#000" strokeOpacity=".25" strokeWidth=".9" />
          <path d="M10 1.2c4 2 6 6 0 16" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth=".7" />
          <circle cx="0" cy="10" r="1.6" fill="#000" fillOpacity=".2" />
          <circle cx="20" cy="10" r="1.6" fill="#000" fillOpacity=".2" />
        </pattern>
      </defs>
    </svg>
  );
}

/* ---------------------------------------------------------------- flowers */

type FlowerProps = At & { c?: PetalColor };

export function Rose({ c = "blush", ...at }: FlowerProps) {
  const p = PETALS[c];
  const st = { stroke: p[3], strokeOpacity: 0.3, strokeWidth: 0.6 };
  return (
    <g transform={tf(at)} opacity={at.o}>
      <circle r="21" fill={p[2]} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <ellipse key={`a${i}`} cy="-12" rx="12.6" ry="11" transform={`rotate(${i * 60})`} fill={`url(#pg-${c})`} {...st} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <ellipse key={`b${i}`} cy="-7.4" rx="9" ry="8" transform={`rotate(${i * 72 + 28})`} fill={p[1]} {...st} />
      ))}
      {[0, 1, 2].map((i) => (
        <ellipse key={`c${i}`} cy="-3.4" rx="6" ry="5.2" transform={`rotate(${i * 120 + 12})`} fill={`url(#pg-${c})`} {...st} strokeOpacity={0.4} />
      ))}
      <path d="M-2.6.6a2.8 2.8 0 1 1 4.6 1.6a4.6 4.6 0 1 1-7.2-3.8" fill="none" stroke={p[3]} strokeOpacity=".7" strokeWidth=".9" strokeLinecap="round" />
    </g>
  );
}

/** Open five-petal flower. `notch` gives the cherry-blossom petal tip. */
export function Blossom({ c = "pink", notch, centre = "#E9B95A", ...at }: FlowerProps & { notch?: boolean; centre?: string }) {
  const p = PETALS[c];
  const d = notch ? "M0 0C-9-5-10.5-16-3.2-21L0-18.4L3.2-21C10.5-16 9-5 0 0Z" : "M0 0C-9-5-10.5-17 0-21.5C10.5-17 9-5 0 0Z";
  return (
    <g transform={tf(at)} opacity={at.o}>
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={d} transform={`rotate(${i * 72})`} fill={`url(#pg-${c})`} stroke={p[3]} strokeOpacity=".28" strokeWidth=".5" />
      ))}
      <circle r="5" fill={p[2]} opacity=".55" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={`s${i}`} transform={`rotate(${i * 51 + 14})`}>
          <path d="M0 0V-6.4" stroke={centre} strokeWidth=".5" />
          <circle cy="-6.8" r=".95" fill={centre} />
        </g>
      ))}
      <circle r="1.7" fill={centre} />
    </g>
  );
}

export function Jasmine({ c = "white", ...at }: FlowerProps) {
  const p = PETALS[c];
  return (
    <g transform={tf(at)} opacity={at.o}>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path key={i} d="M0 0C-5-5-5.6-13.5 0-18C5.6-13.5 5-5 0 0Z" transform={`rotate(${i * 60})`} fill={`url(#pg-${c})`} stroke={p[3]} strokeOpacity=".32" strokeWidth=".45" />
      ))}
      <circle r="2.1" fill="#EAD58C" />
      <circle r="1" fill="#C9A94F" />
    </g>
  );
}

export function Bud({ c = "white", ...at }: FlowerProps) {
  const p = PETALS[c];
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d="M0 0C-4.4-4-4.4-11 0-15C4.4-11 4.4-4 0 0Z" fill={`url(#pg-${c})`} stroke={p[3]} strokeOpacity=".35" strokeWidth=".45" />
      <path d="M0 0C-2.4 2-2.6 5 0 7C2.6 5 2.4 2 0 0Z" fill="#8FA672" />
    </g>
  );
}

export function Orchid({ c = "white", ...at }: FlowerProps) {
  const p = PETALS[c];
  const st = { stroke: p[3], strokeOpacity: 0.55, strokeWidth: 0.5 };
  return (
    <g transform={tf(at)} opacity={at.o}>
      {[0, 128, -128].map((r) => (
        <path key={r} d="M0 0C-6.4-8-6.4-21 0-27C6.4-21 6.4-8 0 0Z" transform={`rotate(${r})`} fill={p[2]} {...st} />
      ))}
      {[64, -64].map((r) => (
        <g key={r} transform={`rotate(${r})`}>
          <path d="M0 0C-14-3-18-20-3-27C12-26 15-9 0 0Z" fill={`url(#pg-${c})`} {...st} />
          <path d="M0-2C-3-9-3-16-2-22" fill="none" stroke={p[3]} strokeOpacity=".3" strokeWidth=".5" />
        </g>
      ))}
      <path d="M0 0C-7 2-9 9-4 13C-1 15 1 15 4 13C9 9 7 2 0 0Z" fill="#F6D36E" stroke="#C99A3A" strokeOpacity=".6" strokeWidth=".4" />
      <path d="M-4 4C-6 8-3 12 0 12.6C3 12 6 8 4 4C2 6-2 6-4 4Z" fill="#C4577A" opacity=".75" />
      <circle cy="-1.4" r="2.4" fill="#fff" stroke={p[3]} strokeOpacity=".5" strokeWidth=".4" />
      <circle cy="-1.4" r=".9" fill="#D9A441" />
    </g>
  );
}

function scallop(r: number, count: number, rot = 0) {
  let d = "";
  const rr = n2(((2 * Math.PI * r) / count) * 0.56);
  for (let i = 0; i <= count; i++) {
    const a = rot + (i * 2 * Math.PI) / count;
    const px = n2(Math.cos(a) * r);
    const py = n2(Math.sin(a) * r);
    d += i === 0 ? `M${px} ${py}` : `A${rr} ${rr} 0 0 1 ${px} ${py}`;
  }
  return d + "Z";
}

const MG_RINGS: [number, number, number, number][] = [
  [20, 15, 0, 3],
  [16, 13, 0.3, 2],
  [12, 11, 0.1, 1],
  [8, 8, 0.4, 2],
  [4.4, 6, 0, 1],
];
const MG_PATHS = MG_RINGS.map(([r, c, rot]) => scallop(r, c, rot));

export function Marigold({ c = "marigold", ...at }: FlowerProps) {
  const p = PETALS[c];
  return (
    <g transform={tf(at)} opacity={at.o}>
      {MG_PATHS.map((d, i) => (
        <path key={i} d={d} fill={p[MG_RINGS[i][3]]} stroke={p[3]} strokeOpacity=".45" strokeWidth=".5" />
      ))}
      <circle r="1.8" fill={p[0]} />
    </g>
  );
}

export type FlowerKind = "rose" | "blossom" | "cherry" | "jasmine" | "bud" | "orchid" | "marigold";

export function Flower({ kind, ...p }: FlowerProps & { kind: FlowerKind }) {
  switch (kind) {
    case "rose": return <Rose {...p} />;
    case "blossom": return <Blossom {...p} />;
    case "cherry": return <Blossom notch centre="#D9778F" {...p} />;
    case "jasmine": return <Jasmine {...p} />;
    case "bud": return <Bud {...p} />;
    case "orchid": return <Orchid {...p} />;
    case "marigold": return <Marigold {...p} />;
  }
}

/* ---------------------------------------------------------------- foliage */

export function Leaf({ c = "sage", ...at }: At & { c?: GreenColor }) {
  const g = GREENS[c];
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d="M0 0C8-7 9-22 0-32C-9-22-8-7 0 0Z" fill={`url(#lg-${c})`} />
      <path d="M0-1.5V-28" stroke={g[2]} strokeOpacity=".5" strokeWidth=".6" />
    </g>
  );
}

/** A curved stem with leaves on alternating sides. */
export function Sprig({
  c = "sage", count = 7, len = 90, bend = 18, leaf = 1, stem, ...at
}: At & { c?: GreenColor; count?: number; len?: number; bend?: number; leaf?: number; stem?: string }) {
  const g = GREENS[c];
  const p0: Pt = [0, 0], p1: Pt = [bend, -len * 0.5], p2: Pt = [-bend * 0.25, -len];
  const leaves: React.ReactNode[] = [];
  for (let i = 0; i < count; i++) {
    const t = 0.16 + (0.84 * i) / Math.max(1, count - 1);
    const u = 1 - t;
    const x = u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0];
    const y = u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1];
    const dx = 2 * u * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * u * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    const last = i === count - 1;
    const side = last ? 0 : i % 2 ? 52 : -52;
    leaves.push(<Leaf key={i} c={c} x={x} y={y} r={ang + side} s={(1 - t * 0.45) * 0.62 * leaf} />);
  }
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d={`M0 0Q${n2(p1[0])} ${n2(p1[1])} ${n2(p2[0])} ${n2(p2[1])}`} fill="none" stroke={stem || g[2]} strokeWidth="1.1" strokeLinecap="round" />
      {leaves}
    </g>
  );
}

type Mix = [FlowerKind, PetalColor][];

/** A bouquet: sprigs fanned underneath, flowers packed on top. */
export function Cluster({
  seed = 1, count = 7, spread = [56, 40], mix = [["rose", "blush"]], greens = ["sage"], sprigs = 6, size = [0.55, 1.15], sprigLen = [44, 86], ...at
}: At & { seed?: number; count?: number; spread?: [number, number]; mix?: Mix; greens?: GreenColor[]; sprigs?: number; size?: [number, number]; sprigLen?: [number, number] }) {
  const R = rng(seed);
  const stems = Array.from({ length: sprigs }, (_, i) => {
    const a = (360 / sprigs) * i + R() * 40;
    return (
      <Sprig key={`s${i}`} c={greens[i % greens.length]} x={(R() - 0.5) * spread[0] * 0.5} y={(R() - 0.5) * spread[1] * 0.5}
        r={a} len={sprigLen[0] + R() * (sprigLen[1] - sprigLen[0])} bend={(R() - 0.5) * 40} count={5 + Math.floor(R() * 4)} leaf={0.9 + R() * 0.5} />
    );
  });
  const items = Array.from({ length: count }, (_, i) => {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    return { i, x: Math.cos(a) * d * spread[0], y: Math.sin(a) * d * spread[1], d, r: R() * 360, k: R() };
  }).sort((p, q) => q.d - p.d);
  return (
    <g transform={tf(at)} opacity={at.o}>
      {stems}
      {items.map((it) => {
        const [kind, c] = mix[it.i % mix.length];
        const s = size[0] + (1 - it.d) * (size[1] - size[0]) * (0.7 + it.k * 0.3);
        return <Flower key={it.i} kind={kind} c={c} x={it.x} y={it.y} r={it.r} s={s} />;
      })}
    </g>
  );
}

/** Flowers and leaves strung along a line of points. */
export function Garland({
  pts, seed = 1, mix = [["rose", "blush"]], greens = ["sage"], size = [0.4, 0.75], jitter = 6, leaves = true,
}: { pts: Pt[]; seed?: number; mix?: Mix; greens?: GreenColor[]; size?: [number, number]; jitter?: number; leaves?: boolean }) {
  const R = rng(seed);
  return (
    <g>
      {leaves && pts.map(([x, y], i) => (
        <Leaf key={`l${i}`} c={greens[i % greens.length]} x={x + (R() - 0.5) * jitter} y={y + (R() - 0.5) * jitter} r={R() * 360} s={0.5 + R() * 0.45} />
      ))}
      {pts.map(([x, y], i) => {
        const [kind, c] = mix[Math.floor(R() * mix.length)];
        return <Flower key={i} kind={kind} c={c} x={x + (R() - 0.5) * jitter} y={y + (R() - 0.5) * jitter} r={R() * 360} s={size[0] + R() * (size[1] - size[0])} />;
      })}
    </g>
  );
}

/** A flowering branch (cherry blossom, jasmine vine). Grows from 0,0 to the right. */
export function Branch({
  seed = 1, len = 260, kind = "cherry", c = "pink", bark = "#6B4636", flowers = 22, twigs = 5, greens, ...at
}: At & { seed?: number; len?: number; kind?: FlowerKind; c?: PetalColor; bark?: string; flowers?: number; twigs?: number; greens?: GreenColor }) {
  const R = rng(seed);
  const main: Pt[] = quadPts([0, 0], [len * 0.45, -len * 0.16], [len, -len * 0.04], 24);
  const twigEls: React.ReactNode[] = [];
  const spots: Pt[] = [];
  for (let i = 0; i < twigs; i++) {
    const base = main[4 + Math.floor(((main.length - 6) * i) / twigs)];
    const up = i % 2 === 0 ? -1 : 1;
    const tl = len * (0.16 + R() * 0.16);
    const ex = base[0] + tl * (0.55 + R() * 0.3);
    const ey = base[1] + up * tl * (0.5 + R() * 0.4);
    const cxp = base[0] + tl * 0.2;
    const cyp = base[1] + up * tl * 0.55;
    twigEls.push(<path key={i} d={`M${base[0]} ${base[1]}Q${n2(cxp)} ${n2(cyp)} ${n2(ex)} ${n2(ey)}`} fill="none" stroke={bark} strokeWidth={n2(2.4 - i * 0.2)} strokeLinecap="round" />);
    quadPts(base, [cxp, cyp], [ex, ey], 5).slice(1).forEach((p) => spots.push(p));
  }
  main.filter((_, i) => i % 3 === 1).forEach((p) => spots.push(p));
  const d = `M0 0Q${n2(len * 0.45)} ${n2(-len * 0.16)} ${n2(len)} ${n2(-len * 0.04)}`;
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d={d} fill="none" stroke={bark} strokeWidth="5" strokeLinecap="round" />
      <path d={d} fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="1.4" strokeLinecap="round" transform="translate(0 -1.2)" />
      {twigEls}
      {greens && spots.map((p, i) => i % 2 === 0 && <Leaf key={`g${i}`} c={greens} x={p[0]} y={p[1]} r={R() * 360} s={0.5 + R() * 0.3} />)}
      {Array.from({ length: flowers }, (_, i) => {
        const p = spots[Math.floor(R() * spots.length)];
        const bud = R() < 0.18;
        return <Flower key={i} kind={bud ? "bud" : kind} c={c} x={p[0] + (R() - 0.5) * 22} y={p[1] + (R() - 0.5) * 22} r={R() * 360} s={0.42 + R() * 0.42} />;
      })}
    </g>
  );
}

/** Coconut-palm frond: one path with a feathered lower edge. */
function frondD(len: number, droop: number, width: number) {
  const steps = 16;
  const top: string[] = [];
  const bot: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = len * t;
    const y = droop * t * t;
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.7;
    top.push(`${n2(x)} ${n2(y - w * 0.35)}`);
    bot.push(`${n2(x - 4)} ${n2(y + w * (i % 2 ? 1 : 0.35))}`);
  }
  return `M0 0L${top.join("L")}L${bot.reverse().join("L")}Z`;
}
const FRONDS = [
  [-168, 74, 26, 15], [-140, 86, 20, 16], [-112, 90, 12, 16], [-84, 78, 8, 14], [-58, 88, 14, 16],
  [-34, 90, 22, 16], [-10, 78, 30, 15], [14, 62, 30, 13], [-190, 58, 30, 12],
].map(([r, l, dr, w]) => ({ r, d: frondD(l, dr, w) }));

export function Palm({ h = 220, lean = 30, c = "deep", trunk = "#7B5B3E", ...at }: At & { h?: number; lean?: number; c?: GreenColor; trunk?: string }) {
  const g = GREENS[c];
  const tx = lean, ty = -h;
  const d = `M-5 0Q${n2(lean * 0.2 - 4)} ${n2(-h * 0.5)} ${n2(tx - 3)} ${ty}L${n2(tx + 3)} ${ty}Q${n2(lean * 0.2 + 5)} ${n2(-h * 0.5)} 6 0Z`;
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d={d} fill={trunk} />
      <path d={d} fill="url(#shade-side)" />
      {quadPts([0, 0], [lean * 0.2, -h * 0.5], [tx, ty], 16).slice(1, -1).map((p, i) => (
        <path key={i} d={`M${n2(p[0] - 4.4)} ${p[1]}h8.8`} stroke="#000" strokeOpacity=".16" strokeWidth=".9" />
      ))}
      <g transform={`translate(${n2(tx)} ${ty})`}>
        {FRONDS.map((f, i) => (
          <path key={i} d={f.d} transform={`rotate(${f.r})`} fill={i % 3 === 0 ? g[2] : i % 3 === 1 ? g[1] : `url(#lg-${c})`} />
        ))}
        <circle r="4.5" cx="-2" cy="4" fill="#6B4A2C" />
        <circle r="4" cx="4" cy="6" fill="#7A5632" />
      </g>
    </g>
  );
}

export function BananaLeaf({ c = "leaf", len = 170, ...at }: At & { c?: GreenColor; len?: number }) {
  const g = GREENS[c];
  const w = len * 0.17;
  const veins = Array.from({ length: 12 }, (_, i) => {
    const y = -len * (0.08 + i * 0.072);
    const ww = w * Math.sin(Math.PI * (0.08 + i * 0.072)) * 1.05;
    return `M0 ${n2(y)}L${n2(-ww)} ${n2(y - 9)}M0 ${n2(y)}L${n2(ww)} ${n2(y - 9)}`;
  }).join("");
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d={`M0 0C${-w * 1.5} ${-len * 0.2} ${-w * 1.6} ${-len * 0.7} 0 ${-len}C${w * 1.6} ${-len * 0.7} ${w * 1.5} ${-len * 0.2} 0 0Z`} fill={`url(#lg-${c})`} />
      <path d={veins} stroke={g[2]} strokeOpacity=".35" strokeWidth=".6" fill="none" />
      <path d={`M0 6V${-len + 4}`} stroke={g[0]} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

/* ------------------------------------------------------------- landscapes */

/** A filled ridge line: hills, mountains, tree lines. */
export function ridge(seed: number, y: number, amp: number, o: { sharp?: number; freq?: number; x0?: number; x1?: number; bottom?: number; tilt?: number } = {}) {
  const { sharp = 0, freq = 1, x0 = -20, x1 = VW + 20, bottom = VH + 10, tilt = 0 } = o;
  const R = rng(seed);
  const p = [R() * 6, R() * 6, R() * 6, R() * 6];
  let d = `M${x0} ${bottom}`;
  for (let x = x0; x <= x1; x += 8) {
    const k = (x / VW) * freq;
    const smooth = 0.55 * Math.sin(k * 5 + p[0]) + 0.3 * Math.sin(k * 11 + p[1]) + 0.15 * Math.sin(k * 23 + p[2]);
    const peak = 1 - 2 * Math.abs(Math.sin(k * 4.2 + p[3]));
    const v = smooth * (1 - sharp) + (peak + 0.25 * Math.sin(k * 19 + p[2])) * sharp;
    d += `L${x} ${n2(y - amp * v + tilt * (x / VW - 0.5))}`;
  }
  return d + `L${x1} ${bottom}Z`;
}

export function Stars({ seed = 3, count = 70, y0 = 0, y1 = 520, color = "#FFF6DC" }: { seed?: number; count?: number; y0?: number; y1?: number; color?: string }) {
  const R = rng(seed);
  return (
    <g fill={color}>
      {Array.from({ length: count }, (_, i) => {
        const x = n2(R() * VW), y = n2(y0 + R() * (y1 - y0)), s = R();
        if (s > 0.9) {
          const k = n2(2.2 + R() * 2.4);
          return <path key={i} className="tw" style={{ animationDelay: `${n2(R() * 4)}s` }} transform={`translate(${x} ${y})`} d={`M0 ${-k}Q0 0 ${k} 0Q0 0 0 ${k}Q0 0 ${-k} 0Q0 0 0 ${-k}Z`} />;
        }
        return <circle key={i} cx={x} cy={y} r={n2(0.35 + s * 0.9)} opacity={n2(0.35 + R() * 0.6)} />;
      })}
    </g>
  );
}

export function Crescent({ R: r = 34, glow = true, fill = "url(#au-r)", ...at }: At & { R?: number; glow?: boolean; fill?: string }) {
  return (
    <g transform={tf(at)} opacity={at.o}>
      {glow && <circle r={r * 3.6} fill="url(#glow-moon)" />}
      <path d={`M0 ${-r}A${r} ${r} 0 1 0 0 ${r}A${n2(r * 1.32)} ${n2(r * 1.32)} 0 0 1 0 ${-r}Z`} fill={fill} />
    </g>
  );
}

export function Clouds({ seed = 2, count = 5, y = 200, spreadY = 60, color = "#fff", o = 0.55, blur = "f-blur8" }: { seed?: number; count?: number; y?: number; spreadY?: number; color?: string; o?: number; blur?: string }) {
  const R = rng(seed);
  return (
    <g filter={`url(#${blur})`} fill={color} opacity={o}>
      {Array.from({ length: count }, (_, i) => {
        const cx = R() * VW, cy = y + (R() - 0.5) * spreadY, w = 50 + R() * 70;
        return (
          <g key={i}>
            <ellipse cx={n2(cx)} cy={n2(cy)} rx={n2(w)} ry={n2(w * 0.2)} />
            <ellipse cx={n2(cx + w * 0.3)} cy={n2(cy - w * 0.1)} rx={n2(w * 0.5)} ry={n2(w * 0.18)} />
          </g>
        );
      })}
    </g>
  );
}

/* ----------------------------------------------------------- architecture */

export type ArchKind = "round" | "pointed" | "ogee" | "cusped" | "flat";

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

/** The outline of an arched opening, from bottom-left clockwise. */
export function archD(cx: number, top: number, w: number, bottom: number, kind: ArchKind = "ogee", rise?: number) {
  const l = n2(cx - w / 2), r = n2(cx + w / 2);
  if (kind === "flat") return `M${l} ${bottom}V${top}H${r}V${bottom}Z`;
  if (kind === "round") {
    const rr = n2(w / 2);
    return `M${l} ${bottom}V${n2(top + w / 2)}A${rr} ${rr} 0 0 1 ${r} ${n2(top + w / 2)}V${bottom}Z`;
  }
  const h = rise ?? w * 0.72;
  const sp = n2(top + h);
  if (kind === "pointed") {
    return `M${l} ${bottom}V${sp}C${l} ${n2(top + h * 0.35)} ${n2(cx - w * 0.2)} ${n2(top + h * 0.08)} ${cx} ${top}C${n2(cx + w * 0.2)} ${n2(top + h * 0.08)} ${r} ${n2(top + h * 0.35)} ${r} ${sp}V${bottom}Z`;
  }
  const L: [Pt, Pt, Pt, Pt] = [[cx - w / 2, sp], [cx - w / 2, top + h * 0.32], [cx - w * 0.15, top + h * 0.3], [cx, top]];
  if (kind === "ogee") {
    return `M${l} ${bottom}V${sp}C${n2(L[1][0])} ${n2(L[1][1])} ${n2(L[2][0])} ${n2(L[2][1])} ${cx} ${top}C${n2(2 * cx - L[2][0])} ${n2(L[2][1])} ${n2(2 * cx - L[1][0])} ${n2(L[1][1])} ${r} ${sp}V${bottom}Z`;
  }
  // cusped: scallops hang into the opening along an ogee curve
  const cusps = 5;
  const left: Pt[] = Array.from({ length: cusps + 1 }, (_, i) => cubic(L[0], L[1], L[2], L[3], i / cusps));
  const all: Pt[] = [...left, ...left.slice(0, -1).reverse().map(([x, y]) => [2 * cx - x, y] as Pt)];
  let d = `M${l} ${bottom}V${sp}`;
  for (let i = 1; i < all.length; i++) {
    const [x0, y0] = all[i - 1], [x1, y1] = all[i];
    const rr = n2(Math.hypot(x1 - x0, y1 - y0) * 0.62);
    d += `A${rr} ${rr} 0 0 1 ${n2(x1)} ${n2(y1)}`;
  }
  return d + `V${bottom}Z`;
}

/** A wall with an arched opening cut through it. */
export function ArchWall({
  cx = VW / 2, top, w, bottom = VH + 20, kind = "ogee", rise, fill, trim, trimWidth = 2.2, inset = 7, pattern, patternOpacity = 0.2, bounds = [-30, -30, VW + 60, VH + 60],
}: {
  cx?: number; top: number; w: number; bottom?: number; kind?: ArchKind; rise?: number; fill: string; trim?: string; trimWidth?: number; inset?: number;
  pattern?: string; patternOpacity?: number; bounds?: [number, number, number, number];
}) {
  const [bx, by, bw, bh] = bounds;
  const hole = archD(cx, top, w, bottom, kind, rise);
  const d = `M${bx} ${by}h${bw}v${bh}h${-bw}Z ${hole}`;
  return (
    <g>
      <path d={d} fill={fill} fillRule="evenodd" />
      {pattern && <path d={d} fill={`url(#${pattern})`} fillRule="evenodd" opacity={patternOpacity} />}
      {trim && (
        <>
          <path d={hole} fill="none" stroke={trim} strokeWidth={trimWidth} />
          <path d={archD(cx, top - inset * 1.25, w + inset * 2, bottom, kind, rise ? rise + inset : undefined)} fill="none" stroke={trim} strokeWidth={trimWidth * 0.45} opacity=".8" />
        </>
      )}
    </g>
  );
}

export function Dome({ hw = 30, h = 46, fill = "#E9D9B5", trim = "url(#au-v)", finial = true, ...at }: At & { hw?: number; h?: number; fill?: string; trim?: string; finial?: boolean }) {
  const d = `M${-hw} 0C${n2(-hw * 1.38)} ${n2(-h * 0.42)} ${n2(-hw * 0.5)} ${n2(-h * 0.76)} 0 ${-h}C${n2(hw * 0.5)} ${n2(-h * 0.76)} ${n2(hw * 1.38)} ${n2(-h * 0.42)} ${hw} 0Z`;
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d={d} fill={fill} />
      <path d={d} fill="url(#shade-side)" />
      <path d={`M${-hw} 0H${hw}`} stroke={trim} strokeWidth={n2(Math.max(1.2, hw * 0.07))} />
      {finial && (
        <g fill={trim} stroke="none">
          <path d={`M-.9 ${-h}h1.8v${n2(-h * 0.34)}h-1.8z`} />
          <circle cy={n2(-h * 1.1)} r={n2(Math.max(1.3, hw * 0.075))} />
          <circle cy={n2(-h * 1.24)} r={n2(Math.max(0.9, hw * 0.05))} />
          <path d={`M0 ${n2(-h * 1.46)}l1.2 ${n2(h * 0.14)}h-2.4z`} />
        </g>
      )}
    </g>
  );
}

type PalaceColors = { wall: string; shade: string; open: string; dome: string; trim?: string; lit?: boolean };

/** A palace or mosque front: arcade, central portal, domes and towers. */
export function Palace({ col, mosque, wings = true, ...at }: At & { col: PalaceColors; mosque?: boolean; wings?: boolean }) {
  const trim = col.trim || "url(#au-v)";
  const openings = [-108, -84, -60, 60, 84, 108];
  const tower = (x: number, top: number, w: number) => (
    <g key={x}>
      <rect x={x - w / 2} y={top} width={w} height={-top - 8} fill={col.wall} />
      <rect x={x - w / 2} y={top} width={w} height={-top - 8} fill="url(#shade-side)" />
      <rect x={x - w / 2 - 2.5} y={top + 26} width={w + 5} height="3.4" fill={col.shade} />
      <rect x={x - w / 2 - 2.5} y={top - 2} width={w + 5} height="3" fill={col.shade} />
      <path d={`M${x - w / 2 - 1} ${top - 2}v-9h${w + 2}v9`} fill={col.open} opacity={col.lit ? 1 : 0.7} />
      <path d={`M${x - w / 2 - 1.5} ${top - 2}v-9M${x + w / 2 + 1.5} ${top - 2}v-9M${x} ${top - 2}v-9`} stroke={col.wall} strokeWidth="1.6" />
      <Dome x={x} y={top - 11} hw={w / 2 + 2.5} h={w * 0.95} fill={col.dome} trim={trim} />
    </g>
  );
  return (
    <g transform={tf(at)} opacity={at.o}>
      {wings && tower(-132, mosque ? -176 : -132, 11)}
      {wings && tower(132, mosque ? -176 : -132, 11)}
      {/* main block */}
      <rect x="-124" y="-70" width="248" height="62" fill={col.wall} />
      <rect x="-124" y="-70" width="248" height="62" fill="url(#shade-side)" opacity=".7" />
      <path d="M-126-70h252v-4h-252z" fill={col.shade} />
      <path d={scallopRow(-124, -74, 248, 31)} fill={col.wall} />
      {openings.map((x) => (
        <g key={x}>
          <path d={archD(x, -58, 15, -8, "ogee")} fill={col.open} />
          <path d={archD(x, -58, 15, -8, "ogee")} fill="none" stroke={col.shade} strokeWidth=".9" />
        </g>
      ))}
      {/* side pavilions */}
      {[-84, 84].map((x) => (
        <g key={x}>
          <rect x={x - 15} y="-88" width="30" height="16" fill={col.wall} />
          <path d={archD(x, -85, 9, -72, "ogee")} fill={col.open} />
          <rect x={x - 17} y="-90" width="34" height="3" fill={col.shade} />
          <Dome x={x} y={-90} hw={14} h={mosque ? 22 : 18} fill={col.dome} trim={trim} />
        </g>
      ))}
      {/* central portal */}
      <rect x="-40" y="-108" width="80" height="100" fill={col.wall} />
      <rect x="-40" y="-108" width="80" height="100" fill="url(#shade-side)" opacity=".5" />
      <rect x="-43" y="-111" width="86" height="4" fill={col.shade} />
      <path d={archD(0, -96, 44, -8, "ogee")} fill={col.open} />
      <path d={archD(0, -96, 44, -8, "ogee")} fill="none" stroke={trim} strokeWidth="1.3" />
      <path d={archD(0, -84, 26, -8, "ogee")} fill={col.shade} opacity={col.lit ? 0.35 : 0.5} />
      <rect x="-36" y="-104" width="72" height="92" fill="none" stroke={col.shade} strokeWidth=".8" opacity=".7" />
      {[-48, 48].map((x) => tower(x, -124, 8))}
      {/* drum and main dome */}
      <rect x="-27" y="-122" width="54" height="12" fill={col.wall} />
      <rect x="-27" y="-122" width="54" height="12" fill="url(#shade-side)" />
      <rect x="-29" y="-124" width="58" height="2.6" fill={col.shade} />
      <Dome y={-124} hw={mosque ? 31 : 28} h={mosque ? 50 : 42} fill={col.dome} trim={trim} />
      {/* plinth and steps */}
      <rect x="-146" y="-8" width="292" height="8" fill={col.shade} />
      <rect x="-146" y="-8" width="292" height="2" fill={col.wall} opacity=".7" />
      <path d="M-30-8h60l8 8h-76z" fill={col.wall} />
      <path d="M-33-5h66M-36-2.2h72" stroke={col.shade} strokeWidth=".8" />
    </g>
  );
}

function scallopRow(x: number, y: number, w: number, count: number) {
  const step = w / count;
  let d = `M${x} ${y}`;
  for (let i = 0; i < count; i++) d += `a${n2(step / 2)} ${n2(step / 2)} 0 0 1 ${n2(step)} 0`;
  return d + "Z";
}

/** South Indian temple tower. */
export function Gopuram({ tiers = 7, stone = "#E8D9B8", shade = "#B89B68", dark = "#6E4A28", accents = ["#C98E5A", "#8FA98A", "#D8B56A"], ...at }: At & { tiers?: number; stone?: string; shade?: string; dark?: string; accents?: string[] }) {
  const bw = 176;
  const els: React.ReactNode[] = [];
  let y = -58;
  let w = bw * 0.92;
  for (let i = 0; i < tiers; i++) {
    const h = 31 - i * 2.1;
    const w2 = w - 13;
    els.push(
      <g key={i}>
        <path d={`M${-w / 2} ${y}L${-w2 / 2} ${n2(y - h)}H${w2 / 2}L${w / 2} ${y}Z`} fill={stone} />
        <path d={`M${-w / 2} ${y}L${-w2 / 2} ${n2(y - h)}H${w2 / 2}L${w / 2} ${y}Z`} fill="url(#shade-side)" />
        <path d={`M${-w / 2 - 3} ${y}h${w + 6}v-3.6h${-w - 6}z`} fill={accents[i % accents.length]} />
        <path d={scallopRow(-w / 2 - 3, y - 3.6, w + 6, Math.max(6, 16 - i))} fill={shade} />
        {Array.from({ length: 9 - i }, (_, k) => {
          const count = 9 - i;
          const nx = -w2 / 2 + 8 + ((w2 - 16) * (k + 0.5)) / count;
          const nw = Math.min(9, (w2 - 16) / count - 3);
          const mid = k === (count - 1) / 2;
          return (
            <g key={k}>
              <path d={archD(nx, y - h + 5, mid ? nw + 3 : nw, y - 6, "round")} fill={mid ? dark : shade} opacity={mid ? 0.9 : 0.75} />
              {!mid && <circle cx={nx} cy={n2(y - h * 0.55)} r={n2(nw * 0.22)} fill={stone} opacity=".8" />}
            </g>
          );
        })}
      </g>,
    );
    y -= h;
    w = w2 - 4;
  }
  const tw = w + 16;
  return (
    <g transform={tf(at)} opacity={at.o}>
      {/* stone base with doorway */}
      <rect x={-bw / 2} y="-58" width={bw} height="58" fill={stone} />
      <rect x={-bw / 2} y="-58" width={bw} height="58" fill="url(#shade-side)" />
      {[-70, -46, 46, 70].map((x) => <rect key={x} x={x - 3} y="-56" width="6" height="56" fill={shade} opacity=".7" />)}
      <rect x="-22" y="-50" width="44" height="50" fill={dark} />
      <path d={archD(0, -46, 30, 0, "flat")} fill="#2A1A0E" />
      <rect x="-13" y="-42" width="26" height="42" fill="url(#glow-warm)" opacity=".8" />
      <rect x={-bw / 2 - 5} y="-6" width={bw + 10} height="6" fill={shade} />
      {els}
      {/* barrel roof and finials */}
      <path d={`M${-tw / 2} ${y}C${-tw / 2 - 6} ${n2(y - 26)} ${tw / 2 + 6} ${n2(y - 26)} ${tw / 2} ${y}Z`} fill={accents[0]} />
      <path d={`M${-tw / 2} ${y}C${-tw / 2 - 6} ${n2(y - 26)} ${tw / 2 + 6} ${n2(y - 26)} ${tw / 2} ${y}Z`} fill="url(#shade-side)" />
      <path d={`M${-tw / 2 - 4} ${y}h${tw + 8}v-3h${-tw - 8}z`} fill={shade} />
      {[-2, -1, 0, 1, 2].map((k) => (
        <g key={k} transform={`translate(${n2((k * tw) / 6.2)} ${n2(y - 19.5 + Math.abs(k) * 2.4)})`} fill="url(#au-v)">
          <circle r="2.6" />
          <path d="M-1 -2h2l-.4-7h-1.2z" />
          <circle cy="-9.6" r="1.1" />
        </g>
      ))}
    </g>
  );
}

/** Kerala tharavadu: tiled roofs, carved gable, wooden verandah. */
export function KeralaHouse({ roof = "#A8553A", roofDark = "#7A3A26", wall = "#F7F0DF", wood = "#5A3620", ...at }: At & { roof?: string; roofDark?: string; wall?: string; wood?: string }) {
  return (
    <g transform={tf(at)} opacity={at.o}>
      {/* upper storey */}
      <rect x="-62" y="-154" width="124" height="40" fill={wall} />
      <rect x="-62" y="-154" width="124" height="40" fill="url(#shade-side)" opacity=".6" />
      {[-40, 0, 40].map((x) => (
        <g key={x}>
          <rect x={x - 9} y="-146" width="18" height="24" fill={wood} />
          <path d={`M${x - 5} -146v24M${x} -146v24M${x + 5} -146v24`} stroke="#E9C77B" strokeOpacity=".5" strokeWidth=".8" />
        </g>
      ))}
      <path d="M-98-150L-58-194H58L98-150Z" fill={roof} />
      <path d="M-98-150L-58-194H58L98-150Z" fill="url(#pat-tile)" />
      <path d="M-98-150L-58-194H58L98-150Z" fill="url(#shade-down)" opacity=".5" />
      <path d="M-100-150h200v4h-200z" fill={roofDark} />
      {/* carved gable */}
      <path d="M-30-190L0-232L30-190Z" fill={wood} />
      <path d="M-22-193L0-224L22-193Z" fill="url(#pat-carve)" />
      <path d="M-30-190L0-232L30-190" fill="none" stroke="#E9C77B" strokeOpacity=".7" strokeWidth="1.2" />
      <path d="M0-232v-10" stroke="url(#au-v)" strokeWidth="1.6" />
      <circle cy="-244" r="2.2" fill="url(#au-v)" />
      {/* main roof */}
      <path d="M-176-64L-118-120H118L176-64Z" fill={roof} />
      <path d="M-176-64L-118-120H118L176-64Z" fill="url(#pat-tile)" />
      <path d="M-176-64L-118-120H118L176-64Z" fill="url(#shade-down)" opacity=".55" />
      <path d="M-120-120h240v3.4h-240z" fill={roofDark} />
      <path d="M-178-64h356v5h-356z" fill={roofDark} />
      {/* verandah */}
      <rect x="-150" y="-60" width="300" height="52" fill={wall} />
      <rect x="-150" y="-60" width="300" height="52" fill="url(#shade-down)" opacity=".35" />
      <rect x="-19" y="-56" width="38" height="48" fill={wood} />
      <rect x="-16" y="-53" width="15" height="45" fill="url(#pat-carve)" />
      <rect x="1" y="-53" width="15" height="45" fill="url(#pat-carve)" />
      <circle cx="-3.4" cy="-30" r="1.3" fill="#E9C77B" />
      <circle cx="3.4" cy="-30" r="1.3" fill="#E9C77B" />
      {[-110, -66, 66, 110].map((x) => (
        <g key={x}>
          <rect x={x - 12} y="-50" width="24" height="26" fill={wood} />
          <path d={`M${x - 6} -50v26M${x} -50v26M${x + 6} -50v26`} stroke="#E9C77B" strokeOpacity=".45" strokeWidth=".8" />
        </g>
      ))}
      {[-146, -88, -34, 34, 88, 146].map((x) => (
        <g key={x}>
          <rect x={x - 3.4} y="-60" width="6.8" height="52" fill="url(#wood)" />
          <rect x={x - 5.4} y="-60" width="10.8" height="4" fill={wood} />
          <rect x={x - 5.4} y="-12" width="10.8" height="4" fill={wood} />
        </g>
      ))}
      <path d="M-146-22h112M34-22h112" stroke={wood} strokeWidth="2.4" />
      <path d={Array.from({ length: 19 }, (_, i) => `M${-140 + i * 6}-22v12`).join("") + Array.from({ length: 19 }, (_, i) => `M${40 + i * 6}-22v12`).join("")} stroke={wood} strokeWidth="1.1" />
      {/* plinth and steps */}
      <rect x="-160" y="-8" width="320" height="8" fill="#C9A77E" />
      <rect x="-160" y="-8" width="320" height="2" fill="#fff" opacity=".25" />
      <path d="M-26-8h52l7 8h-66z" fill="#DCC29B" />
      <path d="M-29-4.6h58" stroke="#A98A60" strokeWidth=".8" />
    </g>
  );
}

/** Wedding canopy with pillars, swags and flower strings. */
export function Mandap({ cloth = "#FBF0D4", pillar = "#F4E3BD", trim = "url(#au-v)", ...at }: At & { cloth?: string; pillar?: string; trim?: string }) {
  const strings = [-58, -44, -30, -16, 16, 30, 44, 58];
  return (
    <g transform={tf(at)} opacity={at.o}>
      {/* back pillars */}
      {[-46, 46].map((x) => <rect key={x} x={x - 3} y="-128" width="6" height="122" fill={pillar} opacity=".75" />)}
      {/* canopy */}
      <path d="M-92-140H92L74-168H-74Z" fill={cloth} />
      <path d="M-92-140H92L74-168H-74Z" fill="url(#shade-down)" opacity=".4" />
      <path d="M-74-168H74" stroke={trim} strokeWidth="2" />
      <path d={"M-92-140" + Array.from({ length: 8 }, () => "q11.5 16 23 0").join("") + "Z"} fill={cloth} />
      <path d={"M-92-140" + Array.from({ length: 8 }, () => "q11.5 16 23 0").join("")} fill="none" stroke={trim} strokeWidth="1.3" />
      {/* flower strings */}
      {strings.map((x, i) => (
        <g key={x}>
          <path d={`M${x}-134v${46 + (i % 3) * 14}`} stroke="#6E8B4A" strokeWidth=".7" />
          {Array.from({ length: 5 + (i % 3) * 2 }, (_, k) => (
            <circle key={k} cx={x} cy={-130 + k * 7.4} r="3" fill={k % 2 ? "#F7961F" : "#FFC13F"} stroke="#CF650B" strokeOpacity=".5" strokeWidth=".4" />
          ))}
        </g>
      ))}
      {/* front pillars */}
      {[-80, 80].map((x) => (
        <g key={x}>
          <rect x={x - 5.5} y="-140" width="11" height="134" fill={pillar} />
          <rect x={x - 5.5} y="-140" width="11" height="134" fill="url(#shade-side)" />
          <rect x={x - 8} y="-142" width="16" height="5" fill={trim} />
          <rect x={x - 8} y="-12" width="16" height="6" fill={trim} />
          {Array.from({ length: 13 }, (_, k) => (
            <circle key={k} cx={x + (k % 2 ? 3.4 : -3.4)} cy={-132 + k * 9.6} r="4.2" fill={k % 3 ? "#F7961F" : "#FFC13F"} stroke="#CF650B" strokeOpacity=".5" strokeWidth=".4" />
          ))}
        </g>
      ))}
      {/* dais */}
      <path d="M-104-6H104L112 4H-112Z" fill="#F7E7C2" />
      <path d="M-104-6H104" stroke={trim} strokeWidth="1.4" />
      <ellipse cy="-9" rx="13" ry="3.6" fill="#B8862D" />
      <path d="M-4-10C-7-18 0-21 0-28C4-22 7-17 4-10Z" fill="url(#flame)" />
      <circle cy="-18" r="20" fill="url(#glow-warm)" opacity=".7" />
    </g>
  );
}

/* ------------------------------------------------------------ small props */

export function BrassLamp({ lit = true, ...at }: At & { lit?: boolean }) {
  return (
    <g transform={tf(at)} opacity={at.o}>
      {lit && <circle cy="-104" r="42" fill="url(#glow-warm)" opacity=".75" />}
      <path d="M-24 0h48l-6-7h-36z" fill="url(#au-h)" />
      <path d="M-15-7h30l-5-6h-20z" fill="url(#au-h)" />
      <rect x="-3.2" y="-88" width="6.4" height="76" fill="url(#au-h)" />
      <ellipse cy="-30" rx="9.5" ry="5" fill="url(#au-h)" />
      <ellipse cy="-52" rx="7" ry="4" fill="url(#au-h)" />
      <ellipse cy="-70" rx="5.4" ry="3.2" fill="url(#au-h)" />
      <path d="M-25-92Q0-76 25-92L21-96H-21Z" fill="url(#au-h)" />
      <ellipse cy="-95" rx="22" ry="3.6" fill="#8C6827" />
      <ellipse cy="-95.6" rx="19" ry="2.4" fill="#E5C879" opacity=".7" />
      <path d="M-2.2-96h4.4l-1 -16h-2.4z" fill="url(#au-h)" />
      <ellipse cy="-113" rx="4" ry="2.6" fill="url(#au-h)" />
      <path d="M0-126l2.6 11h-5.2z" fill="url(#au-h)" />
      {lit && [-17, 0, 17].map((x) => (
        <path key={x} d={`M${x - 2.6} ${x ? -96 : -98}C${x - 4.2} ${x ? -103 : -105} ${x} ${x ? -106 : -108} ${x} ${x ? -112 : -114}C${x + 2.4} ${x ? -107 : -109} ${x + 4.2} ${x ? -102 : -104} ${x + 2.6} ${x ? -96 : -98}Z`} fill="url(#flame)" className="flick" />
      ))}
    </g>
  );
}

/** Hanging lantern. `drop` is the chain length above it. */
export function Lantern({ drop = 80, glass = "#FFD98A", ...at }: At & { drop?: number; glass?: string }) {
  return (
    <g transform={tf(at)} opacity={at.o}>
      <path d={`M0 ${-drop}V0`} stroke="url(#au-v)" strokeWidth=".9" />
      <circle cy="26" r="38" fill="url(#glow-warm)" opacity=".8" className="lglow" />
      <path d="M0-3l8 11h-16z" fill="url(#au-h)" />
      <path d="M-8 8L-12.5 24L-8 41H8L12.5 24L8 8Z" fill={glass} />
      <path d="M-8 8L-12.5 24L-8 41H8L12.5 24L8 8Z" fill="url(#glow-white)" opacity=".5" />
      <path d="M-8 8L-12.5 24L-8 41H8L12.5 24L8 8ZM0 8V41M-12.5 24H12.5M-8 8L8 41M8 8L-8 41" fill="none" stroke="url(#au-h)" strokeWidth="1.1" />
      <path d="M-9.4 7h18.8v2.4h-18.8zM-9.4 40h18.8v2.4h-18.8z" fill="url(#au-h)" />
      <path d="M-4.6 42.4L0 51L4.6 42.4Z" fill="url(#au-h)" />
      <circle cy="54" r="1.7" fill="url(#au-h)" />
    </g>
  );
}

/** The couple, seen from behind. */
export function Couple({ dress = "#F3C9C4", dressDeep = "#D99A98", suit = "#3B3A44", hair = "#2A1D17", rim = "#FFD9A6", ...at }: At & { dress?: string; dressDeep?: string; suit?: string; hair?: string; rim?: string }) {
  return (
    <g transform={tf(at)} opacity={at.o}>
      <ellipse cx="-6" cy="1" rx="52" ry="5" fill="#000" opacity=".2" filter="url(#f-blur3)" />
      {/* groom */}
      <g transform="translate(17 0)">
        <path d="M-10-62L-10.5 0H-2L0-40L2 0H10.5L10-62Z" fill={suit} />
        <path d="M-13.5-104C-15.5-90-13.5-70-12-56H12C13.5-70 15.5-90 13.5-104C8-109-8-109-13.5-104Z" fill={suit} />
        <path d="M12.6-102C18-95 18-72 15.4-56L11.4-57C12.4-74 11.4-90 10-100Z" fill={suit} />
        <path d="M-12.6-102C-22-92-26-80-30-70L-26-66C-20-76-15-86-10-96Z" fill={suit} />
        <rect x="-3" y="-112" width="6" height="8" fill="#B88A6A" />
        <ellipse cy="-118" rx="7.6" ry="8.6" fill={hair} />
        <path d="M13.5-104C15.5-90 13.5-70 12-56" fill="none" stroke={rim} strokeOpacity=".7" strokeWidth="1" />
        <path d="M7-121C8-117 8-113 6.6-110" fill="none" stroke={rim} strokeOpacity=".7" strokeWidth=".9" />
      </g>
      {/* bride */}
      <g transform="translate(-16 0)">
        <path d="M-8-60C-24-40-34-16-40 0H26C20-16 13-40 8-60Z" fill={dress} />
        <path d="M-8-60C-24-40-34-16-40 0H26C20-16 13-40 8-60Z" fill="url(#shade-side)" />
        <path d="M-4-58C-12-36-18-16-21-1M2-58C3-36 3-16 2-1M6-58C12-38 15-18 17-1" fill="none" stroke={dressDeep} strokeOpacity=".6" strokeWidth=".8" />
        <path d="M-39-3H25.4" stroke="url(#au-h)" strokeWidth="2" />
        <path d="M-8-60C-10-70-9-84-7-90H7C9-84 10-70 8-60Z" fill={dressDeep} />
        <path d="M-7.4-90C-12-84-13-74-11-66L-8-66C-9-74-8-82-6-88Z" fill="#C79676" />
        <path d="M7.4-90C12-84 13-74 11-66L8-66C9-74 8-82 6-88Z" fill="#C79676" />
        <rect x="-2.6" y="-97" width="5.2" height="8" fill="#C79676" />
        <ellipse cy="-103" rx="6.8" ry="7.8" fill={hair} />
        <path d="M-6.6-104C-9-96-8-84-5.4-74H5.4C8-84 9-96 6.6-104Z" fill={hair} />
        <path d="M-5-100C-2-98 2-98 5-100" fill="none" stroke="#fff" strokeWidth="1.6" strokeDasharray="1.2 1.6" strokeLinecap="round" />
        <path d="M-7-108C-20-86-30-40-38-2L-26-2C-22-40-16-80-6-100Z" fill="#fff" opacity=".3" />
        <path d="M8-60C13-40 20-16 26 0" fill="none" stroke={rim} strokeOpacity=".7" strokeWidth="1" />
      </g>
    </g>
  );
}

/** Irregular wax seal with an embossed sprig. */
export function sealBlob(r = 34, seed = 7) {
  const R = rng(seed);
  const pts = Array.from({ length: 14 }, (_, i) => {
    const a = (i / 14) * Math.PI * 2;
    const rr = r * (0.94 + R() * 0.12);
    return [Math.cos(a) * rr, Math.sin(a) * rr] as Pt;
  });
  let d = "";
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    d += i === 0 ? `M${n2(m[0])} ${n2(m[1])}` : "";
    const nx = pts[(i + 2) % pts.length];
    const m2: Pt = [(q[0] + nx[0]) / 2, (q[1] + nx[1]) / 2];
    d += `Q${n2(q[0])} ${n2(q[1])} ${n2(m2[0])} ${n2(m2[1])}`;
  });
  return d + "Z";
}
const SEAL_D = sealBlob();

export function WaxSeal(at: At) {
  const sprig = "M0 14C0 4 0-6 0-15M0 8C-5 6-9 2-10-4C-5-3-1 1 0 6M0 8C5 6 9 2 10-4C5-3 1 1 0 6M0-1C-4-3-7-7-7-12C-3-10 0-7 0-3M0-1C4-3 7-7 7-12C3-10 0-7 0-3M0-9C-2-12-2-15 0-18C2-15 2-12 0-9";
  return (
    <g transform={tf(at)} opacity={at.o}>
      <ellipse cy="5" rx="34" ry="32" fill="#000" opacity=".28" filter="url(#f-blur3)" />
      <path d={SEAL_D} fill="url(#au-r)" />
      <path d={SEAL_D} fill="none" stroke="#7E5C20" strokeOpacity=".5" strokeWidth="1" />
      <circle r="25" fill="none" stroke="#7E5C20" strokeOpacity=".45" strokeWidth="1.6" />
      <circle r="25" fill="none" stroke="#FCEBB6" strokeOpacity=".7" strokeWidth=".7" transform="translate(-.7 -.7)" />
      <circle r="22" fill="#C99C46" opacity=".35" />
      <path d={sprig} fill="none" stroke="#7E5C20" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" transform="translate(.7 .8)" />
      <path d={sprig} fill="none" stroke="#FBE9B4" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M-22-18C-14-28 2-31 14-27" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  );
}

/** Pressed (blind-embossed) sprigs scattered over paper. */
export function Emboss({ seed = 5, count = 18, light = "#fff", dark = "#7A6A48", box = [0, 0, VW, VH] }: { seed?: number; count?: number; light?: string; dark?: string; box?: [number, number, number, number] }) {
  const R = rng(seed);
  const d = "M0 0C2-12 2-26 0-40M0-8C-7-12-11-18-11-25C-5-23-1-18 0-12M0-8C7-12 11-18 11-25C5-23 1-18 0-12M0-22C-5-25-8-30-8-36C-3-34 0-30 0-26M0-22C5-25 8-30 8-36C3-34 0-30 0-26";
  return (
    <g fill="none" strokeLinecap="round">
      {Array.from({ length: count }, (_, i) => {
        const x = n2(box[0] + R() * box[2]), y = n2(box[1] + R() * box[3]), r = n2(R() * 360), s = n2(0.7 + R() * 0.9);
        return (
          <g key={i} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
            <path d={d} stroke={dark} strokeOpacity=".13" strokeWidth="1.3" transform="translate(.7 .8)" />
            <path d={d} stroke={light} strokeOpacity=".9" strokeWidth="1.1" />
          </g>
        );
      })}
    </g>
  );
}

/** Thin foil frame with corner ornaments. */
export function FoilFrame({ x = 22, y = 30, w = VW - 44, h = VH - 60, r = 4, stroke = "url(#au)", corner = true }: { x?: number; y?: number; w?: number; h?: number; r?: number; stroke?: string; corner?: boolean }) {
  const c = "M0 22C0 8 8 0 22 0M0 12C4 12 12 4 12 0M5 5a3 3 0 1 0 .1 0";
  return (
    <g fill="none" stroke={stroke}>
      <rect x={x} y={y} width={w} height={h} rx={r} strokeWidth="1.3" />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} rx={Math.max(0, r - 2)} strokeWidth=".6" opacity=".8" />
      {corner && (
        <g strokeWidth=".9">
          <path d={c} transform={`translate(${x + 11} ${y + 11})`} />
          <path d={c} transform={`translate(${x + w - 11} ${y + 11}) scale(-1 1)`} />
          <path d={c} transform={`translate(${x + 11} ${y + h - 11}) scale(1 -1)`} />
          <path d={c} transform={`translate(${x + w - 11} ${y + h - 11}) scale(-1 -1)`} />
        </g>
      )}
    </g>
  );
}

/** A handful of loose petals for foreground depth. */
export function Petals({ seed = 9, count = 9, c = "blush", box = [0, 0, VW, VH], size = [5, 11] }: { seed?: number; count?: number; c?: PetalColor; box?: [number, number, number, number]; size?: [number, number] }) {
  const R = rng(seed);
  const p = PETALS[c];
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const s = size[0] + R() * (size[1] - size[0]);
        return (
          <path key={i} transform={`translate(${n2(box[0] + R() * box[2])} ${n2(box[1] + R() * box[3])}) rotate(${n2(R() * 360)})`}
            d={`M0 0C${n2(s * 0.7)} ${n2(-s * 0.5)} ${n2(s * 0.8)} ${n2(-s * 1.4)} 0 ${n2(-s * 1.9)}C${n2(-s * 0.9)} ${n2(-s * 1.2)} ${n2(-s * 0.6)} ${n2(-s * 0.4)} 0 0Z`}
            fill={i % 3 ? p[1] : p[2]} opacity={n2(0.75 + R() * 0.25)} />
        );
      })}
    </g>
  );
}

/* ------------------------------------------------------- dense vegetation */

/** A leafy mass: leaves fanned outward from the centre. */
export function Bush({
  seed = 1, count = 36, spread = [50, 34], greens = ["leaf", "deep"], size = [0.6, 1.2], ...at
}: At & { seed?: number; count?: number; spread?: [number, number]; greens?: GreenColor[]; size?: [number, number] }) {
  const R = rng(seed);
  const items = Array.from({ length: count }, (_, i) => {
    const a = R() * Math.PI * 2;
    const d = Math.sqrt(R());
    return { i, x: Math.cos(a) * d * spread[0], y: Math.sin(a) * d * spread[1], d, a, k: R(), j: R() };
  }).sort((p, q) => q.d - p.d);
  return (
    <g transform={tf(at)} opacity={at.o}>
      {items.map((it) => (
        <Leaf key={it.i} c={greens[Math.floor(it.k * greens.length)]} x={it.x} y={it.y} r={(it.a * 180) / Math.PI + 90 + (it.j - 0.5) * 70} s={size[0] + it.j * (size[1] - size[0])} />
      ))}
    </g>
  );
}

/** A distant line of rounded trees with a few cypress spires. */
export function Treeline({
  seed = 1, x0 = 0, x1 = VW, y, h = 26, fill, fill2, count = 16, spires = 0.25,
}: { seed?: number; x0?: number; x1?: number; y: number; h?: number; fill: string; fill2?: string; count?: number; spires?: number }) {
  const R = rng(seed);
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const x = n2(x0 + ((x1 - x0) * (i + R() * 0.8)) / count);
        const hh = h * (0.6 + R() * 0.7);
        const c = fill2 && R() > 0.5 ? fill2 : fill;
        if (R() < spires) {
          const ht = hh * 1.9;
          return <path key={i} d={`M${x} ${y}C${n2(x - ht * 0.15)} ${n2(y - ht * 0.3)} ${n2(x - ht * 0.09)} ${n2(y - ht * 0.8)} ${x} ${n2(y - ht)}C${n2(x + ht * 0.09)} ${n2(y - ht * 0.8)} ${n2(x + ht * 0.15)} ${n2(y - ht * 0.3)} ${x} ${y}Z`} fill={c} />;
        }
        return (
          <g key={i} fill={c}>
            <ellipse cx={x} cy={n2(y - hh * 0.5)} rx={n2(hh * 0.62)} ry={n2(hh * 0.56)} />
            <ellipse cx={n2(x + hh * 0.4)} cy={n2(y - hh * 0.3)} rx={n2(hh * 0.45)} ry={n2(hh * 0.4)} />
            <ellipse cx={n2(x - hh * 0.42)} cy={n2(y - hh * 0.28)} rx={n2(hh * 0.42)} ry={n2(hh * 0.36)} />
          </g>
        );
      })}
    </g>
  );
}
