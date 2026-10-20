/**
 * Camera-aware (scene-anchored) text: a layer pinned to a point of the SOURCE frame follows the virtual camera (smart zoom, face-aware pan/zoom).
 * `parallax` 1 = locked to the scene, 0 = fixed on screen, between = the layer sits at a depth and moves less than the background.
 * This is a 2D projection of a point on the picture plane, not a 3D scene.
 */
import { sourceToCanvas } from "./tracking";
import type { Rect } from "../remotion/TransitionStage";

export interface Geo { srcW: number; srcH: number; outW: number; outH: number }
export interface SceneInput { px: number; py: number; geo: Geo; parallax: number; /** face-aware camera rectangle of the whole source frame (output px) */ rect?: Rect | null; /** smart-zoom scale about a canvas-normalised focus (used when there is no camera rect) */ zoom?: { scale: number; fx: number; fy: number } }
export interface Screen { x: number; y: number; scale: number }

export function sceneToScreen(i: SceneInput): Screen {
  const { geo } = i;
  const neutral = sourceToCanvas(i.px, i.py, geo.srcW, geo.srcH, geo.outW, geo.outH);
  let proj = neutral, scale = 1;
  if (i.rect) {
    const k0 = Math.max(geo.outW / geo.srcW, geo.outH / geo.srcH);
    proj = { x: (i.rect.left + i.px * i.rect.width) / geo.outW, y: (i.rect.top + i.py * i.rect.height) / geo.outH };
    scale = i.rect.width / (geo.srcW * k0);
  } else if (i.zoom && i.zoom.scale !== 1) {
    proj = { x: i.zoom.fx + (neutral.x - i.zoom.fx) * i.zoom.scale, y: i.zoom.fy + (neutral.y - i.zoom.fy) * i.zoom.scale };
    scale = i.zoom.scale;
  }
  const p = Math.min(1, Math.max(0, i.parallax));
  return { x: neutral.x + (proj.x - neutral.x) * p, y: neutral.y + (proj.y - neutral.y) * p, scale: 1 + (scale - 1) * p };
}

/** Inverse of the neutral (no camera) mapping: canvas-normalised point -> SOURCE-normalised point. Used when a layer is switched to scene anchoring. */
export function canvasToSource(x: number, y: number, geo: Geo): { x: number; y: number } {
  const k = Math.max(geo.outW / geo.srcW, geo.outH / geo.srcH);
  return { x: (x * geo.outW + (geo.srcW * k - geo.outW) / 2) / (geo.srcW * k), y: (y * geo.outH + (geo.srcH * k - geo.outH) / 2) / (geo.srcH * k) };
}
