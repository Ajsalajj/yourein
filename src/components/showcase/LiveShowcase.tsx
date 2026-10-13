"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { TEMPLATES, getTemplate } from "@/data/templates";
import { PreviewButton } from "@/components/preview/PreviewProvider";
import { CustomizeLink } from "@/components/site/Actions";
import { InvitationPhoneMockup } from "@/components/site/InvitationPhoneMockup";
import { Price } from "@/components/site/Price";
import { DARK, LIGHT, OUTRO_BG, OUTRO_START, SEGMENTS, SHOWCASE, indexAt, type Tier } from "./config";
import type { PreviewHandle } from "./Preview";
import "./showcase.css";

/* The scene engine (artwork, fonts, GSAP) is fetched only when the section is about to come into view. */
const Preview = dynamic(() => import("./Preview"), { ssr: false });

const COUNT = SHOWCASE.length;
const pad = (n: number) => String(n).padStart(2, "0");
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number) => {
  const x = clamp(v);
  return x * x * (3 - 2 * x);
};
/** Half-width of the hand-over between two designs (matches the stage). */
const W = 0.035;

function Actions({ slug }: { slug: string }) {
  return (
    <div className="ls-cta">
      <PreviewButton slug={slug} className="btn btn-solid"><span>Preview<span className="ls-xl"> Full Template</span></span></PreviewButton>
      <CustomizeLink slug={slug} className="btn btn-quiet" />
    </div>
  );
}

function Outro() {
  return (
    <div className="ls-copy ls-outro">
      <h3 className="ls-name">Find the one that feels like yours.</h3>
      <p className="ls-line">Explore all {TEMPLATES.length} invitation designs.</p>
      <div className="ls-cta">
        <a className="btn btn-solid" href="#templates">Explore all {TEMPLATES.length} templates</a>
        <a className="btn btn-quiet" href="/create">Create Invitation</a>
      </div>
    </div>
  );
}

function StaticShowcase() {
  const ref = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>(".ls-card");
    if (!items) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("is-in"), io.unobserve(e.target))), { threshold: 0.2 });
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <div className="wrap">
      <ol className="ls-cards" ref={ref}>
        {SHOWCASE.map((it, i) => {
          const t = getTemplate(it.slug)!;
          return (
            <li key={it.slug} className="ls-card" style={{ ["--card-bg" as string]: t.theme.plinth }}>
              <div className="ls-card-art">
                <InvitationPhoneMockup t={t} shadow="deep" sizes="(max-width: 720px) 60vw, 240px" />
              </div>
              <div className="ls-copy">
                <p className="ls-count"><b>{pad(i + 1)}</b> / {pad(COUNT)}</p>
                <h3 className="ls-name">{t.name}</h3>
                <p className="ls-cat">{it.category}</p>
                <p className="ls-line">{it.line}</p>
                <p className="ls-price"><Price /> <span>to publish</span></p>
                <Actions slug={it.slug} />
              </div>
            </li>
          );
        })}
      </ol>
      <Outro />
    </div>
  );
}

/**
 * The homepage's scroll-driven showcase. Six designs open, move and change as the visitor scrolls through one
 * pinned stage. The text and buttons beside it follow whichever design is on screen, and use the same Preview and
 * Customize paths as the catalog. Visitors who prefer reduced motion get a plain sequence of cards instead.
 */
