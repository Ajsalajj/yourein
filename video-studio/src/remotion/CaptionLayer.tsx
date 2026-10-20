import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { measureText } from "@remotion/layout-utils";
import type { CaptionStyleState, StyleProps } from "../lib/project";
import type { OutCaption } from "../lib/timeline";
import { balanceLines, graphemes, isComplexScript } from "../lib/captions/text";
import { BEHAVIOR_MAP } from "./animations/behaviors";
import { clamp, easeOutCubic, makeSpring } from "./animations/helpers";
import type { BaseCtx, Behavior, WordCtx, WordVisual } from "./animations/types";
import { getTemplate, resolveStyle } from "./templates/registry";
import { primaryFamily } from "./fontStacks";
import "./fonts";

/* ───────────── fonts ───────────── */
const loaded = new Set<string>();
function useFontsReady(family: string, weight: number, text: string) {
  const key = `${family}|${weight}|${isComplexScript(text) ? "indic" : "latin"}`;
  const [ready, setReady] = useState(() => loaded.has(key) || typeof document === "undefined");
  const [handle] = useState(() => (loaded.has(key) || typeof document === "undefined" ? null : delayRender(`fonts ${key}`, { timeoutInMilliseconds: 25000 })));
  useEffect(() => {
    if (ready) {
      if (handle !== null) continueRender(handle);
      return;
    }
    let cancelled = false;
    const families = [family, "Noto Sans Malayalam", "Noto Sans Devanagari", "Noto Sans Tamil"];
    Promise.all(families.map((f) => document.fonts.load(`${weight} 48px "${f}"`, text || "Aa").catch(() => [])))
      .then(() => document.fonts.ready)
      .finally(() => {
        loaded.add(key);
        if (!cancelled) setReady(true);
        if (handle !== null) continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, handle, key, family, weight, text]);
  return ready;
}

/* ───────────── layout ───────────── */
interface Layout {
  lines: number[][];
  fontPx: number;
  maxWidth: number;
}

function computeLayout(words: string[], style: StyleProps, behavior: Behavior, width: number, height: number, scale: number, fontsReady: boolean): Layout {
  const layoutKind = behavior.layout ?? "flow";
  const maxWidth = (width > height ? 0.72 : 0.88) * width;
  const basePx = style.fontSize * scale;
  const texts = words.map((w) => (style.uppercase && !isComplexScript(w) ? w.toLocaleUpperCase() : w));
  let lines: number[][];
  if (layoutKind === "stack" || layoutKind === "single") lines = words.map((_, i) => [i]);
  else lines = balanceLines(words, style.maxWordsPerLine, style.maxLines);

  let fit = 1;
  if (fontsReady && typeof document !== "undefined") {
    try {
      const family = primaryFamily(style.fontFamily);
      const m = (t: string, size: number) =>
        measureText({ text: t, fontFamily: style.fontFamily.includes(",") ? style.fontFamily : family, fontSize: size, fontWeight: String(style.fontWeight), letterSpacing: `${isComplexScript(t) ? 0 : style.letterSpacing}em` }).width;
      const gap = basePx * 0.28;
      const pad = (behavior.wordPadEm ?? 0) * basePx;
      let widest = 0;
      if (layoutKind === "flow") {
        for (const line of lines) widest = Math.max(widest, line.reduce((acc, i) => acc + m(texts[i], basePx) + pad, 0) + gap * (line.length - 1));
      } else {
        const mult = layoutKind === "kinetic" ? 1.55 : layoutKind === "single" ? 1.15 : 1.1;
        for (const t of texts) widest = Math.max(widest, m(t, basePx) * mult);
        if (layoutKind === "kinetic") {
          for (const line of lines) widest = Math.max(widest, line.reduce((a, i) => a + m(texts[i], basePx) * 1.2, 0) + gap * (line.length - 1));
        }
      }
      if (widest > 0) fit = Math.min(1, (maxWidth * 0.97) / widest);
    } catch {
      /* measurement is best-effort; flex layout still keeps the text on screen */
    }
  }
  return { lines, fontPx: basePx * fit, maxWidth };
}

/* ───────────── rendering ───────────── */
const JUSTIFY = { left: "flex-start", center: "center", right: "flex-end" } as const;

interface GroupProps {
  caption: OutCaption;
  styleState: CaptionStyleState;
}

const CaptionGroup: React.FC<GroupProps> = ({ caption, styleState }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const ms = (frame * 1000) / fps;
  const { style, template } = resolveStyle(styleState, caption.styleId);
  const behavior = BEHAVIOR_MAP[caption.animationId ?? template.animationId] ?? BEHAVIOR_MAP["word-pop"];
  const pos = caption.position ?? styleState.position;
  const scale = Math.min(width, height) / 1080;
  const wordTexts = useMemo(() => caption.words.map((w) => w.text), [caption.words]);
  const joined = wordTexts.join(" ");
  const fontsReady = useFontsReady(primaryFamily(style.fontFamily), style.fontWeight, joined);
  const layout = useMemo(() => computeLayout(wordTexts, style, behavior, width, height, scale, fontsReady), [wordTexts, style, behavior, width, height, scale, fontsReady]);

  const dur = style.animationDurationMs;
  const k = style.intensity;
  const gStart = caption.startMs;
  const gEnd = caption.endMs;
  const exitMs = Math.min(200, (gEnd - gStart) * 0.25);
  const base: BaseCtx = {
    frame,
    fps,
    ms,
    style,
    scale,
    dur,
    k,
    group: { startMs: gStart, endMs: gEnd, wordCount: caption.words.length },
    sinceGroup: ms - gStart,
    untilGroupEnd: gEnd - ms,
    enter: clamp((ms - gStart) / dur),
    exit: exitMs > 0 ? clamp((ms - (gEnd - exitMs)) / exitMs) : 0,
    spr: makeSpring(frame, fps, dur),
  };

  const lengths = caption.words.map((w) => graphemes(w.text).length);
  const minLen = Math.min(...lengths);
  const maxLen = Math.max(...lengths);
  const startedCount = caption.words.filter((w) => ms >= w.startMs).length;
  const currentIdx = Math.max(0, startedCount - 1);
  const currentStartMs = caption.words[currentIdx]?.startMs ?? gStart;

  const lineOf = new Map<number, { lineIndex: number; indexInLine: number }>();
  layout.lines.forEach((line, li) => line.forEach((wi, pi) => lineOf.set(wi, { lineIndex: li, indexInLine: pi })));

  const wordCtx = (i: number): WordCtx => {
    const w = caption.words[i];
    const where = lineOf.get(i) ?? { lineIndex: 0, indexInLine: i };
    const dWord = Math.max(1, w.endMs - w.startMs);
    return {
      ...base,
      word: w,
      index: i,
      count: caption.words.length,
      sinceWord: ms - w.startMs,
      untilWordEnd: w.endMs - ms,
      wordP: clamp((ms - w.startMs) / dWord),
      state: ms < w.startMs ? "future" : ms < w.endMs ? "active" : "past",
      revealed: ms >= w.startMs,
      lineIndex: where.lineIndex,
      indexInLine: where.indexInLine,
      lineCount: layout.lines.length,
      isCurrent: startedCount > 0 && i === currentIdx,
      startedCount,
      currentStartMs,
      emphasis: maxLen === minLen ? 0.5 : (lengths[i] - minLen) / (maxLen - minLen),
    };
  };

  const groupVisual = behavior.group?.({ ...base, lineCount: layout.lines.length }) ?? {};
  const layoutKind = behavior.layout ?? "flow";
  const fs = layout.fontPx;
  const gap = fs * 0.28;
  const sw = style.strokeWidth * scale * (fs / (style.fontSize * scale));

  const wordBase = (w: string): React.CSSProperties => {
    const complex = isComplexScript(w);
    return {
      display: "inline-block",
      position: "relative",
      whiteSpace: "pre",
      color: style.color,
      fontStyle: style.italic ? "italic" : "normal",
      letterSpacing: complex ? 0 : `${style.letterSpacing}em`,
      WebkitTextStroke: sw > 0 ? `${sw * 2}px ${style.strokeColor}` : undefined,
      paintOrder: "stroke fill",
      textShadow: style.shadow ? `${style.shadow.offsetX * scale}px ${style.shadow.offsetY * scale}px ${style.shadow.blur * scale}px ${style.shadow.color}` : undefined,
      willChange: "transform, opacity",
    };
  };

  const renderWord = (i: number) => {
    const w = caption.words[i];
    const ctx = wordCtx(i);
    const vis: WordVisual = behavior.word?.(ctx) ?? {};
    if (vis.hidden) return null;
    const text = style.uppercase && !isComplexScript(w.text) ? w.text.toLocaleUpperCase() : w.text;
    const parts =
      behavior.unit === "char" && behavior.char
        ? graphemes(text).map((ch, ci, arr) => (
            <span key={ci} style={{ display: "inline-block", whiteSpace: "pre", ...behavior.char!(ctx, ch, ci, arr.length) }}>
              {ch}
            </span>
          ))
        : text;
    const content = vis.inner ? <span style={{ display: "inline-block", ...vis.inner }}>{parts}</span> : parts;
    const wb = wordBase(w.text);
    if (vis.fill) {
      // Clip-to-text fills are transparent, so stroke and shadow live on a duplicate layer underneath.
      const outline: React.CSSProperties = { position: "absolute", left: 0, top: 0, color: style.strokeColor, WebkitTextFillColor: sw > 0 ? style.strokeColor : "transparent", WebkitTextStroke: wb.WebkitTextStroke, paintOrder: wb.paintOrder, textShadow: wb.textShadow, whiteSpace: "pre", pointerEvents: "none" };
      return (
        <span key={w.id} style={{ ...wb, WebkitTextStroke: undefined, textShadow: undefined, ...vis.style }}>
          {vis.decoration}
          {sw > 0 || style.shadow ? <span aria-hidden style={outline}>{text}</span> : null}
          <span style={{ position: "relative", display: "inline-block", WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent", color: "transparent", ...vis.fill }}>{content}</span>
          {vis.suffix}
        </span>
      );
    }
    return (
      <span key={w.id} style={{ ...wb, ...vis.style }}>
        {vis.decoration}
        {content}
        {vis.suffix}
      </span>
    );
  };

  let body: React.ReactNode;
  if (layoutKind === "stack" || layoutKind === "single") {
    body = (
      <div style={{ position: "relative", width: layout.maxWidth, height: fs * style.lineHeight }}>
        {caption.words.map((_, i) => renderWord(i))}
      </div>
    );
  } else {
    body = layout.lines.map((line, li) => (
      <div
        key={li}
        style={{
          display: "flex",
          flexWrap: "nowrap",
          justifyContent: layoutKind === "kinetic" ? (li % 2 === 0 ? "flex-start" : "flex-end") : JUSTIFY[style.align],
          alignItems: "baseline",
          gap,
          width: layoutKind === "kinetic" ? layout.maxWidth : undefined,
        }}
      >
        {line.map((wi) => renderWord(wi))}
      </div>
    ));
  }

  return (
    <>
      {groupVisual.overlay}
      <div
        style={{
          position: "absolute",
          left: `${pos.x * 100}%`,
          top: `${pos.y * 100}%`,
          transform: "translate(-50%, -50%)",
          maxWidth: layout.maxWidth,
          display: "flex",
          justifyContent: "center",
          perspective: behavior.perspective,
        }}
      >
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
    </>
  );
};

export const CaptionLayer: React.FC<{ captions: OutCaption[]; styleState: CaptionStyleState }> = ({ captions, styleState }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame * 1000) / fps;
  const active = useMemo(() => captions, [captions]).find((c) => ms >= c.startMs && ms < c.endMs);
  if (!active) return null;
  return <CaptionGroup key={active.id} caption={active} styleState={styleState} />;
};

export { easeOutCubic, getTemplate };
