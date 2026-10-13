"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { getTemplate, type Template } from "@/data/templates";
import { loadArt } from "@/invite/art";
import type { ArtModule } from "@/invite/art/types";
import { ArtDefs, PETALS } from "@/invite/art/kit";
import { HeroStage } from "@/invite/HeroStage";
import { themeVars } from "@/invite/fonts";
import { gsap, letterIn } from "@/invite/motion";
import "@/invite/invitation.css";
import { OUTRO_START, SEGMENTS, SHOWCASE, type Tier } from "./config";

export type PreviewHandle = {
  /** Draws the stage for master progress `p` (0 to 1). Cheap enough to call every frame. */
  update: (p: number, tier: Tier) => void;
};

type SceneApi = { root: HTMLElement; cam: HTMLElement; tl: gsap.core.Timeline; layers: { el: HTMLElement; depth: number }[] };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
/** Half-width of a hand-over between two designs, in master progress. */
const W = 0.035;
const PETAL_COUNT = 7;

/**
 * One design of the showcase, built from the real artwork of the invitation: the sealed cover, the scene behind it
 * and the design's own opening timeline. The timeline is paused and driven by scroll.
 */
function Scene({ t, art, index, onApi }: { t: Template; art: ArtModule; index: number; onApi: (i: number, api: SceneApi | null) => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const root = rootRef.current!;
    const cam = camRef.current!;
    const hero = root.querySelector<HTMLElement>(".inv-hero")!;
    const tl = gsap.timeline({ paused: true });
    art.open(hero, tl);
    if (!art.namesOnCover) letterIn(hero, tl, Math.max(0.3, tl.duration() - 1.2));
    tl.progress(0);
    const layers = Array.from(hero.querySelectorAll<HTMLElement>(".hero-scene > .sc-layer")).map((el) => ({ el, depth: parseFloat(el.dataset.depth || "0") }));
    onApi(index, { root, cam, tl, layers });
    return () => {
      onApi(index, null);
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [art, index]);

  return (
    <div ref={rootRef} className="inv ls-scene" data-dark={t.theme.dark ? "true" : "false"} data-scene={t.slug} style={{ ...themeVars(t.theme), visibility: index === 0 ? "visible" : "hidden", opacity: index === 0 ? 1 : 0 }}>
      <div ref={camRef} className="ls-cam">
        <HeroStage t={t} art={art} sealed showCue={false} />
      </div>
    </div>
  );
}

const PETAL_COLORS = [PETALS.blush[2], PETALS.rose[1], PETALS.blush[1], PETALS.rose[2], PETALS.ivory[2], PETALS.blush[2], PETALS.rose[1]];
const PETAL_LEFT = [8, 22, 38, 52, 66, 80, 92];

export default function LiveInvitationShowcasePreview({ active, onHandle, onFirstScene }: { active: number; onHandle: (h: PreviewHandle | null) => void; onFirstScene?: () => void }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const washRef = useRef<HTMLDivElement>(null);
  const petalsRef = useRef<HTMLDivElement>(null);
  const apis = useRef<(SceneApi | null)[]>([]);
  const lastP = useRef(0);
  const lastTier = useRef<Tier>("full");
  const [arts, setArts] = useState<Record<string, ArtModule>>({});
  const announced = useRef(false);

  /* load a design when it is on screen or next to it, and warm the one after that while the browser is idle */
  useEffect(() => {
    const want = [active - 1, active, active + 1].filter((i) => i >= 0 && i < SHOWCASE.length);
    want.forEach((i) => {
      const slug = SHOWCASE[i].slug;
      loadArt(slug).then((m) => setArts((cur) => (cur[slug] ? cur : { ...cur, [slug]: m }))).catch(() => {});
    });
    const warm = Math.min(SHOWCASE.length - 1, active + 2);
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 600));
    idle(() => { loadArt(SHOWCASE[warm].slug).catch(() => {}); });
  }, [active]);

  const draw = useCallback((p: number, tier: Tier) => {
    lastP.current = p;
    lastTier.current = tier;
    const amp = { full: 38, mid: 26, light: 14, low: 0 }[tier];
    const list = apis.current;
    const topIn = SHOWCASE.map((_, i) => (i === 0 ? 1 : smooth((p - (SEGMENTS[i][0] - W)) / (2 * W))));

    list.forEach((api, i) => {
      if (!api) return;
      const [s, e] = SEGMENTS[i];
      const u = (p - s) / (e - s);
      const u0 = i === 0 ? 0.22 : 0.18;
      api.tl.progress(clamp((u - u0) / (0.8 - u0)));
      const inA = topIn[i];
      const covered = i < SHOWCASE.length - 1 && topIn[i + 1] >= 0.999;
      const leaving = i < SHOWCASE.length - 1 ? topIn[i + 1] : 0;
      const el = api.root;
      el.style.visibility = inA <= 0.001 || covered ? "hidden" : "visible";
      el.style.opacity = String(inA);
      const sc = i === 0 && p <= 0 ? 1 : (1 + 0.06 * (1 - inA)) * (1 - 0.045 * leaving);
      el.style.transform = `scale(${sc.toFixed(4)})`;
      el.style.zIndex = String(i + 1);
      /* slow push-in, and each depth drifting at its own pace */
      const k = clamp((u + 0.15) / 1.3);
      api.cam.style.transform = tier === "low" ? "" : `scale(${(1 + 0.04 * k).toFixed(4)})`;
      if (amp > 0 && inA > 0.001 && !covered) {
        const t = u - 0.5;
        for (const l of api.layers) l.el.style.translate = `0 ${((0.5 - l.depth) * amp * t).toFixed(2)}px`;
      }
    });

    /* wash: a soft tint of the next design that peaks as the hand-over happens */
    const wash = washRef.current;
    if (wash) {
      let bump = 0;
      let at = 0;
      for (let i = 0; i < SEGMENTS.length - 1; i++) {
        const b = SEGMENTS[i][1];
        const v = clamp(1 - Math.abs(p - b) / (W * 1.7));
        if (v > bump) { bump = v; at = i; }
      }
      wash.style.opacity = bump > 0 ? String((smooth(bump) * (tier === "low" ? 0.32 : 0.55)).toFixed(3)) : "0";
      if (bump > 0) wash.style.setProperty("--wc", SHOWCASE[at].wash);
    }

    /* a few petals cross the stage as the ivory card turns into roses */
    const petals = petalsRef.current;
    if (petals && tier !== "low") {
      const t = clamp((p - (SEGMENTS[0][1] - 0.05)) / 0.1);
      const on = t > 0 && t < 1;
      petals.style.visibility = on ? "visible" : "hidden";
      if (on) {
        const count = { full: PETAL_COUNT, mid: 5, light: 3, low: 0 }[tier];
        Array.from(petals.children).forEach((c, i) => {
          const el = c as HTMLElement;
          if (i >= count) { el.style.display = "none"; return; }
          el.style.display = "";
          const f = 0.75 + (i % 3) * 0.14;
          const tt = clamp(t * f * 1.15);
          el.style.transform = `translate3d(${Math.sin(tt * 5 + i) * 18}px, ${(-12 + tt * 124).toFixed(1)}cqh, 0) rotate(${(tt * 300 + i * 40).toFixed(0)}deg)`;
          el.style.opacity = String(Math.sin(clamp(tt) * Math.PI).toFixed(3));
        });
      }
    }

    /* outro: the last scene settles back into the frame */
    const stage = stageRef.current;
    if (stage) {
      const o = smooth((p - OUTRO_START) / (1 - OUTRO_START));
      stage.style.setProperty("--o", o.toFixed(3));
    }
  }, []);

  useEffect(() => {
    onHandle({ update: draw });
    return () => onHandle(null);
  }, [draw, onHandle]);

  const onApi = useCallback((i: number, api: SceneApi | null) => {
    apis.current[i] = api;
    if (api) {
      draw(lastP.current, lastTier.current);
      if (!announced.current) {
        announced.current = true;
        onFirstScene?.();
      }
    }
  }, [draw, onFirstScene]);

  return (
    <div ref={stageRef} className="ls-stage" style={{ ["--o" as string]: 0 }}>
      <ArtDefs />
      {SHOWCASE.map((it, i) => {
        const t = getTemplate(it.slug)!;
        const near = Math.abs(i - Math.min(active, SHOWCASE.length - 1)) <= 1;
        const art = arts[it.slug];
        if (!near || !art) return null;
        return <Scene key={it.slug} t={t} art={art} index={i} onApi={onApi} />;
      })}
      <div ref={washRef} className="ls-wash" aria-hidden="true" />
      <div ref={petalsRef} className="ls-petals" aria-hidden="true" style={{ visibility: "hidden" }}>
        {PETAL_COLORS.map((c, i) => (
          <svg key={i} viewBox="-8 -18 16 20" style={{ left: `${PETAL_LEFT[i]}%`, width: `${5 + (i % 3) * 1.6}cqw` }}>
            <path d="M0 0C6-4 7-12 0-17C-7-11-5-4 0 0Z" fill={c} />
          </svg>
        ))}
      </div>
    </div>
  );
}
