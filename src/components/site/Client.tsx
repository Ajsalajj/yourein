"use client";

import React, { useEffect, useRef, useState } from "react";

/** The three hero phones. They lean a few degrees toward the pointer on desktop. */
export function HeroStage({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !window.matchMedia("(hover: hover) and (pointer: fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", String(Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2)))));
        el.style.setProperty("--my", String(Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2)))));
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
    };
  }, []);
  return <div className="hero-stage" ref={ref}>{children}</div>;
}

/** The guest side of the RSVP demo on the home page. It responds to taps but sends nothing. */
export function RsvpDemoCard() {
  const [pick, setPick] = useState<"yes" | "maybe" | "no">("yes");
  const [count, setCount] = useState(3);
  const opts: ["yes" | "maybe" | "no", string][] = [["yes", "Yes, I’ll be there"], ["maybe", "Maybe"], ["no", "Sorry, can’t make it"]];
  return (
    <div className="demo-card">
      <p className="demo-label">What your guests see</p>
      <p className="demo-q">Will you be joining us?</p>
      <div className="demo-opts" role="group" aria-label="Example reply">
        {opts.map(([k, label]) => (
          <button key={k} type="button" className="demo-opt" aria-pressed={pick === k} onClick={() => setPick(k)}><i />{label}</button>
        ))}
      </div>
      {pick !== "no" && (
        <div className="demo-count">
          <span>Guests attending</span>
          <span className="stepper">
            <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} aria-label="One fewer guest">−</button>
            <output>{count}</output>
            <button type="button" onClick={() => setCount((c) => Math.min(6, c + 1))} aria-label="One more guest">+</button>
          </span>
        </div>
      )}
    </div>
  );
}
