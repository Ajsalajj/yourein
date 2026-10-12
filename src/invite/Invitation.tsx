"use client";

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { pairOf, type Template } from "@/data/templates";
import { loadArt } from "./art";
import type { ArtModule } from "./art/types";
import { ArtDefs } from "./art/kit";
import { HeroStage } from "./HeroStage";
import { Sections } from "./Sections";
import { Motif } from "./Ornaments";
import { themeVars } from "./fonts";
import { gsap, letterIn, prefersReducedMotion, setupScroll } from "./motion";
import "./invitation.css";

type Phase = "sealed" | "opening" | "open";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * One complete invitation: sealed cover, opening animation, then the scrolling
 * page. It scrolls inside the nearest [data-inv-scroller] element, or the
 * window when there is none.
 */
export default function Invitation({ t, footer, onPhase, startOpen }: { t: Template; footer?: React.ReactNode; onPhase?: (p: Phase) => void; /** Skip the sealed cover (used by the editor's side preview). */ startOpen?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const [art, setArt] = useState<ArtModule | null>(null);
  const [failed, setFailed] = useState(false);
  const [phase, setPhaseState] = useState<Phase>(startOpen ? "open" : "sealed");
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const music = t.live?.music;
  const musicTarget = Math.max(0.05, Math.min(1, (t.live?.musicVolume ?? 35) / 100));
  const musicAutostart = t.live?.musicAutostart ?? true;

  /* Music runs through a gain node so it can fade (iPhones ignore an audio element's volume).
     The audio graph is made on the guest's tap, which is also what lets the browser play. */
  const graphRef = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  const fadeRaf = useRef(0);
  const graph = () => {
    if (graphRef.current) return graphRef.current;
    const a = audioRef.current;
    const AC = typeof window !== "undefined" ? window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
    if (!a || !AC) return null;
    try {
      const ctx = new AC();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(a).connect(gain).connect(ctx.destination);
      graphRef.current = { ctx, gain };
    } catch {
      graphRef.current = null;
    }
    return graphRef.current;
  };
  const fade = (to: number, secs: number) => {
    const g = graph(), a = audioRef.current;
    if (g) {
      const now = g.ctx.currentTime, p = g.gain.gain;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
      p.linearRampToValueAtTime(to, now + secs);
      return;
    }
    if (!a) return;
    cancelAnimationFrame(fadeRaf.current);
    const from = a.volume, t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / (secs * 1000));
      a.volume = from + (to - from) * k;
      if (k < 1) fadeRaf.current = requestAnimationFrame(step);
    };
    step();
  };
  const startMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    const g = graph();
    if (g) void g.ctx.resume();
    else a.volume = 0;
    a.play().then(() => fade(musicTarget, 1.8)).catch(() => {});
  };
  const stopMusic = () => {
    fade(0, 0.6);
    window.setTimeout(() => audioRef.current?.pause(), 650);
  };
  useEffect(() => () => {
    cancelAnimationFrame(fadeRaf.current);
    void graphRef.current?.ctx.close();
  }, []);

  const setPhase = useCallback((p: Phase) => {
    setPhaseState(p);
    onPhase?.(p);
  }, [onPhase]);

  useEffect(() => {
    onPhase?.(startOpen ? "open" : "sealed");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    loadArt(t.slug).then((a) => alive && setArt(() => a)).catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      tlRef.current?.kill();
    };
  }, [t.slug]);

  /* keep --ih equal to the height of whatever we scroll in */
  useIsoLayoutEffect(() => {
    const root = rootRef.current!;
    const sc = root.closest<HTMLElement>("[data-inv-scroller]");
    const set = () => root.style.setProperty("--ih", `${sc ? sc.clientHeight : window.innerHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(sc ?? document.documentElement);
    window.addEventListener("resize", set);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", set);
    };
  }, []);

  useIsoLayoutEffect(() => {
    if (phase !== "open" || !art) return;
    const root = rootRef.current!;
    const sc = root.closest<HTMLElement>("[data-inv-scroller]");
    return setupScroll(root, sc ?? window);
  }, [phase, art]);

  const open = () => {
    if (phase !== "sealed" || !art) return;
    const hero = rootRef.current!.querySelector<HTMLElement>(".inv-hero")!;
    /* the tap that opens the invitation is also what lets the browser start the music */
    if (music && musicAutostart) startMusic();
    setPhase("opening");
    const tl = gsap.timeline({ onComplete: () => setPhase("open") });
    art.open(hero, tl);
    if (!art.namesOnCover) letterIn(hero, tl, Math.max(0.3, tl.duration() - 1.2));
    tlRef.current = tl;
    if (prefersReducedMotion()) tl.progress(1);
  };

  const skip = () => tlRef.current?.progress(1);
  const toggleMusic = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) startMusic();
    else stopMusic();
  };

  return (
    <div ref={rootRef} className="inv" data-phase={phase} data-dark={t.theme.dark ? "true" : "false"} style={themeVars(t.theme)}>
      <ArtDefs />
      {art ? (
        <>
          {music && (
            <>
              <audio ref={audioRef} src={music} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
              {phase === "open" && (
                <div className="music-dock"><button type="button" className="music-btn" onClick={toggleMusic} aria-pressed={playing} aria-label={playing ? "Mute music" : "Play music"}>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                    {playing ? <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M9 18V6l10-2v12M9 18a3 3 0 1 1-6 0a3 3 0 0 1 6 0ZM19 16a3 3 0 1 1-6 0a3 3 0 0 1 6 0Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />}
                  </svg>
                </button></div>
              )}
            </>
          )}
          <HeroStage t={t} art={art} sealed={phase !== "open"} showCue={phase === "sealed"}>
            {phase === "sealed" && <button type="button" className="open-hit" onClick={open} aria-label={`${t.openLabel}: ${pairOf(t)}`} />}
            {phase === "opening" && <button type="button" className="skip-btn" onClick={skip}>Skip</button>}
            {phase === "open" && (
              <span className="scroll-cue" aria-hidden="true">
                <span>Scroll</span>
                <i />
              </span>
            )}
          </HeroStage>
          <Sections t={t} footer={footer} />
        </>
      ) : (
        <div className="inv-loading" role="status">
          <Motif motif={t.theme.motif} size={56} />
          <span>{failed ? "This invitation could not load. Close the preview and try again." : "Preparing your invitation"}</span>
        </div>
      )}
    </div>
  );
}
