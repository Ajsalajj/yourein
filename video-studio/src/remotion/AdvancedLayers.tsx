import React, { useEffect, useMemo, useState } from "react";
import { measureText } from "@remotion/layout-utils";
import { continueRender, delayRender, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Project, TextLayer } from "../lib/project";
import { followTrack } from "../lib/tracking";
import { layoutOnCircle } from "../lib/glyphpath";
import { buildShards, shardClip, shardPose } from "../lib/shatter";
import { sceneToScreen } from "../lib/spatial";
import { graphemes } from "../lib/captions/text";
import { frameToMs, outputToSource, type Segment } from "../lib/timeline";
import { applyTransform } from "./textTransform";
import { primaryFamily, stack } from "./fontStacks";
import { useFontsReady } from "./CaptionLayer";
import { clamp, easeInOutCubic, easeOutCubic, makeSpring, mix } from "./animations/helpers";

export interface MaskSource {
  /** URL prefix; the frame index is appended: `${base}/${n}${query}` */
  base: string;
  query?: string;
  fps: number;
  frames: number;
}

/**
 * Loads the matte for `url` before it is used. While rendering, delayRender holds the frame until the image
 * is decoded; in the preview the previous matte stays on screen until the next one has loaded (no flicker).
 */
function useMatte(url: string): string {
  const [shown, setShown] = useState<string>(url);
  const [handle] = useState(() => delayRender(`matte ${url}`, { timeoutInMilliseconds: 30000 }));
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous"; // same CORS mode as the CSS mask fetch, so the decoded image is reused
    img.onload = img.onerror = () => {
      if (alive) setShown(url);
      continueRender(handle);
    };
    img.src = url;
    return () => { alive = false; };
  }, [url, handle]);
  return shown;
}

