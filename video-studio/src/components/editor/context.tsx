"use client";
import { createContext, useContext, useMemo, type RefObject } from "react";
import type { PlayerRef } from "@remotion/player";
import { useEditor } from "@/store/editor";
import { computeSegments, frameToMs, msToFrame, outputToSource, sourceToOutput } from "@/lib/timeline";
import { getCompositionMeta } from "@/lib/composition";

export const PlayerContext = createContext<RefObject<PlayerRef | null> | null>(null);
export const usePlayerRef = () => {
  const r = useContext(PlayerContext);
  if (!r) throw new Error("PlayerContext missing");
  return r;
};

export function useSourceDuration() {
  return useEditor((s) => (s.project?.sourceAssetId ? s.project.assets[s.project.sourceAssetId]?.durationMs ?? 0 : 0));
}

export function useMeta() {
  const project = useEditor((s) => s.project)!;
  return useMemo(() => getCompositionMeta(project), [project.cuts, project.assets, project.sourceAssetId, project.aspect, project.fps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/** Seeking helpers that translate between source time (what the user authors) and the player's output frames. */
export function useSeek() {
  const ref = usePlayerRef();
  const meta = useMeta();
  return useMemo(
    () => ({
      toSource: (ms: number) => {
        const out = Math.max(0, Math.min(ms, (meta.durationInFrames * 1000) / meta.fps));
        ref.current?.seekTo(msToFrame(out, meta.fps));
      },
      /** ms in the ORIGINAL video; if it is inside removed footage the playhead lands on the next kept frame. */
      fromSource: (ms: number) => {
        const out = sourceToOutput(ms, meta.segments, "start");
        ref.current?.seekTo(Math.min(meta.durationInFrames - 1, msToFrame(out, meta.fps)));
      },
      sourceNow: (frame: number) => outputToSource(frameToMs(frame, meta.fps), meta.segments),
    }),
    [ref, meta],
  );
}

export { computeSegments };
