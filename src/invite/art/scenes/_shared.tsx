import React from "react";

/** A sheet of card stock for the names to sit on. */
export function Plate({ d, fill = "#FFFDF8", o = 0.94, trim = "url(#au)", inner }: { d: string; fill?: string; o?: number; trim?: string; inner?: string }) {
  return (
    <g>
      <path d={d} fill={fill} opacity={o} filter="url(#f-drop)" />
      <path d={d} fill="none" stroke={trim} strokeWidth="1.3" />
      {inner && <path d={inner} fill="none" stroke={trim} strokeWidth=".6" opacity=".85" />}
    </g>
  );
}

/** Two door leaves swinging away from the middle, with the scene settling behind them. */
export function openDoors(root: HTMLElement, tl: gsap.core.Timeline, hingeL: number, hingeR: number, o: { skew?: number; at?: number; dur?: number } = {}) {
  const { skew = 7, at = 0.25, dur = 2.3 } = o;
  const q = (s: string) => root.querySelectorAll(s);
  tl.to(q('[data-role="door-seam"]'), { opacity: 0, duration: 0.3 }, Math.max(0, at - 0.05))
    .fromTo(q('[data-role="door-glow"]'), { opacity: 0 }, { opacity: 0.9, duration: 0.45, ease: "power1.in" }, 0)
    .to(q('[data-role="door-l"]'), { scaleX: 0.03, skewY: skew, svgOrigin: `${hingeL} 500`, duration: dur, ease: "power2.inOut" }, at)
    .to(q('[data-role="door-r"]'), { scaleX: 0.03, skewY: -skew, svgOrigin: `${hingeR} 500`, duration: dur, ease: "power2.inOut" }, at)
    .to(q('[data-role="door-shade"]'), { opacity: 0.5, duration: dur - 0.2, ease: "power1.in" }, at + 0.1)
    .to(q('[data-role="door-glow"]'), { scaleX: 46, opacity: 0, svgOrigin: "195 500", duration: 1.8, ease: "power2.out" }, at + 0.2)
    .fromTo(q(".hero-scene"), { scale: 1.1 }, { scale: 1, duration: 3.2, ease: "power2.out" }, at)
    .to(q(".cover"), { opacity: 0, duration: 0.5 }, at + dur - 0.1);
}

/** Round card with the couple's initials, used on covers that hide the names. */
export function Monogram({ t, x = 195, y = 404, r = 58, ink = "#7A4A3A", fill = "#FFFBF7" }: { t: { couple: [string, string] }; x?: number; y?: number; r?: number; ink?: string; fill?: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} filter="url(#f-drop)" />
      <circle cx={x} cy={y} r={r} fill="none" stroke="url(#au)" strokeWidth="1.4" />
      <circle cx={x} cy={y} r={r - 6} fill="none" stroke="url(#au)" strokeWidth=".6" />
      <text x={x} y={y + r * 0.22} textAnchor="middle" fill={ink} style={{ fontFamily: "var(--f-caps)", fontWeight: 500, fontSize: r * 0.52, letterSpacing: "0.08em" }}>
        {t.couple[0][0]}
        {t.couple[1] && <><tspan dx="5" style={{ fontSize: r * 0.34 }}>&amp;</tspan><tspan dx="5">{t.couple[1][0]}</tspan></>}
      </text>
    </g>
  );
}
