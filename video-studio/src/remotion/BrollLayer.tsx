import React from "react";
import { AbsoluteFill, Freeze, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { panelProgress, splitLayout, type PlacedBroll } from "../lib/broll";
import type { Segment } from "../lib/timeline";
import { TransitionStage } from "./TransitionStage";
import { transitionSchemaDefaults } from "../lib/transitions-defaults";

/** B-roll is always muted: the speaker's audio keeps playing from the edit underneath. */
const Clip: React.FC<{ src: string; clipInFrames: number; maxFrames: number; fit: "cover" | "contain"; style?: React.CSSProperties }> = ({ src, clipInFrames, maxFrames, fit, style }) => {
  const k = useCurrentFrame();
  const raw = clipInFrames + k;
  const last = Math.max(0, maxFrames - 1);
  // the slot may outlast the clip by a few frames (rounding): hold the last frame instead of erroring
  const video = <OffthreadVideo src={src} startFrom={clipInFrames} muted style={{ width: "100%", height: "100%", objectFit: fit, ...style }} />;
  return raw > last ? <Freeze frame={last - clipInFrames}>{video}</Freeze> : video;
};

const View: React.FC<{ b: PlacedBroll; src: string; durationMs: number }> = ({ b, src, durationMs }) => {
  const k = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const c = b.clip;
  const clipInFrames = Math.round((c.clipInMs * fps) / 1000);
  const maxFrames = Math.floor((durationMs * fps) / 1000);
  const clip = <Clip src={src} clipInFrames={clipInFrames} maxFrames={maxFrames} fit={c.fit} />;
  if (c.mode === "full") return <AbsoluteFill style={{ backgroundColor: "#000" }}>{clip}</AbsoluteFill>;
  if (c.mode === "overlay") return <AbsoluteFill style={{ opacity: c.opacity * Math.min(1, panelProgress(k, b.frames, c.transitionMs, fps) * 1.0) }}>{clip}</AbsoluteFill>;
  const p = panelProgress(k, b.frames, c.transitionMs, fps);
  const L = splitLayout(c.mode, p);
  const pip = c.mode === "pip";
  return (
    <div style={{ position: "absolute", left: `${L.broll.left * 100}%`, top: `${L.broll.top * 100}%`, width: `${L.broll.width * 100}%`, height: `${L.broll.height * 100}%`, overflow: "hidden", transform: `translate(${L.slide.x * 100}%, ${L.slide.y * 100}%)`, borderRadius: pip ? Math.round(width * 0.025) : 0, boxShadow: pip ? "0 12px 40px rgba(0,0,0,0.55)" : undefined, border: pip ? `${Math.max(2, Math.round(width * 0.004))}px solid #fff` : undefined, backgroundColor: "#000" }}>
      {clip}
    </div>
  );
};

export interface MainRef { src: string; maxFrame: number; segments: Segment[] }

/** Output frame -> source frame of the main clip (linear continuation of the segment that contains f, or of the nearest one). */
function mainSrcFrame(f: number, segs: Segment[]): number {
  const seg = segs.find((s) => f >= s.outStartFrame && f < s.outStartFrame + s.frames) ?? (f < (segs[0]?.outStartFrame ?? 0) ? segs[0] : segs[segs.length - 1]);
  return seg ? seg.srcStartFrame + (f - seg.outStartFrame) : 0;
}

/** All B-roll clips as Sequences (+ optional in/out cinematic transitions against the speaker footage). */
export const BrollLayer: React.FC<{ placed: PlacedBroll[]; mediaUrls: Record<string, string>; durations: Record<string, number>; main: MainRef }> = ({ placed, mediaUrls, durations, main }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {placed.map((b) => {
        const src = mediaUrls[b.clip.assetId];
        if (!src) return null;
        const dur = durations[b.clip.assetId] ?? 0;
        const tf = Math.max(2, Math.min(Math.round((b.clip.transitionMs * fps) / 1000), Math.floor(b.frames / 2)));
        const half = tf % 2 ? tf - 1 : tf;
        const clipIn = Math.round((b.clip.clipInMs * fps) / 1000);
        const full = b.clip.mode === "full";
        const brollMax = Math.max(0, Math.floor((dur * fps) / 1000) - 1);
        return (
          <React.Fragment key={b.clip.id}>
            <Sequence from={b.from} durationInFrames={b.frames} name={`broll ${b.clip.id}`}>
              <View b={b} src={src} durationMs={dur} />
            </Sequence>
            {full && b.clip.transitionIn ? (
              <TransitionStage from={b.from} frames={half} spec={transitionSchemaDefaults(b.clip.id + ":in", b.clip.transitionIn, half, fps)} a={{ src: main.src, startFrame: mainSrcFrame(b.from, main.segments), maxFrame: main.maxFrame }} b={{ src, startFrame: clipIn, maxFrame: brollMax }} />
            ) : null}
            {full && b.clip.transitionOut ? (
              <TransitionStage from={b.from + b.frames - half} frames={half} spec={transitionSchemaDefaults(b.clip.id + ":out", b.clip.transitionOut, half, fps)} a={{ src, startFrame: clipIn + (b.frames - half), maxFrame: brollMax }} b={{ src: main.src, startFrame: mainSrcFrame(b.from + b.frames - half, main.segments), maxFrame: main.maxFrame }} />
            ) : null}
          </React.Fragment>
        );
      })}
    </>
  );
};
