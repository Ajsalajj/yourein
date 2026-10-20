import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { measureText } from "@remotion/layout-utils";
import type { CaptionStyleState, StyleProps } from "../lib/project";
import type { OutCaption } from "../lib/timeline";
import { balanceLines, graphemes, isComplexScript } from "../lib/captions/text";
import { DEFAULT_EMPHASIS, extrudeShadows, glowShadows, gradientCss, gradientHue, mergeWordStyles, pickEmphasis, shadowLayers, staticTransform, type WordStyle } from "../lib/wordstyle";
import { BEHAVIOR_MAP } from "./animations/behaviors";
import { clamp, makeEase, makeSpring } from "./animations/helpers";
import type { BaseCtx, BlockGeometry, Behavior, WordCtx, WordVisual } from "./animations/types";
import { getTemplate, resolveStyle } from "./templates/registry";
import { applyTransform } from "./textTransform";
import { primaryFamily } from "./fontStacks";
import "./fonts";

/* ───────────── fonts ───────────── */
const loaded = new Set<string>();
/** Gates rendering until every family used by the caption (and the Indic fallbacks) is decoded - preview and export. */
export function useFontsReady(family: string | string[], weight: number | number[], text: string) {
  const fams = (Array.isArray(family) ? family : [family]).filter(Boolean);
  const wts = Array.isArray(weight) ? weight : [weight];
  const key = `${fams.join("+")}|${wts.join("+")}|${isComplexScript(text) ? "indic" : "latin"}`;
  const [ready, setReady] = useState(() => loaded.has(key) || typeof document === "undefined");
  const [handle] = useState(() => (loaded.has(key) || typeof document === "undefined" ? null : delayRender(`fonts ${key}`, { timeoutInMilliseconds: 25000 })));
  useEffect(() => {
    if (ready) {
      if (handle !== null) continueRender(handle);
      return;
    }
    let cancelled = false;
    const all = [...new Set([...fams, "Noto Sans Malayalam", "Noto Sans Devanagari", "Noto Sans Tamil"])];
    const weights = [...new Set(wts)];
    Promise.all(all.flatMap((f) => weights.map((w) => document.fonts.load(`${w} 48px "${f}"`, text || "Aa").catch(() => []))))
      .then(() => document.fonts.ready)
      .finally(() => {
        loaded.add(key);
        if (!cancelled) setReady(true);
        if (handle !== null) continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, handle, key, text]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

/* ───────────── per-word styles ───────────── */
/** These change glyph metrics, so the *active-word* layer may not touch them (no layout shift while speaking). */
const LAYOUT_KEYS = new Set(["fontFamily", "fontWeight", "fontStyle", "sizeScale", "textTransform", "letterSpacing"]);
const paintOnly = (s?: WordStyle): WordStyle | undefined => (s ? (Object.fromEntries(Object.entries(s).filter(([k]) => !LAYOUT_KEYS.has(k))) as WordStyle) : undefined);

/** StyleProps as seen by one word (what behaviours read as `c.style`). */
function wordStyleProps(base: StyleProps, eff: WordStyle): StyleProps {
  return {
    ...base,
    fontFamily: eff.fontFamily ?? base.fontFamily,
    fontWeight: eff.fontWeight ?? base.fontWeight,
    italic: eff.fontStyle ? eff.fontStyle === "italic" : base.italic,
    color: eff.color ?? base.color,
    strokeColor: eff.stroke?.color ?? base.strokeColor,
    strokeWidth: eff.stroke?.width ?? base.strokeWidth,
    letterSpacing: eff.letterSpacing ?? base.letterSpacing,
    textTransform: eff.textTransform ?? base.textTransform,
    animationDurationMs: eff.enterMs ?? base.animationDurationMs,
    springStiffness: eff.springStiffness ?? base.springStiffness,
    springDamping: eff.springDamping ?? base.springDamping,
    easing: eff.easing ?? base.easing,
  };
}

/* ───────────── layout ───────────── */
interface Layout {
  lines: number[][];
  fontPx: number;
  maxWidth: number;
  geom: BlockGeometry;
}

interface WordLayoutInput { text: string; style: StyleProps; sizeScale: number }

function computeLayout(words: WordLayoutInput[], style: StyleProps, behavior: Behavior, width: number, height: number, scale: number, fontsReady: boolean): Layout {
  const layoutKind = behavior.layout ?? "flow";
  const maxWidth = (width > height ? 0.72 : 0.88) * width;
  const basePx = style.fontSize * scale;
  const texts = words.map((w) => applyTransform(w.text, w.style));
  let lines: number[][];
  if (layoutKind === "stack" || layoutKind === "single" || layoutKind === "free") lines = words.map((_, i) => [i]);
  else lines = balanceLines(words.map((w) => w.text), style.maxWordsPerLine, style.maxLines);

  let fit = 1;
  let widths: number[] | null = null;
  if (fontsReady && typeof document !== "undefined") {
    try {
      const m = (i: number, size: number) => {
        const ws = words[i].style;
        return measureText({ text: texts[i], fontFamily: ws.fontFamily.includes(",") ? ws.fontFamily : primaryFamily(ws.fontFamily), fontSize: size * words[i].sizeScale, fontWeight: String(ws.fontWeight), letterSpacing: `${isComplexScript(texts[i]) ? 0 : ws.letterSpacing}em` }).width;
      };
      const gap = basePx * 0.28;
      const pad = (behavior.wordPadEm ?? 0) * basePx;
      let widest = 0;
      if (layoutKind === "flow") {
        widths = texts.map((_, i) => m(i, basePx) + pad);
        for (const line of lines) widest = Math.max(widest, line.reduce((acc, i) => acc + widths![i], 0) + gap * (line.length - 1));
      } else {
        const mult = layoutKind === "kinetic" ? 1.55 : layoutKind === "single" ? behavior.freeMaxEm ?? 1.15 : layoutKind === "free" ? behavior.freeMaxEm ?? 1.6 : 1.1;
        for (let i = 0; i < texts.length; i++) widest = Math.max(widest, m(i, basePx) * mult);
        if (layoutKind === "kinetic") for (const line of lines) widest = Math.max(widest, line.reduce((a, i) => a + m(i, basePx) * 1.2, 0) + gap * (line.length - 1));
      }
      if (widest > 0) fit = Math.min(1, ((layoutKind === "free" ? 0.9 * width : maxWidth) * 0.97) / widest);
    } catch {
      /* measurement is best-effort; flex layout still keeps the text on screen */
    }
  }
  const fs = basePx * fit;
  const gapPx = fs * 0.28;
  const padPx = (behavior.wordPadEm ?? 0) * fs;
  // Word rectangles relative to the caption block (used by behaviours that draw between words, e.g. a sliding box).
  const w = (widths ?? texts.map((t, i) => graphemes(t).length * fs * 0.56 * words[i].sizeScale + padPx)).map((x) => x * fit);
  const lineW = lines.map((l) => l.reduce((a, i) => a + w[i], 0) + gapPx * Math.max(0, l.length - 1));
  const blockW = Math.max(1, ...lineW);
  const lh = fs * style.lineHeight;
  const rects = new Array(words.length).fill(null).map(() => ({ x: 0, y: 0, w: 0, h: lh }));
  lines.forEach((l, li) => {
    let x = style.align === "left" ? 0 : style.align === "right" ? blockW - lineW[li] : (blockW - lineW[li]) / 2;
    l.forEach((i) => {
      rects[i] = { x, y: li * lh, w: w[i], h: lh * words[i].sizeScale };
      x += w[i] + gapPx;
    });
  });
  return { lines, fontPx: fs, maxWidth, geom: { rects, width: blockW, height: lh * lines.length } };
}

/* ───────────── rendering ───────────── */
const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;
const SAFE = { x: 0.04, top: 0.05, bottom: 0.06 };

interface GroupProps {
  caption: OutCaption;
  styleState: CaptionStyleState;
  wordStyles: Record<string, WordStyle>;
  /** first frame of the enclosing <Sequence>; frames inside it are local */
  fromFrame: number;
}

const CaptionGroup: React.FC<GroupProps> = ({ caption, styleState, wordStyles, fromFrame }) => {
  const frame = useCurrentFrame() + fromFrame; // global frame: all timing is expressed on the video clock
  const { fps, width, height } = useVideoConfig();
  const realMs = (frame * 1000) / fps;
  const tSec = frame / fps;
  const { style, template } = resolveStyle(styleState, caption.styleId);
  const behavior = BEHAVIOR_MAP[caption.animationId ?? template.animationId] ?? BEHAVIOR_MAP["word-pop"];
  const pos = caption.position ?? styleState.position;
  const scale = Math.min(width, height) / 1080;

  // ── per-word effective styles (stable word ids -> user overrides survive edits, saves and reloads)
  const emphasisOpts = style.emphasis ?? DEFAULT_EMPHASIS;
  const forced = useMemo(() => Object.fromEntries(caption.words.map((w) => [w.id, wordStyles[w.id]?.emphasize])), [caption.words, wordStyles]);
  const emphasizedIds = useMemo(() => pickEmphasis(caption.words, emphasisOpts, forced), [caption.words, emphasisOpts.mode, emphasisOpts.maxPerGroup, emphasisOpts.minLength, forced]); // eslint-disable-line react-hooks/exhaustive-deps
  const staticEff = useMemo(
    () => caption.words.map((w) => mergeWordStyles(style.look, emphasizedIds.has(w.id) && style.emphasisLook, wordStyles[w.id])),
    [caption.words, emphasizedIds, style.look, style.emphasisLook, wordStyles],
  );
  const layoutInputs: WordLayoutInput[] = caption.words.map((w, i) => ({ text: w.text, style: wordStyleProps(style, staticEff[i]), sizeScale: staticEff[i].sizeScale ?? 1 }));

  const families = [...new Set(layoutInputs.map((l) => primaryFamily(l.style.fontFamily)))];
  const weights = [...new Set(layoutInputs.map((l) => l.style.fontWeight))];
  const joined = caption.words.map((w) => w.text).join(" ");
  const fontsReady = useFontsReady(families, weights, joined);
  const layoutKey = JSON.stringify(layoutInputs.map((l) => [l.text, l.style.fontFamily, l.style.fontWeight, l.style.letterSpacing, l.style.textTransform, l.style.italic, l.sizeScale]));
  const layout = useMemo(() => computeLayout(layoutInputs, style, behavior, width, height, scale, fontsReady), [layoutKey, style, behavior, width, height, scale, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const dur = style.animationDurationMs;
  const k = style.intensity;
  const gStart = caption.startMs;
  const gEnd = caption.endMs;
  // style.offsetMs shifts the animation clock against the spoken timestamps; visibility and exit stay on real time.
  const ms = realMs - (style.offsetMs ?? 0);
  const exitMs = Math.max(0, style.exitMs ?? Math.min(200, (gEnd - gStart) * 0.25));
  const baseCtx = (st: StyleProps, msW: number, durW: number): BaseCtx => ({
    frame,
    fps,
    ms: msW,
    tSec,
    style: st,
    scale,
    dur: durW,
    k,
    ease: makeEase(st.easing),
    sk: st.scaleIntensity ?? 1,
    exitMs,
    group: { startMs: gStart, endMs: gEnd, wordCount: caption.words.length },
    sinceGroup: msW - gStart,
    untilGroupEnd: gEnd - realMs,
    enter: clamp((msW - gStart) / durW),
    exit: exitMs > 0 ? clamp((realMs - (gEnd - exitMs)) / exitMs) : 0,
    spr: makeSpring(frame, fps, durW, { stiffness: st.springStiffness, damping: st.springDamping }),
  });
  const base = baseCtx(style, ms, dur);

  const lengths = caption.words.map((w) => graphemes(w.text).length);
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);
  const startedCount = caption.words.filter((w) => ms >= w.startMs).length;
  const currentIdx = Math.max(0, startedCount - 1);
  const currentStartMs = caption.words[currentIdx]?.startMs ?? gStart;

  const lineOf = new Map<number, { lineIndex: number; indexInLine: number }>();
  layout.lines.forEach((line, li) => line.forEach((wi, pi) => lineOf.set(wi, { lineIndex: li, indexInLine: pi })));

  const dynEff = (i: number): WordStyle => {
    const w = caption.words[i];
    const isCur = startedCount > 0 && i === currentIdx;
    return mergeWordStyles(style.look, isCur && paintOnly(style.activeLook), emphasizedIds.has(w.id) && style.emphasisLook, wordStyles[w.id]);
  };

  const wordCtx = (i: number, eff: WordStyle, wst: StyleProps): WordCtx => {
    const w = caption.words[i];
    const where = lineOf.get(i) ?? { lineIndex: 0, indexInLine: i };
    const msW = ms - (eff.delayMs ?? 0);
    const durW = wst.animationDurationMs;
    const b = baseCtx(wst, msW, durW);
    const dWord = Math.max(1, w.endMs - w.startMs);
    return {
      ...b,
      word: w,
      index: i,
      count: caption.words.length,
      sinceWord: msW - w.startMs,
      untilWordEnd: w.endMs - msW,
      wordP: clamp((msW - w.startMs) / dWord),
      state: msW < w.startMs ? "future" : msW < w.endMs ? "active" : "past",
      revealed: msW >= w.startMs,
      lineIndex: where.lineIndex,
      indexInLine: where.indexInLine,
      lineCount: layout.lines.length,
      isCurrent: startedCount > 0 && i === currentIdx,
      hlP: clamp((msW - w.startMs) / Math.max(1, wst.highlightMs ?? 200)),
      geom: layout.geom,
      look: eff,
      emphasized: emphasizedIds.has(w.id),
      startedCount,
      currentStartMs,
      emphasis: maxLen === minLen ? 0.5 : (lengths[i] - minLen) / (maxLen - minLen),
    };
  };

  const groupVisual = behavior.group?.({ ...base, lineCount: layout.lines.length, geom: layout.geom, currentIndex: startedCount > 0 ? currentIdx : -1, currentStartMs }) ?? {};
  const layoutKind = behavior.layout ?? "flow";
  const fs = layout.fontPx;
  const fitK = fs / (style.fontSize * scale);
  const gap = fs * 0.28;

  /** CSS for one word: base typography, then the behaviour's motion, then the look (paint / depth / geometry). */
  const renderWord = (i: number, floating: boolean): { node: React.ReactNode; place?: { x: number; y: number } } | null => {
    const w = caption.words[i];
    const eff = dynEff(i);
    const wst = wordStyleProps(style, eff);
    const beh = (eff.animationId && BEHAVIOR_MAP[eff.animationId]) || behavior;
    const ctx = wordCtx(i, eff, wst);
    const vis: WordVisual = beh.word?.(ctx) ?? {};
    if (vis.hidden) return null;
    let place = vis.place ?? eff.position ?? undefined;
    if (place && fontsReady && typeof document !== "undefined") {
      // keep absolutely placed words fully inside the safe area, whatever size the animation gives them
      try {
        const emM = typeof vis.style?.fontSize === "string" ? parseFloat(vis.style.fontSize) || 1 : 1;
        const size = fs * (eff.sizeScale ?? 1) * emM;
        const tw = measureText({ text: applyTransform(w.text, wst), fontFamily: wst.fontFamily.includes(",") ? wst.fontFamily : primaryFamily(wst.fontFamily), fontSize: size, fontWeight: String(wst.fontWeight), letterSpacing: `${wst.letterSpacing}em` }).width;
        const hx = Math.min(0.46, tw / 2 / width + SAFE.x);
        const hy = Math.min(0.46, (size * 0.62) / height + SAFE.top);
        place = { x: clamp(place.x, hx, 1 - hx), y: clamp(place.y, hy, 1 - hy) };
      } catch {
        /* best effort */
      }
    }
    if (place && !floating) {
      // keep the slot in the line (layout stays stable); the visible copy is drawn absolutely by the caller
      return { node: <span key={w.id} aria-hidden style={{ display: "inline-block", whiteSpace: "pre", visibility: "hidden", fontSize: eff.sizeScale && eff.sizeScale !== 1 ? `${eff.sizeScale}em` : undefined }}>{applyTransform(w.text, wst)}</span>, place };
    }
    const text = applyTransform(w.text, wst);
    const complex = isComplexScript(w.text);
    const sw = (wst.strokeWidth ?? 0) * scale * fitK;
    const sizeEm = eff.sizeScale && eff.sizeScale !== 1 ? `${eff.sizeScale}em` : undefined;

    // ── shadows: extrusion + glow + (behaviour shadow) + shadows (look's, else the template's)
    const sh = vis.shadowK ?? 1;
    const shadowStrs: string[] = [];
    if (eff.extrude) shadowStrs.push(...extrudeShadows(eff.extrude, scale * fitK * (eff.sizeScale ?? 1), vis.extrudeK ?? 1));
    if (eff.glow) shadowStrs.push(...glowShadows(eff.glow, scale * fitK, tSec, vis.glowK ?? 1));
    const behaviourShadow = typeof vis.style?.textShadow === "string" && vis.style.textShadow !== "none" ? vis.style.textShadow : null;
    if (behaviourShadow) shadowStrs.push(behaviourShadow);
    const own = eff.shadows ? shadowLayers(eff.shadows, scale * fitK, sh) : wst.shadow ? [`${wst.shadow.offsetX * scale}px ${wst.shadow.offsetY * scale}px ${wst.shadow.blur * scale}px ${wst.shadow.color}`] : [];
    shadowStrs.push(...own);
    const textShadow = shadowStrs.length ? shadowStrs.join(", ") : undefined;

    const wordBaseStyle: React.CSSProperties = {
      display: "inline-block",
      position: "relative",
      whiteSpace: "pre",
      color: wst.color,
      fontFamily: eff.fontFamily,
      fontWeight: eff.fontWeight,
      fontSize: sizeEm,
      fontStyle: wst.italic ? "italic" : "normal",
      letterSpacing: complex ? 0 : `${wst.letterSpacing}em`,
      WebkitTextStroke: sw > 0 ? `${sw * 2}px ${wst.strokeColor}` : undefined,
      paintOrder: "stroke fill",
      textShadow,
      willChange: "transform, opacity",
    };

    // ── transform = behaviour motion, then the word's own static rotate/skew/perspective/offset
    const staticT = staticTransform(eff, scale * fitK, Math.min(width, height));
    const behaviourT = typeof vis.style?.transform === "string" ? vis.style.transform : "";
    const transform = [behaviourT, staticT].filter(Boolean).join(" ") || undefined;
    const blurIn = eff.blurInPx ? eff.blurInPx * scale * (1 - ctx.ease(ctx.sinceWord / Math.max(60, wst.animationDurationMs))) : 0;
    const filterParts = [typeof vis.style?.filter === "string" ? vis.style.filter : "", blurIn > 0.2 ? `blur(${blurIn.toFixed(1)}px)` : ""].filter(Boolean);
    const bg = eff.background
      ? { background: eff.background.color, padding: `${eff.background.padY}em ${eff.background.padX}em`, borderRadius: `${eff.background.radius}em` }
      : {};
    const opacity = (typeof vis.style?.opacity === "number" ? vis.style.opacity : 1) * (eff.opacity ?? 1);
    const outer: React.CSSProperties = { ...wordBaseStyle, ...bg, ...vis.style, textShadow: vis.fill || eff.gradient ? undefined : textShadow, transform, filter: filterParts.join(" ") || undefined, opacity };

    // ── gradient fill (background-clip:text is transparent, so stroke/shadows live on a duplicate layer underneath)
    let fill = vis.fill;
    let hue = 0;
    if (eff.gradient) {
      const g = gradientCss(eff.gradient, tSec);
      fill = { ...g, ...(vis.fill ?? {}) };
      hue = gradientHue(eff.gradient, tSec);
    }
    const parts =
      beh.unit === "char" && beh.char
        ? graphemes(text).map((ch, ci, arr) => (
            <span key={ci} style={{ display: "inline-block", whiteSpace: "pre", ...beh.char!(ctx, ch, ci, arr.length), ...(fill && !vis.fill ? { ...fill, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", filter: textShadow ? `drop-shadow(0 0 ${Math.round(6 * scale)}px rgba(0,0,0,.35))` : undefined } : {}) }}>
              {ch}
            </span>
          ))
        : text;
    const perGlyphGradient = beh.unit === "char" && !!fill && !vis.fill;
    const content = vis.inner ? <span style={{ display: "inline-block", ...vis.inner }}>{parts}</span> : parts;
    const attrs = { "data-word-id": w.id, "data-caption-id": caption.id } as Record<string, string>;

    let node: React.ReactNode;
    if (fill && !perGlyphGradient) {
      const outline: React.CSSProperties = { position: "absolute", left: 0, top: 0, color: wst.strokeColor, WebkitTextFillColor: sw > 0 ? wst.strokeColor : "transparent", WebkitTextStroke: wordBaseStyle.WebkitTextStroke, paintOrder: "stroke fill", textShadow, whiteSpace: "pre", pointerEvents: "none", letterSpacing: wordBaseStyle.letterSpacing };
      node = (
        <span key={w.id} {...attrs} style={{ ...outer, WebkitTextStroke: undefined }}>
          {vis.decoration}
          {sw > 0 || textShadow ? <span aria-hidden style={outline}>{text}</span> : null}
          <span style={{ position: "relative", display: "inline-block", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", filter: hue ? `hue-rotate(${hue.toFixed(1)}deg)` : undefined, ...fill }}>{content}</span>
          {vis.suffix}
        </span>
      );
    } else {
      node = (
        <span key={w.id} {...attrs} style={outer}>
          {vis.decoration}
          {content}
          {vis.suffix}
        </span>
      );
    }
    return { node, place };
  };

  const floatingWords: React.ReactNode[] = [];
  let body: React.ReactNode;
  const pushFloating = (i: number, place: { x: number; y: number }) => {
    const r = renderWord(i, true);
    if (!r) return;
    floatingWords.push(
      <div key={`f-${caption.words[i].id}`} style={{ position: "absolute", left: `${place.x * 100}%`, top: `${place.y * 100}%`, transform: "translate(-50%, -50%)", fontFamily: style.fontFamily, fontWeight: style.fontWeight, fontSize: fs, lineHeight: style.lineHeight, whiteSpace: "pre" }}>
        {r.node}
      </div>,
    );
  };
  if (layoutKind === "stack" || layoutKind === "single") {
    body = (
      <div style={{ position: "relative", width: layout.maxWidth, height: fs * style.lineHeight }}>
        {caption.words.map((_, i) => {
          const r = renderWord(i, false);
          if (r?.place) pushFloating(i, r.place);
          return r?.place ? null : r?.node;
        })}
      </div>
    );
  } else if (layoutKind === "free") {
    body = null;
    caption.words.forEach((_, i) => {
      const r = renderWord(i, false);
      if (r?.place) pushFloating(i, r.place);
    });
  } else {
    body = layout.lines.map((line, li) => (
      <div key={li} style={{ display: "flex", flexWrap: "nowrap", justifyContent: layoutKind === "kinetic" ? (li % 2 === 0 ? "flex-start" : "flex-end") : JUSTIFY[style.align], alignItems: "baseline", gap, width: layoutKind === "kinetic" ? layout.maxWidth : undefined }}>
        {line.map((wi) => {
          const r = renderWord(wi, false);
          if (r?.place) pushFloating(wi, r.place);
          return r?.node ?? null;
        })}
      </div>
    ));
  }

  // keep the block inside the safe area (never clipped by the frame), whatever the aspect ratio
  const blockW = layoutKind === "flow" ? layout.geom.width : layout.maxWidth * 0.8;
  const blockH = layoutKind === "flow" ? layout.geom.height : fs * style.lineHeight * Math.max(1, layout.lines.length);
  const halfW = Math.min(blockW, width * (1 - 2 * SAFE.x)) / 2;
  const halfH = blockH / 2;
  const cx = clamp(pos.x * width, SAFE.x * width + halfW, width - SAFE.x * width - halfW);
  const cy = clamp(pos.y * height, SAFE.top * height + halfH, height - SAFE.bottom * height - halfH);

  return (
    <>
      {groupVisual.overlay}
      {layoutKind === "free" ? null : (
        <div style={{ position: "absolute", left: cx, top: cy, transform: "translate(-50%, -50%)", maxWidth: layout.maxWidth, display: "flex", justifyContent: "center", perspective: behavior.perspective }}>
          <div
            style={{
              fontFamily: style.fontFamily,
              fontWeight: style.fontWeight,
              fontSize: fs,
              lineHeight: style.lineHeight,
              textAlign: style.align,
              display: "flex",
              flexDirection: "column",
              alignItems: style.align === "left" ? "flex-start" : style.align === "right" ? "flex-end" : "center",
              ...groupVisual.style,
            }}
          >
            {groupVisual.before}
            {body}
            {groupVisual.after}
          </div>
        </div>
      )}
      {floatingWords}
    </>
  );
};

export const CaptionLayer: React.FC<{ captions: OutCaption[]; styleState: CaptionStyleState; wordStyles?: Record<string, WordStyle> }> = ({ captions, styleState, wordStyles }) => {
  const { fps } = useVideoConfig();
  const ws = wordStyles ?? EMPTY;
  return (
    <>
      {captions.map((c) => {
        const from = Math.max(0, Math.floor((c.startMs * fps) / 1000));
        const end = Math.max(from + 1, Math.ceil((c.endMs * fps) / 1000));
        // Each caption lives in its own Sequence: it mounts only while visible, and Remotion owns its lifetime.
        return (
          <Sequence key={c.id} from={from} durationInFrames={end - from} layout="none" name={`caption ${c.words[0]?.text ?? ""}`}>
            <CaptionGroup caption={c} styleState={styleState} wordStyles={ws} fromFrame={from} />
          </Sequence>
        );
      })}
    </>
  );
};
const EMPTY: Record<string, WordStyle> = {};

export { getTemplate };
