import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Names write themselves in, then the date settles under them. */
export function letterIn(hero: HTMLElement, tl: gsap.core.Timeline, at: number) {
  const q = (s: string) => hero.querySelectorAll(s);
  tl.fromTo(q(".hero-text"), { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.05 }, at)
    .fromTo(q(".hero-names .nm"), { clipPath: "inset(-30% 100% -30% -10%)" }, { clipPath: "inset(-30% -10% -30% -10%)", duration: 1.25, stagger: 0.28, ease: "power2.inOut" }, at)
    .from(q(".hero-motif, .hero-names .amp, .hero-date"), { opacity: 0, y: 10, duration: 0.8, stagger: 0.14, ease: "power2.out" }, at + 0.25)
    .from(q(".hero-rule"), { scaleX: 0, duration: 0.9, ease: "power2.out" }, at + 0.6);
}

/**
 * Everything that responds to scrolling once the invitation is open.
 * Returns a cleanup function.
 */
export function setupScroll(root: HTMLElement, scroller: HTMLElement | Window) {
  const reduced = prefersReducedMotion();
  const ctx = gsap.context(() => {
    const st = (o: ScrollTrigger.Vars): ScrollTrigger.Vars => ({ scroller, ...o });
    const all = <T extends Element = HTMLElement>(s: string) => gsap.utils.toArray<T>(s, root);
    const hero = root.querySelector<HTMLElement>(".inv-hero")!;

    if (reduced) {
      all('[data-rv]').forEach((el) => {
        gsap.from(el, { opacity: 0, duration: 0.6, scrollTrigger: st({ trigger: el, start: "top 92%" }) });
      });
      return;
    }

    /* first screen: each depth travels at its own speed */
    all(".hero-scene > .sc-layer").forEach((layer) => {
      const d = parseFloat(layer.dataset.depth || "0");
      gsap.to(layer, { yPercent: (0.3 - d * 0.44) * 100, ease: "none", scrollTrigger: st({ trigger: hero, start: "top top", end: "bottom top", scrub: true }) });
    });
    gsap.to(all(".hero-text-in"), { yPercent: -45, opacity: 0, ease: "none", scrollTrigger: st({ trigger: hero, start: "top top", end: "62% top", scrub: true }) });
    gsap.to(all(".scroll-cue"), { opacity: 0, ease: "none", scrollTrigger: st({ trigger: hero, start: "top top", end: "12% top", scrub: true }) });

    /* reveals */
    all('[data-rv="up"]').forEach((el) => {
      gsap.from(el, { y: 26, opacity: 0, duration: 0.95, ease: "power2.out", scrollTrigger: st({ trigger: el, start: "top 90%" }) });
    });
    all('[data-rv="wipe"]').forEach((el) => {
      gsap.fromTo(el, { clipPath: "inset(-30% 100% -40% -6%)", opacity: 0.2 }, { clipPath: "inset(-30% -6% -40% -6%)", opacity: 1, duration: 1.35, ease: "power2.inOut", scrollTrigger: st({ trigger: el, start: "top 88%" }) });
    });
    all('[data-rv="photo"]').forEach((el) => {
      const inner = el.firstElementChild;
      const trig = st({ trigger: el, start: "top 86%" });
      gsap.fromTo(el, { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "power3.out", scrollTrigger: trig });
      if (inner) gsap.fromTo(inner, { scale: 1.2 }, { scale: 1, duration: 2, ease: "power2.out", scrollTrigger: st({ trigger: el, start: "top 86%" }) });
    });
    all(".divider").forEach((el) => {
      gsap.from(el.querySelectorAll(".divider-line"), { scaleX: 0, duration: 1.2, ease: "power2.out", scrollTrigger: st({ trigger: el, start: "top 90%" }) });
      gsap.from(el.querySelectorAll(".motif"), { opacity: 0, scale: 0.6, duration: 0.9, ease: "power2.out", scrollTrigger: st({ trigger: el, start: "top 90%" }) });
    });
    all(".events").forEach((el) => {
      gsap.from(el.querySelectorAll(".events-line"), { scaleY: 0, ease: "none", scrollTrigger: st({ trigger: el, start: "top 80%", end: "bottom 70%", scrub: true }) });
    });

    /* pictures drift inside their frames */
    all(".frame-art").forEach((frame) => {
      frame.querySelectorAll<SVGGElement>("[data-par]").forEach((g) => {
        const d = parseFloat(g.dataset.par || "0");
        gsap.fromTo(g, { y: 26 * d }, { y: -26 * d, ease: "none", scrollTrigger: st({ trigger: frame, start: "top bottom", end: "bottom top", scrub: true }) });
      });
    });

    /* flowers enter from the edges as their section arrives */
    all(".sec-flora").forEach((el, i) => {
      const dir = el.classList.contains("sec-flora-tl") || el.classList.contains("sec-flora-bl") ? -1 : 1;
      gsap.fromTo(el, { xPercent: 42 * dir, rotation: 12 * dir, opacity: 0 }, { xPercent: 0, rotation: 0, opacity: 1, ease: "none", scrollTrigger: st({ trigger: el.parentElement!, start: "top 96%", end: i % 2 ? "top 20%" : "top 36%", scrub: 0.6 }) });
    });

    /* cinematic mid-section */
    all(".feat").forEach((feat) => {
      const q = (s: string) => feat.querySelectorAll(s);
      const tl = gsap.timeline({ defaults: { ease: "none" }, scrollTrigger: st({ trigger: feat, start: "top top", end: "bottom bottom", scrub: 0.5 }) });
      const kind = feat.dataset.feat;
      if (kind === "arch") {
        tl.to(q(".feat-lead"), { opacity: 0, yPercent: -60, duration: 0.16 }, 0.02)
          .to(q('[data-fl="wall-0"]'), { scale: 4.4, duration: 0.5, ease: "power1.in" }, 0)
          .to(q('[data-fl="wall-0"]'), { opacity: 0, duration: 0.12 }, 0.4)
          .to(q('[data-fl="wall-1"]'), { scale: 4.6, duration: 0.5, ease: "power1.in" }, 0.2)
          .to(q('[data-fl="wall-1"]'), { opacity: 0, duration: 0.12 }, 0.6)
          .to(q('[data-fl="wall-2"]'), { scale: 5, duration: 0.5, ease: "power1.in" }, 0.4)
          .to(q('[data-fl="wall-2"]'), { opacity: 0, duration: 0.12 }, 0.8)
          .fromTo(q(".feat-date"), { scale: 0.42, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: "power1.out" }, 0.4)
          .fromTo(q(".feat-glow"), { opacity: 0.5 }, { opacity: 1, duration: 1 }, 0);
      } else if (kind === "scenic") {
        tl.to(q(".feat-lead"), { opacity: 0, yPercent: -60, duration: 0.2 }, 0.05)
          .fromTo(q('[data-fl="sky"]'), { yPercent: -3 }, { yPercent: 3, duration: 1 }, 0)
          .fromTo(q('[data-fl="far"]'), { scale: 1 }, { scale: 1.08, duration: 1 }, 0)
          .fromTo(q('[data-fl="mid"]'), { scale: 1 }, { scale: 1.18, yPercent: 2, duration: 1 }, 0)
          .fromTo(q('[data-fl="near"]'), { scale: 1.04 }, { scale: 1.26, yPercent: 3, duration: 1 }, 0)
          .fromTo(q(".feat-flora-l"), { xPercent: 16, yPercent: -6 }, { xPercent: -52, yPercent: 16, duration: 0.8, ease: "power1.in" }, 0.05)
          .fromTo(q(".feat-flora-r"), { xPercent: -16, yPercent: -6 }, { xPercent: 52, yPercent: 16, duration: 0.8, ease: "power1.in" }, 0.05)
          .fromTo(q(".feat-date > *"), { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.3, stagger: 0.06, ease: "power1.out" }, 0.25);
      } else {
        tl.fromTo(q(".fp-stack"), { scale: 0.8, yPercent: 14 }, { scale: 1, yPercent: 0, duration: 0.6, ease: "power1.out" }, 0)
          .fromTo(q(".fp-c"), { rotation: 0, xPercent: 0 }, { rotation: -9, xPercent: -7, duration: 0.7, ease: "power1.inOut" }, 0.15)
          .fromTo(q(".fp-b"), { rotation: 0, xPercent: 0 }, { rotation: 7, xPercent: 6, duration: 0.7, ease: "power1.inOut" }, 0.15)
          .fromTo(q(".fp-a"), { rotation: 3 }, { rotation: -1.5, duration: 0.7, ease: "power1.inOut" }, 0.15)
          .fromTo(q(".feat-date > *"), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.25, stagger: 0.04, ease: "power1.out" }, 0.08)
          .fromTo(q(".feat-flora-l"), { xPercent: -40, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.6, ease: "power1.out" }, 0.25)
          .fromTo(q(".feat-flora-r"), { xPercent: 40, opacity: 0 }, { xPercent: 0, opacity: 1, duration: 0.6, ease: "power1.out" }, 0.3);
      }
    });
  }, root);

  const refresh = () => ScrollTrigger.refresh();
  if (document.fonts?.ready) document.fonts.ready.then(refresh);
  const id = window.setTimeout(refresh, 400);
  return () => {
    window.clearTimeout(id);
    ctx.revert();
  };
}
