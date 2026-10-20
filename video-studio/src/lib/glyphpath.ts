/**
 * Text on a circular path: every glyph is placed by its measured advance along the arc and rotated to the tangent (true per-glyph geometry,
 * flat 2D - not a warp of a bitmap). Pure functions; the component measures the glyph widths with the real font.
 */
export interface PathSpec {
  radius: number;
  /** angle (degrees, 0 = 12 o'clock, clockwise positive) where the text starts */
  startDeg: number;
  /** total sweep; 0 = natural spacing (the text takes the arc length it needs) */
  sweepDeg: number;
  direction: "cw" | "ccw";
  /** baseline toward the centre (text readable from inside the circle) */
  inside: boolean;
}
export interface PlacedGlyph { /** angle of the glyph centre in degrees */ angleDeg: number; x: number; y: number; /** rotation to apply to the upright glyph, degrees */ rotateDeg: number }

const rad = (d: number) => (d * Math.PI) / 180;

export function layoutOnCircle(widths: number[], spec: PathSpec): PlacedGlyph[] {
  const n = widths.length;
  if (!n) return [];
  const R = Math.max(1, spec.radius);
  const total = widths.reduce((a, b) => a + b, 0);
  const sign = spec.direction === "cw" ? 1 : -1;
  // arc length available: natural = text length; fixed sweep = justify the glyphs over it
  const arc = spec.sweepDeg > 0 ? rad(spec.sweepDeg) * R : total;
  const gap = spec.sweepDeg > 0 && n > 1 ? (arc - total) / (n - 1) : 0;
  const out: PlacedGlyph[] = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const mid = s + widths[i] / 2;
    const a = spec.startDeg + sign * (mid / R) * (180 / Math.PI);
    const x = R * Math.sin(rad(a));
    const y = -R * Math.cos(rad(a));
    // tangent rotation: outside text stands on the circle (rotate = angle); direction flips the reading side
    let rot = a + (spec.inside ? 180 : 0);
    if (sign < 0) rot += 180;
    out.push({ angleDeg: a, x, y, rotateDeg: rot });
    s += widths[i] + gap;
  }
  return out;
}

/** Angular length (degrees) the text occupies with natural spacing - lets the UI warn when it would wrap past a full circle. */
export const naturalSweepDeg = (widths: number[], radius: number) => (widths.reduce((a, b) => a + b, 0) / Math.max(1, radius)) * (180 / Math.PI);
