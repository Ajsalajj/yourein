import React, { useMemo } from "react";
import { AbsoluteFill, Audio, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Project } from "../lib/project";
import { captionsToOutput, frameToMs, zoomsToOutput, type Segment } from "../lib/timeline";
import { getCompositionMeta, zoomAt, speechActivity } from "../lib/composition";
import { CaptionLayer } from "./CaptionLayer";
import { clamp } from "./animations/helpers";
import { stack } from "./fontStacks";

export interface StudioProps {
  project: Project;
  /** assetId -> URL the browser/renderer can fetch */
  mediaUrls: Record<string, string>;
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

export const Studio: React.FC<StudioProps> = ({ project, mediaUrls }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const uiScale = Math.min(width, height) / 1080;
  const meta = useMemo(() => getCompositionMeta(project), [project]);
  const outCaptions = useMemo(() => captionsToOutput(project.captions, meta.segments), [project.captions, meta.segments]);
  const outZooms = useMemo(() => zoomsToOutput(project.zooms, meta.segments), [project.zooms, meta.segments]);
  const ms = frameToMs(frame, fps);
  const totalMs = frameToMs(durationInFrames, fps);
  const src = project.sourceAssetId ? mediaUrls[project.sourceAssetId] : undefined;
  const z = zoomAt(outZooms, ms);
  const music = project.audio.music;
  const musicSrc = music ? mediaUrls[music.assetId] : undefined;

  return (
    <AbsoluteFill style={{ backgroundColor: src ? "#000" : "transparent", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `scale(${z.scale})`, transformOrigin: `${z.fx * 100}% ${z.fy * 100}%` }}>
        {src ? <VideoSegments project={project} src={src} segments={meta.segments} totalMs={totalMs} /> : null}
      </AbsoluteFill>

      {project.captionsVisible ? <CaptionLayer captions={outCaptions} styleState={project.captionStyle} /> : null}

      {project.textLayers.map((t) => {
        const from = Math.round((t.startMs * fps) / 1000);
        const dur = Math.max(1, Math.round(((t.endMs - t.startMs) * fps) / 1000));
        return (
          <Sequence key={t.id} from={from} durationInFrames={dur} layout="none">
            <div style={{ position: "absolute", left: `${t.x * 100}%`, top: `${t.y * 100}%`, transform: "translate(-50%,-50%)", fontFamily: t.fontFamily.includes(",") ? t.fontFamily : stack(t.fontFamily), fontWeight: t.fontWeight, fontSize: t.fontSize * uiScale, color: t.color, background: t.backgroundColor, padding: t.backgroundColor === "transparent" ? 0 : "0.15em 0.4em", borderRadius: 12, whiteSpace: "pre-wrap", textAlign: "center", maxWidth: "90%" }}>{t.text}</div>
          </Sequence>
        );
      })}

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
