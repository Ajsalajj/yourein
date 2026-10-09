import React from "react";
import { Layer, Blossom, Sprig, archD, VW, VH } from "../kit";
import type { GreenColor } from "../kit";
import type { ArtModule } from "../types";

type S = { x: number; y: number; r: number; len: number; c: GreenColor; n: number; bend: number; leaf: number };
const TOP: S[] = [
  { x: 372, y: 44, r: 196, len: 250, c: "sage", n: 13, bend: 34, leaf: 1.9 },
  { x: 380, y: 30, r: 222, len: 200, c: "moss", n: 11, bend: -26, leaf: 1.7 },
  { x: 360, y: 36, r: 252, len: 190, c: "leaf", n: 10, bend: 22, leaf: 1.5 },
  { x: 386, y: 60, r: 172, len: 210, c: "olive", n: 11, bend: -20, leaf: 1.6 },
  { x: 350, y: 24, r: 276, len: 150, c: "sage", n: 9, bend: 18, leaf: 1.5 },
  { x: 388, y: 90, r: 152, len: 150, c: "moss", n: 9, bend: 22, leaf: 1.4 },
  { x: 366, y: 50, r: 212, len: 140, c: "gilt", n: 9, bend: -14, leaf: 1.1 },
];
const BOTTOM: S[] = [
  { x: 20, y: 800, r: 22, len: 260, c: "sage", n: 13, bend: -34, leaf: 1.9 },
  { x: 10, y: 812, r: 48, len: 210, c: "moss", n: 11, bend: 26, leaf: 1.7 },
  { x: 30, y: 808, r: 74, len: 190, c: "leaf", n: 10, bend: -22, leaf: 1.5 },
  { x: 6, y: 790, r: -4, len: 210, c: "olive", n: 11, bend: 20, leaf: 1.6 },
  { x: 40, y: 818, r: 96, len: 150, c: "sage", n: 9, bend: -18, leaf: 1.5 },
  { x: 2, y: 760, r: -24, len: 150, c: "moss", n: 9, bend: -20, leaf: 1.4 },
  { x: 26, y: 800, r: 38, len: 150, c: "gilt", n: 9, bend: 14, leaf: 1.1 },
];
const EXTRA: S[] = [
  { x: -6, y: 110, r: 108, len: 130, c: "sage", n: 8, bend: 16, leaf: 1.3 },
  { x: -8, y: 90, r: 138, len: 100, c: "moss", n: 7, bend: -12, leaf: 1.2 },
  { x: 398, y: 730, r: -70, len: 130, c: "sage", n: 8, bend: 16, leaf: 1.3 },
  { x: 400, y: 750, r: -40, len: 100, c: "moss", n: 7, bend: -12, leaf: 1.2 },
];

function Group({ list }: { list: S[] }) {
  return (
    <g filter="url(#f-wash)" opacity=".93">
      {list.map((s, i) => (
        <g key={i} data-grow={`${s.x} ${s.y}`}>
          <Sprig x={s.x} y={s.y} r={s.r} len={s.len} c={s.c} count={s.n} bend={s.bend} leaf={s.leaf} />
        </g>
      ))}
    </g>
  );
}

function Paper() {
  return (
    <>
      <rect x="-20" y="-20" width={VW + 40} height={VH + 40} fill="#FAF8F1" />
      <ellipse cx="330" cy="120" rx="170" ry="130" fill="#C9D4B5" opacity=".2" filter="url(#f-blur18)" />
      <ellipse cx="50" cy="740" rx="180" ry="140" fill="#C9D4B5" opacity=".22" filter="url(#f-blur18)" />
    </>
  );
}

function Hero() {
  return (
    <>
      <Layer depth={0.05}><Paper /></Layer>
      <Layer depth={0.22} role="frame">
        <path d={archD(195, 168, 236, 560, "round")} fill="#fff" opacity=".55" />
        <path d={archD(195, 168, 236, 560, "round")} fill="none" stroke="url(#au)" strokeWidth="1.1" />
        <path d={archD(195, 176, 220, 552, "round")} fill="none" stroke="url(#au)" strokeWidth=".5" />
      </Layer>
      <Layer depth={0.5} role="green-c"><Group list={EXTRA} /></Layer>
      <Layer depth={0.74} role="green-a">
        <Group list={TOP} />
        <g data-grow="336 96"><Blossom c="white" x={336} y={96} s={0.9} /><Blossom c="ivory" x={308} y={70} s={0.66} r={30} /></g>
      </Layer>
      <Layer depth={1} role="green-b">
        <Group list={BOTTOM} />
        <g data-grow="58 752"><Blossom c="white" x={58} y={752} s={0.95} /><Blossom c="ivory" x={90} y={776} s={0.7} r={20} /></g>
      </Layer>
    </>
  );
}

function Cover() {
  return <Layer role="blank"><Paper /><path d={archD(195, 168, 236, 560, "round")} fill="none" stroke="url(#au)" strokeWidth="1.1" /></Layer>;
}

const art: ArtModule = {
  Hero,
  Cover,
  names: { y: 366, anchor: "mid", scale: 0.84 },
  namesOnCover: true,
  open(root, tl) {
    const q = (s: string) => root.querySelectorAll(s);
    tl.to(q(".cover"), { opacity: 0, duration: 0.7, ease: "power1.out" }, 0);
    root.querySelectorAll<SVGGElement>("[data-grow]").forEach((el, i) => {
      tl.from(el, { scale: 0, rotation: i % 2 ? 14 : -14, svgOrigin: el.dataset.grow!, duration: 1.5, ease: "power3.out" }, 0.1 + i * 0.09);
    });
    tl.from(q('[data-role="frame"]'), { opacity: 0, duration: 1.2 }, 0.2);
  },
};

export default art;
