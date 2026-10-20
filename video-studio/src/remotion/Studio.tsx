import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Project } from "../lib/project";
import { captionsToOutput, frameToMs, zoomsToOutput, type Segment } from "../lib/timeline";
import { getCompositionMeta, zoomAt, speechActivity } from "../lib/composition";
import { CaptionLayer } from "./CaptionLayer";
import { SubjectCutout, TextLayers, type MaskSource } from "./AdvancedLayers";
import { clamp } from "./animations/helpers";
import { stack } from "./fontStacks";

export interface StudioProps {
  project: Project;
  /** assetId -> URL the browser/renderer can fetch */
  mediaUrls: Record<string, string>;
  /** Where the subject mattes are served from (required for "behind the speaker" effects). */
  mask?: MaskSource | null;
  [key: string]: unknown;
}

function fadeFactor(ms: number, totalMs: number, fadeInMs: number, fadeOutMs: number) {
  let f = 1;
  if (fadeInMs > 0) f *= clamp(ms / fadeInMs);
  if (fadeOutMs > 0) f *= clamp((totalMs - ms) / fadeOutMs);
  return f;
}

const VideoSegments: React.FC<{ project: Project; src: string; segments: Segment[]; totalMs: number }> = ({ project, src, segments, totalMs }) => {
  const { fps } = useVideoConfig();
  const a = project.audio;
  return (
    <>
      {segments.map((seg) => (
        <Sequence key={`${seg.srcStartMs}-${seg.outStartFrame}`} from={seg.outStartFrame} durationInFrames={seg.frames} name={`clip ${Math.round(seg.srcStartMs)}ms`}>
          <OffthreadVideo
            src={src}
            startFrom={seg.srcStartFrame}
            volume={(f) => a.originalVolume * fadeFactor(frameToMs(seg.outStartFrame + f, fps), totalMs, a.fadeInMs, a.fadeOutMs)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Sequence>
      ))}
    </>
  );
};

export const Studio: React.FC<StudioProps> = ({ project, mediaUrls, mask }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const meta = useMemo(() => getCompositionMeta(project), [project]);
  const outCaptions = useMemo(() => captionsToOutput(project.captions, meta.segments), [project.captions, meta.segments]);
  const outZooms = useMemo(() => zoomsToOutput(project.zooms, meta.segments), [project.zooms, meta.segments]);
  const ms = frameToMs(frame, fps);
  const totalMs = frameToMs(durationInFrames, fps);
  const src = project.sourceAssetId ? mediaUrls[project.sourceAssetId] : undefined;
  const z = zoomAt(outZooms, ms);
  const music = project.audio.music;
  const musicSrc = music ? mediaUrls[music.assetId] : undefined;

  const behindText = project.textLayers.filter((t) => t.behind);
  const frontText = project.textLayers.filter((t) => !t.behind);
  const seg = project.analysis.segmentation;
  // Behind-the-speaker needs a real matte; without one nothing is drawn "behind" (layers fall back to the front).
  const canCut = !!(src && mask && seg && seg.sourceAssetId === project.sourceAssetId);
  const captionsBehind = canCut && project.captionsBehindSubject;
  const behindLayers = canCut ? behindText : [];
  const frontLayers = canCut ? frontText : project.textLayers;
  const captions = project.captionsVisible ? <CaptionLayer captions={outCaptions} styleState={project.captionStyle} /> : null;

  return (
    <AbsoluteFill style={{ backgroundColor: src ? "#000" : "transparent", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${z.scale})`, transformOrigin: `${z.fx * 100}% ${z.fy * 100}%` }}>
        {src ? <VideoSegments project={project} src={src} segments={meta.segments} totalMs={totalMs} /> : null}
      </AbsoluteFill>

      {/* BEHIND the speaker: text first, then the person cut out of the same video on top of it */}
      <TextLayers layers={behindLayers} project={project} segments={meta.segments} />
      {captionsBehind ? captions : null}
      {canCut && (behindLayers.length > 0 || captionsBehind) ? (
        <AbsoluteFill style={{ transform: `scale(${z.scale})`, transformOrigin: `${z.fx * 100}% ${z.fy * 100}%` }}>
          <SubjectCutout src={src!} segments={meta.segments} mask={mask!} />
        </AbsoluteFill>
      ) : null}

      {captionsBehind ? null : captions}
      <TextLayers layers={frontLayers} project={project} segments={meta.segments} />

      {music && musicSrc ? (
        <Audio
          src={musicSrc}
          loop={music.loop}
          volume={(f) => {
            const t = frameToMs(f, fps);
            const duck = music.ducking ? 1 - speechActivity(outCaptions, t) * (1 - music.duckLevel) : 1;
            return music.volume * duck * fadeFactor(t, totalMs, project.audio.fadeInMs, project.audio.fadeOutMs);
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
