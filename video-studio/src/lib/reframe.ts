/**
 * Face-aware virtual camera.
 * Input: sampled primary-face boxes (with gaps), output/source geometry, user settings. Output: a deterministic camera path
 * (centre in source-normalised coordinates + zoom relative to the plain "cover" crop) that keeps the face framed without jumps.
 *
 *   1. clean:   reject single-sample outliers, bridge short gaps by interpolation, hold briefly on longer gaps, then drift back to the centre fallback
 *   2. target:  where the crop window should be (face centred horizontally, eyes at ~42 % of the window height, size from `tightness`)
 *   3. smooth:  dead-zone (the operator does not chase every wobble) + critically damped spring + speed limit, simulated at 60 Hz
 *   4. override: manual keyframe ranges blend over the automatic path
 * With no face data (or mode "off") the path is the old centre crop, i.e. the fallback.
 */
import type { Faces } from "./project";
import type { ReframeSettings } from "./edit-schema";

export interface Cam { cx: number; cy: number; /** zoom relative to the plain cover crop, >= 1 */ z: number }
export interface Geometry { srcW: number; srcH: number; outW: number; outH: number }
export interface Det { t: number; cx: number; cy: number; w: number; h: number; score: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (x: number) => x * x * (3 - 2 * x);

/** Crop window (source-normalised) of the plain cover fit: one side is 1, the other < 1. */
export function coverWindow(g: Geometry): { w: number; h: number } {
  const k = Math.max(g.outW / g.srcW, g.outH / g.srcH);
  return { w: Math.min(1, g.outW / (k * g.srcW)), h: Math.min(1, g.outH / (k * g.srcH)) };
}

export function detectionsOf(f: Faces | null): Det[] {
  if (!f) return [];
  const out: Det[] = [];
  for (const s of f.samples) if (s.length === 6) out.push({ t: s[0], cx: s[1] + s[3] / 2, cy: s[2] + s[4] / 2, w: s[3], h: s[4], score: s[5] });
  return out;
}

/** Drop samples that jump away from both neighbours (single-frame false detections / a second person flashing past). */
export function rejectOutliers(d: Det[], maxJump = 0.18): Det[] {
  return d.filter((s, i) => {
    const a = d[i - 1], b = d[i + 1];
    if (!a || !b) return true;
    const da = Math.hypot(s.cx - a.cx, s.cy - a.cy), db = Math.hypot(s.cx - b.cx, s.cy - b.cy), ab = Math.hypot(a.cx - b.cx, a.cy - b.cy);
    return !(da > maxJump && db > maxJump && ab < maxJump * 0.6);
  });
}

export interface Target { cx: number; cy: number; h: number; /** 0..1 how much we trust "a face is here" */ conf: number; /** face velocity in normalised units per ms (for look-ahead) */ vx?: number; vy?: number }
export interface CleanOptions { bridgeMs?: number; holdMs?: number; fadeMs?: number }

/** Face centre/size at time t from the cleaned detections: interpolate across short gaps, hold on longer ones, fade confidence to 0 afterwards. */
export function faceAt(d: Det[], t: number, o: CleanOptions = {}): Target | null {
  const bridge = o.bridgeMs ?? 900, hold = o.holdMs ?? 1200, fade = o.fadeMs ?? 900;
  if (!d.length) return null;
  let lo = -1;
  for (let i = 0; i < d.length; i++) { if (d[i].t <= t) lo = i; else break; }
  const prev = lo >= 0 ? d[lo] : null, next = d[lo + 1] ?? null;
  // velocity from detections ~0.4 s apart (robust against the 10 Hz detector jitter)
  const vel = (i: number) => {
    const a = d[Math.max(0, i - 2)], b = d[Math.min(d.length - 1, i + 2)];
    const dt = b.t - a.t;
    return dt > 0 && dt <= 900 ? { vx: (b.cx - a.cx) / dt, vy: (b.cy - a.cy) / dt } : { vx: 0, vy: 0 };
  };
  if (prev && next && next.t - prev.t <= bridge) {
    const u = (t - prev.t) / Math.max(1, next.t - prev.t);
    return { cx: prev.cx + (next.cx - prev.cx) * u, cy: prev.cy + (next.cy - prev.cy) * u, h: prev.h + (next.h - prev.h) * u, conf: 1, ...vel(lo) };
  }
  // before the first / after the last / inside a long gap: hold the nearest then lose confidence
  const near = !prev ? next! : !next ? prev : t - prev.t <= next.t - t ? prev : next;
  const dist = Math.abs(t - near.t);
  if (dist <= hold) return { cx: near.cx, cy: near.cy, h: near.h, conf: 1, vx: 0, vy: 0 };
  const c = 1 - clamp((dist - hold) / fade, 0, 1);
  return c > 0 ? { cx: near.cx, cy: near.cy, h: near.h, conf: c } : null;
}

export interface CamOptions { stepMs?: number }
const EYE_LINE = 0.42;

/** Unsmoothed camera the operator would like at time t. */
export function desiredCam(tgt: Target | null, g: Geometry, r: Pick<ReframeSettings, "tightness"> & { smoothMs?: number }): Cam {
  const cw = coverWindow(g);
  if (!tgt) return { cx: 0.5, cy: 0.5, z: 1 };
  // window height (source-normalised) so that the face is `tightness` of the OUTPUT height
  const hn = clamp(tgt.h / r.tightness, 0.05, cw.h);
  const z = clamp(cw.h / hn, 1, 4);
  const hNow = cw.h / z;
  // look-ahead: a critically damped follower lags a moving target by ~smoothTime x velocity; aim that far ahead so the face stays centred
  const lead = (r.smoothMs ?? 0) * 0.85;
  const want: Cam = { cx: tgt.cx + (tgt.vx ?? 0) * lead, cy: tgt.cy + (tgt.vy ?? 0) * lead + (0.5 - EYE_LINE) * hNow, z };
  // lose confidence -> drift to the centre fallback
  return { cx: want.cx * tgt.conf + 0.5 * (1 - tgt.conf), cy: want.cy * tgt.conf + 0.5 * (1 - tgt.conf), z: 1 + (z - 1) * tgt.conf };
}

/** Keep the crop window inside the source frame. */
export function clampCam(c: Cam, g: Geometry): Cam {
  const cw = coverWindow(g);
  const w = cw.w / c.z, h = cw.h / c.z;
  return { cx: clamp(c.cx, w / 2, 1 - w / 2), cy: clamp(c.cy, h / 2, 1 - h / 2), z: c.z };
}

export interface CameraPath { at(tMs: number): Cam; /** dense samples (for tests / debug overlays) */ samples: { t: number; cam: Cam }[]; hasFaces: boolean }

export function buildCameraPath(faces: Faces | null, g: Geometry, r: ReframeSettings, durationMs: number, opts: CamOptions = {}): CameraPath {
  const step = opts.stepMs ?? 1000 / 60;
  const center: Cam = { cx: 0.5, cy: 0.5, z: 1 };
  const dets = rejectOutliers(detectionsOf(faces));
  const hasFaces = r.mode === "face" && dets.length > 0;
  const samples: { t: number; cam: Cam }[] = [];
  const cw = coverWindow(g);
  // critically damped spring (Unity-style SmoothDamp) on cx, cy and ln(z)
  const smoothTime = Math.max(0.05, r.smoothMs / 1000);
  const omega = 2 / smoothTime;
  let x = { cx: 0.5, cy: 0.5, lz: 0 }, v = { cx: 0, cy: 0, lz: 0 };
  let aim = { cx: 0.5, cy: 0.5, lz: 0 };
  let primed = false;
  const dt = step / 1000;
  const maxSpeed = 0.5; // window-widths per second
  for (let t = 0; t <= durationMs + step; t += step) {
    let cam = center;
    if (hasFaces) {
      const tgt = faceAt(dets, t);
      const want = desiredCam(tgt, g, r);
      if (!primed) { x = { cx: want.cx, cy: want.cy, lz: Math.log(want.z) }; aim = { ...x }; primed = true; }
      // dead zone: keep the previous aim until the face leaves +-14 % of the window (x) / +-12 % (y) around it
      const w = cw.w / Math.exp(x.lz), h = cw.h / Math.exp(x.lz);
      if (!tgt) aim = { cx: want.cx, cy: want.cy, lz: Math.log(want.z) }; // no subject: head straight for the fallback crop (no dead zone)
      else {
      if (Math.abs(want.cx - aim.cx) > 0.14 * w) aim.cx = want.cx - Math.sign(want.cx - aim.cx) * 0.14 * w * 0.5;
      if (Math.abs(want.cy - aim.cy) > 0.12 * h) aim.cy = want.cy - Math.sign(want.cy - aim.cy) * 0.12 * h * 0.5;
      if (Math.abs(Math.log(want.z) - aim.lz) > 0.08) aim.lz = Math.log(want.z);
      }
      for (const k of ["cx", "cy", "lz"] as const) {
        const limit = k === "lz" ? 0.6 : maxSpeed * (k === "cx" ? w : h);
        const ox = omega * dt, e = 1 / (1 + ox + 0.48 * ox * ox + 0.235 * ox * ox * ox);
        let change = x[k] - aim[k];
        const maxChange = limit * smoothTime;
        change = clamp(change, -maxChange, maxChange);
        const tgt = x[k] - change;
        const tmp = (v[k] + omega * change) * dt;
        v[k] = (v[k] - omega * tmp) * e;
        x[k] = tgt + (change + tmp) * e;
      }
      cam = clampCam({ cx: x.cx, cy: x.cy, z: Math.exp(x.lz) }, g);
    }
    samples.push({ t, cam });
  }
  const base = (t: number): Cam => {
    if (!samples.length) return center;
    const f = clamp(t / step, 0, samples.length - 1), i = Math.floor(f), u = f - i, a = samples[i].cam, b = samples[Math.min(samples.length - 1, i + 1)].cam;
    return { cx: a.cx + (b.cx - a.cx) * u, cy: a.cy + (b.cy - a.cy) * u, z: a.z + (b.z - a.z) * u };
  };
  const ramp = 450;
  const at = (t: number): Cam => {
    let cam = base(t);
    for (const o of r.overrides) {
      const w = smooth(clamp((t - o.startMs) / ramp, 0, 1)) * smooth(clamp((o.endMs - t) / ramp, 0, 1));
      if (w <= 0) continue;
      cam = { cx: cam.cx + (o.x - cam.cx) * w, cy: cam.cy + (o.y - cam.cy) * w, z: cam.z + (o.scale - cam.z) * w };
    }
    return clampCam(cam, g);
  };
  return { at, samples, hasFaces };
}

/** Pixel rectangle of the whole source frame (in output pixels) for a camera state: the `<video>` is drawn there and clipped by the composition. */
export function videoRect(c: Cam, g: Geometry, extraZoom = 1): { left: number; top: number; width: number; height: number } {
  const k = Math.max(g.outW / g.srcW, g.outH / g.srcH) * c.z * extraZoom;
  const width = g.srcW * k, height = g.srcH * k;
  const cam = clampCam({ cx: c.cx, cy: c.cy, z: c.z * extraZoom }, g);
  return { left: g.outW / 2 - cam.cx * width, top: g.outH / 2 - cam.cy * height, width, height };
}

/** Where a source-normalised point lands in the output (px) for a camera. */
export function projectPoint(px: number, py: number, c: Cam, g: Geometry): { x: number; y: number } {
  const r = videoRect(c, g);
  return { x: r.left + px * r.width, y: r.top + py * r.height };
}
