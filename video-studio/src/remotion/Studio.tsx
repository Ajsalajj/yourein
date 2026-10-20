import React, { useEffect, useMemo, useState } from "react";
import { AbsoluteFill, Audio, continueRender, delayRender, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import type { Project } from "../lib/project";
import { captionsToOutput, frameToMs, zoomsToOutput, type Segment } from "../lib/timeline";
import { getCompositionMeta, zoomAt, speechActivity } from "../lib/composition";
import { resolveSfx, sfxActivity, sfxGain } from "../lib/sfx";
import { BrollLayer } from "./BrollLayer";
import { activeSplit, fullBrollActive, placeBroll, splitLayout } from "../lib/broll";
import { TransitionStage } from "./TransitionStage";
import { placeTransitions } from "../lib/transitions";
import { CameraMotionBlur } from "@remotion/motion-blur";
import { CaptionLayer } from "./CaptionLayer";
import { resolveStyle } from "./templates/registry";
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

/** Registers the user's uploaded fonts (FontFace) and holds the frame until they are decoded - preview and export. */
const ProjectFonts: React.FC<{ fonts: Project["fonts"]; mediaUrls: Record<string, string> }> = ({ fonts, mediaUrls }) => {
  const key = fonts.map((f) => `${f.id}:${f.family}:${f.weight}:${f.style}:${mediaUrls[f.assetId]}`).join("|");
  const [handle] = useState(() => (fonts.length ? delayRender("project fonts", { timeoutInMilliseconds: 30000 }) : null));
  useEffect(() => {
    if (!fonts.length || typeof document === "undefined") {
      if (handle !== null) continueRender(handle);
      return;
    }
    let alive = true;
    Promise.all(
      fonts.map(async (f) => {
        const url = mediaUrls[f.assetId];
        if (!url) return;
        const face = new FontFace(f.family, `url("${url}")`, { weight: String(f.weight), style: f.style });
        await face.load();
        if (alive) document.fonts.add(face);
      }),
    ).catch(() => undefined).finally(() => { if (handle !== null) continueRender(handle); });
    return () => { alive = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
};

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
  const sfxList = useMemo(() => resolveSfx(project, meta.segments), [project, meta.segments]);
  const placed = useMemo(() => placeTransitions(project.transitions, meta.segments, fps), [project.transitions, meta.segments, fps]);
  const srcAsset = project.sourceAssetId ? project.assets[project.sourceAssetId] : undefined;
  const maxSrcFrame = srcAsset ? Math.max(0, Math.floor((srcAsset.durationMs * fps) / 1000) - 1) : 0;
  const placedBroll = useMemo(() => placeBroll(project.broll, meta.segments, fps), [project.broll, meta.segments, fps]);
  const brollDurations = useMemo(() => Object.fromEntries(project.broll.map((b) => [b.assetId, project.assets[b.assetId]?.durationMs ?? 0])), [project.broll, project.assets]);
  const split = activeSplit(placedBroll, frame, fps);
  const baseBox = split ? splitLayout(split.clip.mode, split.p).base : null;
  const fullBroll = fullBrollActive(placedBroll, frame);
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
  const blur = resolveStyle(project.captionStyle, null).style.motionBlur ?? 0;
  const layer = <CaptionLayer captions={outCaptions} styleState={project.captionStyle} wordStyles={project.wordStyles} />;
  // true temporal motion blur: sub-frame samples of the caption layer averaged over a shutter angle (only when enabled)
  const captions = project.captionsVisible ? (blur > 0 ? <CameraMotionBlur shutterAngle={Math.round(60 + blur * 240)} samples={Math.round(6 + blur * 10)}>{layer}</CameraMotionBlur> : layer) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: src ? "#000" : "transparent", overflow: "hidden" }}>
      <ProjectFonts fonts={project.fonts} mediaUrls={mediaUrls} />
      <AbsoluteFill style={{ transform: `scale(${z.scale})`, transformOrigin: `${z.fx * 100}% ${z.fy * 100}%`, ...(baseBox ? { left: `${baseBox.left * 100}%`, top: `${baseBox.top * 100}%`, width: `${baseBox.width * 100}%`, height: `${baseBox.height * 100}%`, overflow: "hidden" } : {}) }}>
        {src ? <VideoSegments project={project} src={src} segments={meta.segments} totalMs={totalMs} /> : null}
        {src ? placed.map((t) => <TransitionStage key={t.spec.id} from={t.startFrame} frames={t.frames} spec={t.spec} a={{ src, startFrame: t.aStartSrcFrame, maxFrame: maxSrcFrame }} b={{ src, startFrame: t.bStartSrcFrame, maxFrame: maxSrcFrame }} />) : null}
      </AbsoluteFill>

      {src ? <BrollLayer placed={placedBroll} mediaUrls={mediaUrls} durations={brollDurations} main={{ src, maxFrame: maxSrcFrame, segments: meta.segments }} /> : null}

      {/* BEHIND the speaker: text first, then the person cut out of the same video on top of it */}
      <TextLayers layers={behindLayers} project={project} segments={meta.segments} />
      {captionsBehind ? captions : null}
      {canCut && !fullBroll && !split && (behindLayers.length > 0 || captionsBehind) ? (
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
            // speech ducking is optional (music.ducking); effects marked "duck music" always duck it
            const duck = 1 - Math.max(music.ducking ? speechActivity(outCaptions, t) : 0, sfxActivity(sfxList, t)) * (1 - music.duckLevel);
            return music.volume * duck * fadeFactor(t, totalMs, project.audio.fadeInMs, project.audio.fadeOutMs);
          }}
        />
      ) : null}

      {sfxList.map((r) => {
        const url = mediaUrls[r.mediaKey];
        if (!url) return null;
        const from = Math.max(0, Math.round((r.outMs * fps) / 1000));
        const frames = Math.max(1, Math.ceil((r.durMs * fps) / 1000));
        return (
          <Sequence key={r.id} from={from} durationInFrames={frames} name={`sfx ${r.id}`}>
            <Audio
              src={url}
              startFrom={Math.round((r.offsetMs * fps) / 1000)}
              volume={(f) => {
                const t = frameToMs(from + f, fps);
                const speech = project.sfxSettings.duckUnderSpeech > 0 ? 1 - speechActivity(outCaptions, t) * project.sfxSettings.duckUnderSpeech : 1;
                return sfxGain(r, frameToMs(f, fps), project.sfxSettings.volume) * speech * fadeFactor(t, totalMs, 0, project.audio.fadeOutMs);
              }}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
