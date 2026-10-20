/** Pure composition helpers shared by the Remotion composition, the server and the editor UI. */
import { ASPECTS, type Project } from "./project";
import { computeSegments, totalFrames, type OutCaption, type OutZoom } from "./timeline";

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const easeInOutCubic = (t: number) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

export function getCompositionMeta(project: Project) {
  const aspect = ASPECTS[project.aspect];
  const asset = project.sourceAssetId ? project.assets[project.sourceAssetId] : undefined;
  const segments = asset ? computeSegments(project.cuts, asset.durationMs, project.fps) : [];
  const durationInFrames = Math.max(1, totalFrames(segments));
  return { width: aspect.width, height: aspect.height, fps: project.fps, durationInFrames, segments };
}

/** Zoom factor and focus at an output time: highest overlapping zoom wins, eased in and out. */
export function zoomAt(zooms: OutZoom[], ms: number): { scale: number; fx: number; fy: number } {
  let best = { scale: 1, fx: 0.5, fy: 0.5 };
  for (const z of zooms) {
    if (ms < z.startMs || ms > z.endMs) continue;
    const ramp = Math.min(z.rampMs, (z.endMs - z.startMs) / 2);
    const inP = ramp > 0 ? easeInOutCubic(clamp((ms - z.startMs) / ramp)) : 1;
    const outP = ramp > 0 ? easeInOutCubic(clamp((z.endMs - ms) / ramp)) : 1;
    const e = Math.min(inP, outP);
    const s = 1 + (z.scale - 1) * e;
    if (s > best.scale) best = { scale: s, fx: z.focusX, fy: z.focusY };
  }
  return best;
}

/** 0..1 amount of "speech present", used for music ducking. Smoothed with attack/release. */
export function speechActivity(captions: OutCaption[], ms: number): number {
  let v = 0;
  for (const c of captions) {
    const a = 150;
    const r = 350;
    if (ms < c.startMs - a || ms > c.endMs + r) continue;
    const up = clamp((ms - (c.startMs - a)) / a);
    const down = clamp(((c.endMs + r) - ms) / r);
    v = Math.max(v, Math.min(up, down));
  }
  return v;
}

