import type { TransitionSpec, TransitionType } from "./edit-schema";
/** A TransitionSpec for a window of `frames` frames (used for B-roll in/out where the user only picks a type). */
export function transitionSchemaDefaults(id: string, type: TransitionType, frames: number, fps: number): TransitionSpec {
  return { id, type, joinSrcMs: 0, durationMs: Math.max(120, Math.round((frames * 1000) / fps)), direction: "left", intensity: 0.7, soundId: null };
}
