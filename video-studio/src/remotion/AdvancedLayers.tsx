import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Project, TextLayer } from "../lib/project";
import { followTrack } from "../lib/tracking";
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
    img.onload = img.onerror = () => {
      if (alive) setShown(url);
      continueRender(handle);
    };
    img.src = url;
    return () => { alive = false; };
  }, [url, handle]);
  return shown;
}

const CutoutFrame: React.FC<{ src: string; seg: Segment; mask: MaskSource }> = ({ src, seg, mask }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const srcFrame = seg.srcStartFrame + frame;
  const idx = Math.max(0, Math.min(mask.frames - 1, Math.round((srcFrame / fps) * mask.fps)));
  const url = `${mask.base}/${idx}${mask.query ?? ""}`;
  const shown = useMatte(url);
  const css = `url("${shown}")`;
  return (
    <OffthreadVideo
      src={src}
      startFrom={seg.srcStartFrame}
      volume={0}
      transparent
      style={{ width: "100%", height: "100%", objectFit: "cover", WebkitMaskImage: css, maskImage: css, WebkitMaskSize: "cover", maskSize: "cover", WebkitMaskPosition: "center", maskPosition: "center", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }}
    />
  );
};

/** The video again, but only the person (alpha matte from real segmentation), drawn ABOVE any "behind" text. */
export const SubjectCutout: React.FC<{ src: string; segments: Segment[]; mask: MaskSource }> = ({ src, segments, mask }) => (
  <>
    {segments.map((seg) => (
      <Sequence key={`cut-${seg.outStartFrame}`} from={seg.outStartFrame} durationInFrames={seg.frames} name="subject cutout">
        <CutoutFrame src={src} seg={seg} mask={mask} />
      </Sequence>
    ))}
  </>
);

const ANIM_EXIT_MS = 280;

const TextLayerView: React.FC<{ layer: TextLayer; project: Project; segments: Segment[]; layerFromFrame: number }> = ({ layer, project, segments, layerFromFrame }) => {
  const local = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = local + layerFromFrame;
  const outMs = frameToMs(frame, fps);
  const scale = Math.min(width, height) / 1080;
  const family = layer.fontFamily.includes(",") ? layer.fontFamily : stack(layer.fontFamily);
  const text = applyTransform(layer.text, { textTransform: layer.textTransform, uppercase: false });
  useFontsReady(primaryFamily(family), layer.fontWeight, text);

  // position, optionally following a motion track (tracks live in SOURCE time)
  let x = layer.x, y = layer.y, ts = 1;
  const track = layer.trackId ? project.analysis.tracks[layer.trackId] : undefined;
  const srcAsset = project.sourceAssetId ? project.assets[project.sourceAssetId] : undefined;
  if (track && srcAsset?.width && srcAsset.height) {
    const f = followTrack(track, outputToSource(outMs, segments), { x: layer.x, y: layer.y }, { w: srcAsset.width, h: srcAsset.height }, { w: width, h: height });
    x = f.x; y = f.y; ts = layer.trackScale ? f.scale : 1;
  }

  const since = outMs - layer.startMs;
  const until = layer.endMs - outMs;
  const exit = clamp(1 - until / ANIM_EXIT_MS);
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
  const tf = `translate(-50%, -50%)${persp ? ` perspective(${persp.depth}px) rotateX(${persp.rotateX}deg) rotateY(${persp.rotateY}deg) rotateZ(${persp.rotateZ}deg)` : ""} scale(${ts})${tx}`;
  const sw = layer.strokeWidth * scale;
  return (
    <div
      style={{
        position: "absolute", left: `${x * 100}%`, top: `${y * 100}%`, transform: tf, transformOrigin: "50% 50%",
        fontFamily: family, fontWeight: layer.fontWeight, fontSize: layer.fontSize * scale, color: layer.color, fontStyle: layer.italic ? "italic" : "normal", letterSpacing,
        background: layer.backgroundColor, padding: layer.backgroundColor === "transparent" ? 0 : "0.15em 0.4em", borderRadius: 12 * scale, whiteSpace: "pre-wrap", textAlign: "center", maxWidth: "94%", lineHeight: 1.05,
        opacity, clipPath: clip, WebkitTextStroke: sw > 0 ? `${sw * 2}px ${layer.strokeColor}` : undefined, paintOrder: "stroke fill",
      }}
    >
      {text}
    </div>
  );
};

export const TextLayers: React.FC<{ layers: TextLayer[]; project: Project; segments: Segment[] }> = ({ layers, project, segments }) => {
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
          <TextLayerView layer={l} project={project} segments={segments} layerFromFrame={from} />
        </Sequence>
      ))}
    </>
  );
};