const CutoutFrame: React.FC<{ src: string; seg: Segment; mask: MaskSource; rectAt?: (outFrame: number) => { left: number; top: number; width: number; height: number } }> = ({ src, seg, mask, rectAt }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const srcFrame = seg.srcStartFrame + frame;
  const idx = Math.max(0, Math.min(mask.frames - 1, Math.round((srcFrame / fps) * mask.fps)));
  const url = `${mask.base}/${idx}${mask.query ?? ""}`;
  const shown = useMatte(url);
  const css = `url("${shown}")`;
  // face-aware camera: the video and its matte are placed with the same rectangle, so the cut-out stays registered to the person
  const r = rectAt?.(seg.outStartFrame + frame);
  const geo: React.CSSProperties = r
    ? { position: "absolute", left: r.left, top: r.top, width: r.width, height: r.height, objectFit: "fill", maxWidth: "none", WebkitMaskSize: `${r.width}px ${r.height}px`, maskSize: `${r.width}px ${r.height}px`, WebkitMaskPosition: "0 0", maskPosition: "0 0" }
    : { width: "100%", height: "100%", objectFit: "cover", WebkitMaskSize: "cover", maskSize: "cover", WebkitMaskPosition: "center", maskPosition: "center" };
  return (
    <OffthreadVideo
      src={src}
      startFrom={seg.srcStartFrame}
      volume={0}
      transparent
      style={{ WebkitMaskImage: css, maskImage: css, WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", ...geo }}
    />
  );
};

/** The video again, but only the person (alpha matte from real segmentation), drawn ABOVE any "behind" text. */
export const SubjectCutout: React.FC<{ src: string; segments: Segment[]; mask: MaskSource; rectAt?: (outFrame: number) => { left: number; top: number; width: number; height: number } }> = ({ src, segments, mask, rectAt }) => (
  <>
    {segments.map((seg) => (
      <Sequence key={`cut-${seg.outStartFrame}`} from={seg.outStartFrame} durationInFrames={seg.frames} name="subject cutout">
        <CutoutFrame src={src} seg={seg} mask={mask} rectAt={rectAt} />
      </Sequence>
    ))}
  </>
);

const ANIM_EXIT_MS = 280;

export interface SceneCtx { rectAt?: (outFrame: number) => { left: number; top: number; width: number; height: number }; zoomAt?: (outFrame: number) => { scale: number; fx: number; fy: number } }

const TextLayerView: React.FC<{ layer: TextLayer; project: Project; segments: Segment[]; layerFromFrame: number; scene?: SceneCtx }> = ({ layer, project, segments, layerFromFrame, scene }) => {
  const local = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = local + layerFromFrame;
  const outMs = frameToMs(frame, fps);
  const scale = Math.min(width, height) / 1080;
  const family = layer.fontFamily.includes(",") ? layer.fontFamily : stack(layer.fontFamily);
  const text = applyTransform(layer.text, { textTransform: layer.textTransform, uppercase: false });
  const fontsReady = useFontsReady(primaryFamily(family), layer.fontWeight, text);
  // Fit to width: never let a title run off the frame. Measured with the real font once it has loaded.
  let fit = 1;
  if (fontsReady && typeof document !== "undefined") {
    try {
      const px = layer.fontSize * scale;
      const widest = Math.max(...text.split("\n").map((line) => measureText({ text: line, fontFamily: family, fontSize: px, fontWeight: String(layer.fontWeight), letterSpacing: `${layer.letterSpacing}em`, fontStyle: layer.italic ? "italic" : "normal" } as never).width));
      const pad = layer.backgroundColor === "transparent" ? 0 : px * 0.8;
      if (widest > 0) fit = Math.min(1, (width * 0.92) / (widest + pad));
    } catch {
      /* measurement is best-effort */
    }
  }

  // position, optionally following a motion track (tracks live in SOURCE time)
  let x = layer.x, y = layer.y, ts = 1;
  const track = layer.trackId ? project.analysis.tracks[layer.trackId] : undefined;
  const srcAsset = project.sourceAssetId ? project.assets[project.sourceAssetId] : undefined;
  if (track && srcAsset?.width && srcAsset.height) {
    const f = followTrack(track, outputToSource(outMs, segments), { x: layer.x, y: layer.y }, { w: srcAsset.width, h: srcAsset.height }, { w: width, h: height });
    x = f.x; y = f.y; ts = layer.trackScale ? f.scale : 1;
  }

  // scene-anchored: x/y are a point of the SOURCE picture; follow smart zoom / the face-aware camera
  if (layer.anchor === "scene" && srcAsset?.width && srcAsset.height) {
    const sc = sceneToScreen({ px: layer.x, py: layer.y, geo: { srcW: srcAsset.width, srcH: srcAsset.height, outW: width, outH: height }, parallax: layer.parallax, rect: scene?.rectAt?.(frame) ?? null, zoom: scene?.zoomAt?.(frame) });
    x = sc.x; y = sc.y; ts *= sc.scale;
  }

  const since = outMs - layer.startMs;
  const until = layer.endMs - outMs;
  // shatter: break progress (0 = intact, 1 = gone). "in" assembles from pieces, "out" breaks apart at the end.
  const sh = layer.shatter;
  let breakP = 0;
  if (sh) {
    const inP = sh.mode === "out" ? 0 : 1 - clamp(since / sh.durationMs);
    const outP = sh.mode === "in" ? 0 : clamp(1 - until / sh.durationMs);
    breakP = Math.max(inP, outP);
  }
  const exit = sh && sh.mode !== "in" ? 0 : clamp(1 - until / ANIM_EXIT_MS);
  const p = easeOutCubic(since / layer.animMs);
  const spr = makeSpring(frame, fps, layer.animMs)(since);
  let opacity = 1 - easeInOutCubic(exit);
  let tx = "";
  let letterSpacing = `${layer.letterSpacing}em`;
  let clip: string | undefined;
  switch (layer.animation) {
    case "fade-up": opacity *= p; tx = ` translateY(${(1 - p) * 60 * scale}px)`; break;
    case "tracking-in": opacity *= p; letterSpacing = `${mix(0.45, layer.letterSpacing, p)}em`; break;
    case "scale-in": opacity *= Math.min(1, spr * 2); tx = ` scale(${mix(0.6, 1, Math.min(spr, 1.1))})`; break;
    case "mask-reveal": clip = `inset(0 0 ${(1 - p) * 100}% 0)`; break;
    default: break;
  }
  const persp = layer.perspective;
  const sw = layer.strokeWidth * scale;
  const fontPx = layer.fontSize * scale * fit;
  const textStyle: React.CSSProperties = {
    fontFamily: family, fontWeight: layer.fontWeight, fontSize: fontPx, color: layer.color, fontStyle: layer.italic ? "italic" : "normal", letterSpacing,
    background: layer.backgroundColor, padding: layer.backgroundColor === "transparent" ? 0 : "0.15em 0.4em", borderRadius: 12 * scale, whiteSpace: "pre", textAlign: "center", lineHeight: 1.05,
    WebkitTextStroke: sw > 0 ? `${sw * 2}px ${layer.strokeColor}` : undefined, paintOrder: "stroke fill",
  };
  const anchor: React.CSSProperties = { position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transformOrigin: "50% 50%" };
  const persp3d = persp ? ` perspective(${persp.depth}px) rotateX(${persp.rotateX}deg) rotateY(${persp.rotateY}deg) rotateZ(${persp.rotateZ}deg)` : "";

  // ── text on a circle: glyphs placed by measured advance, rotated to the tangent ──
  if (layer.path) {
    const glyphs = graphemes(text.replace(/\n/g, " "));
    const R = layer.path.radius * Math.min(width, height);
    let widths = glyphs.map((g) => fontPx * 0.56 * (g === " " ? 0.6 : 1));
    if (fontsReady && typeof document !== "undefined") {
      try { widths = glyphs.map((g) => measureText({ text: g === " " ? "\u00a0" : g, fontFamily: family, fontSize: fontPx, fontWeight: String(layer.fontWeight), letterSpacing, fontStyle: layer.italic ? "italic" : "normal" } as never).width); } catch { /* keep estimates */ }
    }
    const placed = layoutOnCircle(widths, { radius: R, startDeg: layer.path.startDeg, sweepDeg: layer.path.sweepDeg, direction: layer.path.direction, inside: layer.path.inside });
    const spin = layer.path.spinDegPerSec * (outMs / 1000);
    return (
      <div style={{ ...anchor, transform: `translate(-50%, -50%)${persp3d} scale(${ts})${tx}`, width: 0, height: 0, opacity }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, transform: `rotate(${spin}deg)` }}>
          {glyphs.map((g, i) => (
            <span key={i} style={{ ...textStyle, background: "transparent", padding: 0, position: "absolute", left: placed[i].x, top: placed[i].y, transform: `translate(-50%, -50%) rotate(${placed[i].rotateDeg}deg)`, letterSpacing: 0 }}>{g}</span>
          ))}
        </div>
      </div>
    );
  }

  // ── shatter: the same text drawn once per triangular shard, each clipped to its polygon and flying on its own path ──
  if (sh && breakP > 0) {
    const lines = text.split("\n");
    let bw = fontPx * 0.56 * Math.max(...lines.map((l) => graphemes(l).length)), bh = fontPx * 1.05 * lines.length;
    if (fontsReady && typeof document !== "undefined") {
      try { bw = Math.max(...lines.map((l) => measureText({ text: l, fontFamily: family, fontSize: fontPx, fontWeight: String(layer.fontWeight), letterSpacing, fontStyle: layer.italic ? "italic" : "normal" } as never).width)); } catch { /* keep estimate */ }
    }
    const padX = layer.backgroundColor === "transparent" ? 0 : fontPx * 0.8, padY = layer.backgroundColor === "transparent" ? 0 : fontPx * 0.3;
    const box = { w: Math.ceil(bw + padX + fontPx * 0.3), h: Math.ceil(bh + padY + fontPx * 0.3) };
    const [cols, rows] = sh.detail === "low" ? [6, 2] : sh.detail === "high" ? [16, 4] : [10, 3];
    const shards = buildShards(box.w, box.h, cols, rows, sh.seed);
    const prm = { spread: sh.spread, impact: { x: 0.5, y: 0.5 }, seed: sh.seed };
    return (
      <div style={{ ...anchor, transform: `translate(-50%, -50%)${persp3d} scale(${ts})${tx}`, width: box.w, height: box.h, opacity }}>
        {shards.map((s) => {
          const pose = shardPose(s, breakP, box, prm);
          return (
            <div key={s.id} style={{ position: "absolute", left: 0, top: 0, width: box.w, height: box.h, clipPath: shardClip(s), transformOrigin: `${s.cx}px ${s.cy}px`, transform: `translate(${pose.tx}px, ${pose.ty}px) rotate(${pose.rotate}deg) scale(${pose.scale})`, opacity: pose.opacity, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ ...textStyle, letterSpacing }}>{text}</div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ ...anchor, transform: `translate(-50%, -50%)${persp3d} scale(${ts})${tx}`, ...textStyle, opacity, clipPath: clip }}>
      {text}
    </div>
  );
};

export const TextLayers: React.FC<{ layers: TextLayer[]; project: Project; segments: Segment[]; scene?: SceneCtx }> = ({ layers, project, segments, scene }) => {
  const { fps, durationInFrames } = useVideoConfig();
  const items = useMemo(() => layers.map((l) => {
    const from = Math.max(0, Math.round((l.startMs * fps) / 1000));
    const dur = Math.max(1, Math.min(durationInFrames - from, Math.round(((l.endMs - l.startMs) * fps) / 1000)));
    return { l, from, dur };
  }), [layers, fps, durationInFrames]);
  return (
    <>
      {items.map(({ l, from, dur }) => (
        <Sequence key={l.id} from={from} durationInFrames={Math.max(1, dur)} layout="none" name={`text ${l.text.slice(0, 16)}`}>
          <TextLayerView layer={l} project={project} segments={segments} layerFromFrame={from} scene={scene} />
        </Sequence>
      ))}
    </>
  );
};
