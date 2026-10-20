import type { Track } from "./project";

export interface TrackSample { x: number; y: number; scale: number }

/** Interpolated track sample at a SOURCE timestamp. Clamps before the start and after the end. */
export function trackAt(track: Track, sourceMs: number): TrackSample {
  const f = (sourceMs * track.fps) / 1000 - track.startFrame;
  const pts = track.points;
  if (f <= 0) return { x: pts[0][0], y: pts[0][1], scale: pts[0][2] };
  if (f >= pts.length - 1) { const p = pts[pts.length - 1]; return { x: p[0], y: p[1], scale: p[2] }; }
  const i = Math.floor(f);
  const t = f - i;
  const a = pts[i], b = pts[i + 1];
  return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t, scale: a[2] + (b[2] - a[2]) * t };
}

/**
 * Map a point in normalised SOURCE-frame coordinates to normalised CANVAS coordinates for an `object-fit: cover`
 * video (the composition always covers the canvas).
 */
export function sourceToCanvas(x: number, y: number, srcW: number, srcH: number, canvasW: number, canvasH: number) {
  const k = Math.max(canvasW / srcW, canvasH / srcH);
  return { x: (x * srcW * k - (srcW * k - canvasW) / 2) / canvasW, y: (y * srcH * k - (srcH * k - canvasH) / 2) / canvasH };
}

/** Where a layer anchored at (baseX, baseY) on the first tracked frame sits at `sourceMs` (canvas-normalised). */
export function followTrack(track: Track, sourceMs: number, base: { x: number; y: number }, src: { w: number; h: number }, canvas: { w: number; h: number }) {
  const p = trackAt(track, sourceMs);
  const p0 = track.points[0];
  const a = sourceToCanvas(p.x, p.y, src.w, src.h, canvas.w, canvas.h);
  const a0 = sourceToCanvas(p0[0], p0[1], src.w, src.h, canvas.w, canvas.h);
  return { x: base.x + (a.x - a0.x), y: base.y + (a.y - a0.y), scale: p.scale / p0[2] };
}