export function LiveShowcase() {
  const secRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const handle = useRef<PreviewHandle | null>(null);
  const progress = useRef(0);
  const tierRef = useRef<Tier>("full");
  const [idx, setIdx] = useState(0);
  const [reduced, setReduced] = useState<boolean | null>(null);
  const [near, setNear] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  /* start fetching well before the section is reached, so the first design is already drawn when the pin engages */
  useEffect(() => {
    const el = secRef.current;
    if (!el || reduced !== false) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setNear(true), io.disconnect()), { rootMargin: "1800px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const onHandle = useCallback((h: PreviewHandle | null) => {
    handle.current = h;
    if (h) h.update(progress.current, tierRef.current);
  }, []);

  useEffect(() => {
    if (!near || reduced !== false) return;
    let dead = false;
    let cleanup = () => {};
    import("@/invite/motion").then(({ gsap, ScrollTrigger }) => {
      const sec = secRef.current;
      const pin = pinRef.current;
      if (dead || !sec || !pin) return;
      const mix = gsap.utils.interpolate as (a: string | number, b: string | number, t: number) => string | number;
      const nav = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--nav-h")) || 60;
      const nav2 = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
      const lowEnd = (nav2.hardwareConcurrency || 8) <= 4 || (nav2.deviceMemory ?? 8) <= 4 || !!nav2.connection?.saveData;

      /* a value that holds through each design and eases across the hand-over */
      const across = (vals: (string | number)[], p: number, after?: string | number) => {
        if (p >= OUTRO_START) return after === undefined ? vals[COUNT - 1] : mix(vals[COUNT - 1], after, smooth((p - OUTRO_START) / (1 - OUTRO_START)));
        for (let i = 0; i < COUNT - 1; i++) {
          const b = SEGMENTS[i][1];
          if (Math.abs(p - b) < W) return mix(vals[i], vals[i + 1], smooth((p - b + W) / (2 * W)));
        }
        return vals[indexAt(p)];
      };
      const bgs = SHOWCASE.map((s) => s.bg);
      const darks = SHOWCASE.map((s) => (s.dark ? 1 : 0));
      const scenic = SHOWCASE.map((_, i) => (i === COUNT - 1 ? 1 : 0));

      let lastIdx = -1;
      const render = (p: number) => {
        progress.current = p;
        handle.current?.update(p, tierRef.current);
        const d = across(darks, p) as number;
        sec.style.setProperty("--ls-bg", String(across(bgs, p, OUTRO_BG)));
        sec.style.setProperty("--ls-ink", String(mix(LIGHT.ink, DARK.ink, d)));
        sec.style.setProperty("--ls-soft", String(mix(LIGHT.soft, DARK.soft, d)));
        sec.style.setProperty("--ls-btn-bg", String(mix(LIGHT.btnBg, DARK.btnBg, d)));
        sec.style.setProperty("--ls-btn-fg", String(mix(LIGHT.btnFg, DARK.btnFg, d)));
        sec.style.setProperty("--ls-scenic", String(across(scenic, p, 0)));
        sec.style.setProperty("--p", String(clamp(p / OUTRO_START)));
        const i = indexAt(p);
        if (i !== lastIdx) {
          lastIdx = i;
          setIdx(i);
        }
      };

      const mm = gsap.matchMedia();
      mm.add({ desk: "(min-width: 1024px)", tab: "(min-width: 700px) and (max-width: 1023.98px)", mob: "(max-width: 699.98px)" }, (ctx) => {
        const c = ctx.conditions as { desk: boolean; tab: boolean };
        /* viewport heights of scrolling per design: richer and slower on desktop, brisk on phones */
        const perDesign = c.desk ? 1.15 : c.tab ? 0.95 : 0.8;
        const tier: Tier = lowEnd ? "low" : c.desk ? "full" : c.tab ? "mid" : "light";
        tierRef.current = tier;
        sec.dataset.tier = tier;
        let target = progress.current;
        let shown = target;
        let running = false;
        const tick = () => {
          shown += (target - shown) * 0.2;
          if (Math.abs(target - shown) < 0.0004) shown = target;
          render(shown);
          if (shown === target) {
            running = false;
            gsap.ticker.remove(tick);
          }
        };
        const st = ScrollTrigger.create({
          trigger: pin,
          start: () => `top top+=${nav()}`,
          end: () => `+=${Math.round(pin.offsetHeight * (COUNT * perDesign) / OUTRO_START)}`,
          pin: true,
          pinSpacing: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            target = self.progress;
            if (!running) {
              running = true;
              gsap.ticker.add(tick);
            }
          },
          onRefresh: (self) => {
            target = shown = self.progress;
            render(shown);
          },
        });
        return () => {
          st.kill();
          gsap.ticker.remove(tick);
        };
      });

      /* things above this section can change height (catalog filters, lazy images), which moves the pin */
      const main = document.getElementById("main");
      let h = main?.offsetHeight ?? 0;
      let timer = 0;
      const ro = new ResizeObserver(() => {
        const next = main?.offsetHeight ?? 0;
        if (Math.abs(next - h) < 2) return;
        h = next;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => ScrollTrigger.refresh(), 250);
      });
      if (main) ro.observe(main);
      const late = () => ScrollTrigger.refresh();
      window.addEventListener("load", late);
      document.fonts?.ready.then(late).catch(() => {});

      cleanup = () => {
        ro.disconnect();
        window.clearTimeout(timer);
        window.removeEventListener("load", late);
        mm.revert();
      };
    });
    return () => {
      dead = true;
      cleanup();
    };
  }, [near, reduced]);

  const i = Math.min(idx, COUNT - 1);
  const item = SHOWCASE[i];
  const t = getTemplate(item.slug)!;
  const poster = SHOWCASE[Math.min(idx, COUNT - 1)].slug;

  return (
    <section id="live" ref={secRef} className="ls" data-mode={reduced ? "static" : "pin"} aria-labelledby="ls-h">
      <div className="wrap ls-head">
        <p className="ls-label">{COUNT} featured experiences <span aria-hidden="true">•</span> {TEMPLATES.length} templates available</p>
        <h2 id="ls-h">See the invitation come alive.</h2>
        <p className="ls-sub">Experience six of our signature designs as they open, move and transform while you scroll.</p>
      </div>

      {reduced ? (
        <StaticShowcase />
      ) : (
        <div ref={pinRef} className="ls-pin">
          <div className="wrap ls-grid">
            <div className="ls-stage-col">
              <div className="ls-frame" role="img" aria-label={idx < COUNT ? `${t.name}: animated preview of the invitation opening` : "Animated invitation previews"}>
                <div className="ls-poster" data-hide={ready ? "true" : "false"}>
                  <Image src={`/thumbs/${poster}.webp`} alt="" fill sizes="(max-width: 760px) 92vw, 560px" style={{ objectFit: "cover" }} />
                </div>
                {near && <Preview active={Math.min(idx, COUNT - 1)} onHandle={onHandle} onFirstScene={() => setReady(true)} />}
              </div>
              <div className="ls-prog" aria-hidden="true">
                <i className="ls-fill" />
                {SHOWCASE.map((s, k) => <s key={s.slug} data-on={k <= idx ? "true" : "false"} style={{ ["--k" as string]: k }} />)}
              </div>
            </div>
            <div className="ls-text">
              {idx < COUNT ? (
                <div className="ls-copy" key={idx}>
                  <p className="ls-count"><b>{pad(idx + 1)}</b> / {pad(COUNT)}</p>
                  <h3 className="ls-name">{t.name}</h3>
                  <p className="ls-cat">{item.category}</p>
                  <p className="ls-line">{item.line}</p>
                  <p className="ls-price"><Price /> <span>to publish</span></p>
                  <Actions slug={item.slug} />
                </div>
              ) : (
                <Outro key="outro" />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
