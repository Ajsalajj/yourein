import React from "react";
import { Layer, archD, rng, n2, VW, VH } from "../kit";
import type { ArtModule } from "../types";

/* An opera house: velvet curtains, a gilded proscenium, one spotlight. Signature design. */

const STAGE = 640; /* front edge of the stage */
const V_DEEP = "#3A0610", V_MID = "#6E0F1E", V_HI = "#A3263A";

function Defs() {
  return (
    <defs>
      {/* velvet folds: repeating stripes of light and shadow */}
      <linearGradient id="vo-folds" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="26" y2="0" spreadMethod="repeat">
        <stop offset="0" stopColor={V_DEEP} />
        <stop offset=".3" stopColor={V_MID} />
        <stop offset=".5" stopColor={V_HI} />
        <stop offset=".72" stopColor={V_MID} />
        <stop offset="1" stopColor={V_DEEP} />
      </linearGradient>
      <linearGradient id="vo-fall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000" stopOpacity=".55" />
        <stop offset=".25" stopColor="#000" stopOpacity="0" />
        <stop offset=".8" stopColor="#000" stopOpacity=".1" />
        <stop offset="1" stopColor="#000" stopOpacity=".5" />
      </linearGradient>
      <linearGradient id="vo-wall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0B0205" />
        <stop offset=".6" stopColor="#1E050B" />
        <stop offset="1" stopColor="#2C0911" />
      </linearGradient>
      <linearGradient id="vo-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3A1A10" />
        <stop offset="1" stopColor="#120604" />
      </linearGradient>
      <linearGradient id="vo-beam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFF4DA" stopOpacity=".5" />
        <stop offset=".7" stopColor="#FFE9BE" stopOpacity=".12" />
        <stop offset="1" stopColor="#FFE9BE" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="vo-pool" cx=".5" cy=".5" r=".5">
        <stop offset="0" stopColor="#FFF1D2" stopOpacity=".7" />
        <stop offset=".6" stopColor="#FFDFA0" stopOpacity=".18" />
        <stop offset="1" stopColor="#FFDFA0" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/** A curtain panel: velvet folds, falling light, gold fringe along the hem. */
function Drape({ x, w, top = -20, bottom, fringe = true }: { x: number; w: number; top?: number; bottom: number; fringe?: boolean }) {
  return (
    <g>
      <rect x={x} y={top} width={w} height={bottom - top} fill="url(#vo-folds)" />
      <rect x={x} y={top} width={w} height={bottom - top} fill="url(#vo-fall)" />
      {fringe && (
        <>
          <rect x={x} y={bottom - 2} width={w} height="7" fill="url(#au-h)" />
          <path d={`M${x} ${bottom + 5}h${w}`} stroke="url(#au)" strokeWidth="5" strokeDasharray="1.2 2" />
        </>
      )}
    </g>
  );
}

/** Scalloped valance across the top, with tassels. */
function Valance() {
  const swags = 5, sw = VW / swags;
  return (
    <g>
      <rect x="-20" y="-20" width={VW + 40} height="70" fill="url(#vo-folds)" />
      <rect x="-20" y="-20" width={VW + 40} height="70" fill="#000" opacity=".25" />
      {Array.from({ length: swags }, (_, i) => {
        const x0 = i * sw;
        const d = `M${x0} 46Q${x0 + sw / 2} 104 ${x0 + sw} 46Z`;
        return (
          <g key={i}>
            <path d={d} fill="url(#vo-folds)" />
            <path d={d} fill="url(#vo-fall)" />
            <path d={`M${x0} 46Q${x0 + sw / 2} 104 ${x0 + sw} 46`} fill="none" stroke="url(#au)" strokeWidth="3.4" />
            <path d={`M${x0 + 4} 52Q${x0 + sw / 2} 96 ${x0 + sw - 4} 52`} fill="none" stroke="url(#au)" strokeWidth=".7" opacity=".7" />
            <g transform={`translate(${x0} 50)`}>
              <path d="M0 0V18" stroke="url(#au)" strokeWidth="1" />
              <path d="M-5 18h10l-2 16h-6z" fill="url(#au-v)" />
              <circle cy="17" r="3.2" fill="url(#au-r)" />
            </g>
          </g>
        );
      })}
    </g>
  );
}

/** Side curtains drawn back and tied, framing the stage. */
function TiedDrape({ side }: { side: "l" | "r" }) {
  const l = side === "l";
  const sx = l ? 1 : -1, ox = l ? 0 : VW;
  return (
    <g transform={`translate(${ox} 0) scale(${sx} 1)`}>
      <path d="M-20 -20H86C82 160 70 330 44 470C40 520 50 560 70 600C78 690 76 780 84 870H-20Z" fill="url(#vo-folds)" />
      <path d="M-20 -20H86C82 160 70 330 44 470C40 520 50 560 70 600C78 690 76 780 84 870H-20Z" fill="url(#vo-fall)" />
      <path d="M86 -20C82 160 70 330 44 470C40 520 50 560 70 600C78 690 76 780 84 870" fill="none" stroke="#1A0207" strokeWidth="2" opacity=".6" />
      {/* tie-back rope and tassel */}
      <path d="M-10 500C20 488 44 486 58 498" fill="none" stroke="url(#au)" strokeWidth="4.5" />
      <path d="M-10 506C20 494 44 492 58 504" fill="none" stroke="#5A3C14" strokeWidth="1" opacity=".6" />
      <g transform="translate(58 500)">
        <circle r="5" fill="url(#au-r)" />
        <path d="M-6 4h12l-3 26h-6z" fill="url(#au-v)" />
        <path d="M-6 30h12" stroke="url(#au)" strokeWidth="2" strokeDasharray="1 1.4" />
      </g>
    </g>
  );
}

function Proscenium() {
  const R = rng(5);
  return (
    <g>
      {/* gilded frame: outer and inner arch with a band of ornament between */}
      <path d={`M-20 -20H${VW + 20}V${STAGE + 6}H-20Z${archD(195, 118, 318, STAGE + 6, "round")}`} fill="#160307" fillRule="evenodd" />
      <path d={archD(195, 118, 318, STAGE + 6, "round")} fill="none" stroke="url(#au)" strokeWidth="5" />
      <path d={archD(195, 128, 298, STAGE + 6, "round")} fill="none" stroke="url(#au)" strokeWidth="1.2" />
      <path d={archD(195, 104, 346, STAGE + 6, "round")} fill="none" stroke="url(#au)" strokeWidth="1.4" opacity=".8" />
      {/* beading along the arch */}
      {Array.from({ length: 34 }, (_, i) => {
        const a = Math.PI * (i / 33);
        const x = 195 - Math.cos(a) * 166, y = 270 - Math.sin(a) * 158;
        return <circle key={i} cx={n2(x)} cy={n2(y)} r="1.6" fill="url(#au-r)" opacity={n2(0.7 + R() * 0.3)} />;
      })}
      {/* fluted columns */}
      {[22, 368].map((x) => (
        <g key={x}>
          <rect x={x - 13} y={250} width="26" height={STAGE - 244} fill="#22060B" />
          {[-8, -3, 2, 7].map((d) => <path key={d} d={`M${x + d} 262V${STAGE - 8}`} stroke="url(#au)" strokeWidth=".7" opacity=".7" />)}
          <path d={`M${x - 17} 250h34l-4-10h-26zM${x - 17} ${STAGE - 2}h34v8h-34z`} fill="url(#au-h)" />
        </g>
      ))}
      {/* crowned cartouche at the keystone */}
      <g transform="translate(195 104)">
        <path d="M-34 0C-30 -22 -12 -30 0 -36C12 -30 30 -22 34 0C20 10 -20 10 -34 0Z" fill="#2A070D" stroke="url(#au)" strokeWidth="1.6" />
        <path d="M-22 -2C-18 -16 -8 -22 0 -25C8 -22 18 -16 22 -2" fill="none" stroke="url(#au)" strokeWidth=".7" />
        <path d="M-14 -40l6 -12 8 8 8 -8 6 12z" fill="url(#au-v)" />
        <circle cy="-12" r="4" fill="url(#au-r)" />
      </g>
    </g>
  );
}

function Hero() {
  const R = rng(9);
  return (
    <>
      <Layer depth={0.04}>
        <Defs />
        <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="url(#vo-wall)" />
        <rect x="-20" y="120" width={VW + 40} height={STAGE - 120} fill="url(#pat-ogee)" opacity=".05" />
        {/* the backcloth: a painted night with distant chandeliers */}
        {[110, 195, 280].map((x, i) => (
          <g key={x} opacity={i === 1 ? 0.55 : 0.35}>
            <circle cx={x} cy={210 + (i === 1 ? -16 : 0)} r="26" fill="url(#glow-warm)" />
            <circle cx={x} cy={210 + (i === 1 ? -16 : 0)} r="2.2" fill="#FFE7B0" />
          </g>
        ))}
      </Layer>
      <Layer depth={0.12} role="stage">
        <path d={`M-20 ${STAGE - 70}H${VW + 20}V${VH + 20}H-20Z`} fill="url(#vo-floor)" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${195 + (i - 4) * 14} ${STAGE - 70}L${195 + (i - 4) * 70} ${VH + 20}`} stroke="#0C0402" strokeWidth=".8" opacity=".55" />)}
        <path d={`M-20 ${STAGE}H${VW + 20}`} stroke="url(#au)" strokeWidth="2.4" />
        <rect x="-20" y={STAGE + 2} width={VW + 40} height="26" fill="#1A0608" />
        {/* footlights */}
        {Array.from({ length: 11 }, (_, i) => (
          <g key={i} data-role="foot">
            <circle cx={20 + i * 35} cy={STAGE + 12} r="10" fill="url(#glow-warm)" opacity=".85" />
            <circle cx={20 + i * 35} cy={STAGE + 12} r="1.8" fill="#FFE7B0" />
          </g>
        ))}
      </Layer>
      <Layer depth={0.2} role="spot">
        <path d={`M178 -20L212 -20L300 ${STAGE - 40}L90 ${STAGE - 40}Z`} fill="url(#vo-beam)" />
        <ellipse cx="195" cy={STAGE - 44} rx="118" ry="24" fill="url(#vo-pool)" />
        {/* dust in the beam */}
        {Array.from({ length: 22 }, (_, i) => (
          <circle key={i} cx={n2(150 + R() * 90)} cy={n2(60 + R() * 480)} r={n2(0.5 + R() * 0.8)} fill="#FFF3D6" opacity={n2(0.2 + R() * 0.4)} />
        ))}
      </Layer>
      <Layer depth={0.45} role="frame">
        <Proscenium />
      </Layer>
      <Layer depth={0.7} role="stalls">
        {/* the audience in the stalls, seen from behind, and the gold rail of the pit */}
        <rect x="-20" y={STAGE + 28} width={VW + 40} height={VH - STAGE} fill="#0A0204" />
        <path d={`M-20 ${STAGE + 40}H${VW + 20}`} stroke="url(#au)" strokeWidth="2" />
        {Array.from({ length: 13 }, (_, i) => <rect key={`b${i}`} x={-6 + i * 31} y={STAGE + 40} width="3" height="22" fill="url(#au-v)" opacity=".75" />)}
        <path d={`M-20 ${STAGE + 62}H${VW + 20}`} stroke="url(#au)" strokeWidth="1.2" />
        {/* heads and shoulders of the audience, rim-lit by the stage */}
        {[0, 1].map((row) => {
          const R2 = rng(40 + row), y = STAGE + 104 + row * 66, s2 = 1 + row * 0.28, count = 8 - row;
          return (
            <g key={row}>
              {Array.from({ length: count }, (_, i) => {
                const x = n2(((i + 0.5) * VW) / count + (R2() - 0.5) * 14 + (row ? 14 : 0)), h = n2(13 * s2), w = n2(30 * s2);
                const d = `M${x - w} ${y + 60}C${x - w} ${y + 20} ${x - w * 0.55} ${y + 14} ${x - h * 0.7} ${y + 10}C${x - h * 1.1} ${y - 6} ${x - h} ${y - h * 1.9} ${x} ${y - h * 1.9}C${x + h} ${y - h * 1.9} ${x + h * 1.1} ${y - 6} ${x + h * 0.7} ${y + 10}C${x + w * 0.55} ${y + 14} ${x + w} ${y + 20} ${x + w} ${y + 60}Z`;
                return (
                  <g key={i}>
                    <path d={d} fill={row ? "#040001" : "#0A0204"} />
                    <path d={d} fill="none" stroke="#7A3A22" strokeWidth=".8" opacity={row ? 0.35 : 0.5} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </Layer>
      <Layer depth={0.9} role="drapes">
        <TiedDrape side="l" />
        <TiedDrape side="r" />
        <Valance />
      </Layer>
    </>
  );
}

/** Before the first tap: the house curtain, closed. */
function Cover() {
  return (
    <Layer>
      <rect data-role="house" x="-20" y="-20" width={VW + 40} height={VH + 40} fill="#000" opacity="0" />
      <g data-role="curtain-l"><Drape x={-20} w={217} bottom={VH - 40} /></g>
      <g data-role="curtain-r"><Drape x={193} w={217} bottom={VH - 40} /></g>
      <path data-role="seam" d={`M195 0V${VH - 40}`} stroke="#1A0207" strokeWidth="2" />
      <g data-role="crest" transform="translate(195 380)">
        <circle r="46" fill="none" stroke="url(#au)" strokeWidth="1.4" />
        <circle r="40" fill="none" stroke="url(#au)" strokeWidth=".6" />
        <path d="M-14 -8l6 -12 8 8 8 -8 6 12z" fill="url(#au-v)" />
        <path d="M-22 10H22" stroke="url(#au)" strokeWidth=".8" />
        <text y="28" textAnchor="middle" fill="#E9C98A" style={{ fontFamily: "var(--f-caps)", fontSize: 9, letterSpacing: "0.32em" }}>TONIGHT</text>
      </g>
      <Valance />
    </Layer>
  );
}

const EASE = "power3.inOut";

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 410, anchor: "mid", width: 0.56, widthTall: 0.48, scale: 0.9 },
  coverInk: "#F0D9A6",
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    /* house lights down, the crest fades, a spotlight finds the stage, then the curtain parts */
    tl.to(q('[data-role="crest"]'), { opacity: 0, duration: 0.5, ease: "power1.out" }, 0)
      .to(q('[data-role="house"]'), { opacity: 0.45, duration: 0.6, ease: "power1.in" }, 0)
      .to(q('[data-role="seam"]'), { opacity: 0, duration: 0.3 }, 0.6)
      .to(q('[data-role="curtain-l"]'), { scaleX: 0.16, skewY: 3, svgOrigin: "-20 400", duration: 2.6, ease: EASE }, 0.7)
      .to(q('[data-role="curtain-r"]'), { scaleX: 0.16, skewY: -3, svgOrigin: "410 400", duration: 2.6, ease: EASE }, 0.7)
      .to(q('[data-role="house"]'), { opacity: 0, duration: 1.6, ease: "power1.out" }, 1.4)
      .fromTo(q('[data-role="spot"]'), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" }, 0.55)
      .fromTo(q('[data-role="foot"]'), { opacity: 0 }, { opacity: 1, duration: 0.4, stagger: 0.04, ease: "power1.out" }, 1)
      .fromTo(q('[data-role="frame"]'), { scale: 1.05 }, { scale: 1, duration: 3, ease: "power2.out" }, 0.6)
      .fromTo(q(".hero-scene"), { scale: 1.04 }, { scale: 1, duration: 3.4, ease: "power2.out" }, 0.6)
      .to(q(".cover"), { opacity: 0, duration: 0.5 }, 3.0);
  },
};

export default art;
