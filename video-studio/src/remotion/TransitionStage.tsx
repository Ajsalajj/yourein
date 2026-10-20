import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { OnVideoFrame } from "remotion";
import { layerCss, transitionFx, windowProgress, type LayerFx } from "../lib/transitions";
import type { TransitionSpec } from "../lib/edit-schema";

export interface ClipRef {
  src: string;
  /** source frame (composition fps) shown at the first frame of the window; negative = before the clip starts (held on frame 0) */
  startFrame: number;
  /** last valid source frame (clamps the continuation of an outgoing clip past its end) */
  maxFrame?: number;
}

type Drawable = CanvasImageSource & { videoWidth?: number; naturalWidth?: number; videoHeight?: number; naturalHeight?: number; width?: number; height?: number };
const dims = (d: Drawable) => ({ w: d.videoWidth || d.naturalWidth || (d.width as number) || 1, h: d.videoHeight || d.naturalHeight || (d.height as number) || 1 });

/**
 * Radial zoom blur by accumulation: the real frame is drawn N times at scales 1..1+extent about the centre with alpha 1/(i+1),
 * which is a uniform average along every radius (a physically-motivated zoom blur, not a CSS filter).
 */
export function drawZoomBlur(ctx: CanvasRenderingContext2D, img: Drawable, cw: number, ch: number, strength: number, samples = 16) {
  const { w, h } = dims(img);
  const k = Math.max(cw / w, ch / h); // object-fit: cover
  const dw = w * k, dh = h * k;
  ctx.clearRect(0, 0, cw, ch);
  const extent = 0.02 + 0.32 * strength;
  for (let i = 0; i < samples; i++) {
    const s = 1 + extent * (i / (samples - 1));
    ctx.globalAlpha = 1 / (i + 1);
    ctx.drawImage(img, (cw - dw * s) / 2, (ch - dh * s) / 2, dw * s, dh * s);
  }
  ctx.globalAlpha = 1;
}

const BlurFilter: React.FC<{ id: string; fx: LayerFx; w: number }> = ({ id, fx, w }) => (
  <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
    <filter id={id} x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
      {/* stdDeviation is ~1/2.5 of the streak length */}
      <feGaussianBlur stdDeviation={`${((fx.blurX * w) / 2.5).toFixed(2)} ${((fx.blurY * w) / 2.5).toFixed(2)}`} />
    </filter>
  </svg>
);

/**
 * One real clip inside a transition window. `OffthreadVideo.startFrom` is a STATIC offset (video time = startFrom + local frame), so the
 * linear source mapping is expressed through it once; frames before the clip begins / after it ends are held (Freeze) instead of erroring.
 */
const ClipVideo: React.FC<{ clip: ClipRef; k: number; style?: React.CSSProperties; onVideoFrame?: OnVideoFrame }> = ({ clip, k, style, onVideoFrame }) => {
  const start = Math.max(0, clip.startFrame);
  const raw = clip.startFrame + k;
  const max = clip.maxFrame ?? Infinity;
  const f = Math.max(0, Math.min(max, raw));
  const video = <OffthreadVideo src={clip.src} startFrom={start} muted style={style} onVideoFrame={onVideoFrame} />;
  return raw < 0 || raw > max ? <Freeze frame={f - start}>{video}</Freeze> : video;
};

const RadialLayer: React.FC<{ clip: ClipRef; fx: LayerFx; frame: number; frames: number }> = ({ clip, fx, frame }) => {
  const { width, height } = useVideoConfig();
  const canvas = useRef<HTMLCanvasElement>(null);
  const img = useRef<Drawable | null>(null);
  const fxRef = useRef(fx);
  fxRef.current = fx;
  const draw = () => {
    const c = canvas.current, i = img.current;
    if (!c || !i) return;
    const ctx = c.getContext("2d");
    if (ctx) drawZoomBlur(ctx, i, width, height, fxRef.current.zoomBlur);
  };
  useLayoutEffect(draw); // re-draw on every React render (preview paused/scrubbing)
  return (
    <>
      <ClipVideo clip={clip} k={frame} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0 }} onVideoFrame={(f) => { img.current = f as Drawable; draw(); }} />
      <canvas ref={canvas} width={width} height={height} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
    </>
  );
};

const Layer: React.FC<{ id: string; clip: ClipRef; fx: LayerFx; radial: boolean; frame: number; frames: number }> = ({ id, clip, fx, radial, frame, frames }) => {
  const { width, height } = useVideoConfig();
  const css = layerCss(fx, width, height, id);
  return (
    <AbsoluteFill style={css}>
      {fx.blurX > 0.0005 || fx.blurY > 0.0005 ? <BlurFilter id={id} fx={fx} w={Math.max(width, height) * 0.5 * 2} /> : null}
      {radial ? <RadialLayer clip={clip} fx={fx} frame={frame} frames={frames} /> : <ClipVideo clip={clip} k={frame} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
    </AbsoluteFill>
  );
};

const Stage: React.FC<{ a: ClipRef; b: ClipRef; spec: TransitionSpec; frames: number }> = ({ a, b, spec, frames }) => {
  const k = useCurrentFrame();
  const p = windowProgress(k, frames);
  const fx = transitionFx(spec.type, p, spec.direction, spec.intensity);
  const radial = spec.type === "radial-zoom-blur";
  const uid = `${spec.id}-${k}`.replace(/[^a-zA-Z0-9_-]/g, "");
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Layer id={`ta-${uid}`} clip={a} fx={fx.a} radial={radial} frame={k} frames={frames} />
      <Layer id={`tb-${uid}`} clip={b} fx={fx.b} radial={radial} frame={k} frames={frames} />
      {fx.flash > 0.001 ? <AbsoluteFill style={{ backgroundColor: "#fff", opacity: fx.flash }} /> : null}
    </AbsoluteFill>
  );
};

/** Two real clips composited through a transition over [from, from+frames). Audio is NOT played here: the speaker's audio keeps coming from the edit underneath. */
export const TransitionStage: React.FC<{ from: number; frames: number; a: ClipRef; b: ClipRef; spec: TransitionSpec }> = ({ from, frames, a, b, spec }) => (
  <Sequence from={from} durationInFrames={frames} name={`transition ${spec.type}`} layout="none">
    <AbsoluteFill>
      <Stage a={a} b={b} spec={spec} frames={frames} />
    </AbsoluteFill>
  </Sequence>
);
