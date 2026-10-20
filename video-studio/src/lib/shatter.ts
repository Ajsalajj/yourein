/**
 * Shattered text: the text box is cut into a jittered triangle mesh (real polygons, deterministic for a seed); every shard is the same text
 * clipped to its triangle and moved on its own trajectory. Pure functions; the component draws one clipped copy of the text per shard.
 */
export interface Pt { x: number; y: number }
export interface Shard { id: number; pts: [Pt, Pt, Pt]; cx: number; cy: number; area: number }

function rng(seed: number) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return (s >>> 0) / 4294967296; };
}

/** Triangle mesh over [0,w]x[0,h]: (cols x rows) cells, interior vertices jittered by up to 35 % of a cell, each cell split on a random diagonal. */
export function buildShards(w: number, h: number, cols: number, rows: number, seed = 1): Shard[] {
  const r = rng(seed * 2654435761 + cols * 31 + rows);
  const P: Pt[][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: Pt[] = [];
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols, edgeY = j === 0 || j === rows;
      const jx = edgeX ? 0 : (r() - 0.5) * 0.7 * (w / cols);
      const jy = edgeY ? 0 : (r() - 0.5) * 0.7 * (h / rows);
      row.push({ x: (i / cols) * w + jx, y: (j / rows) * h + jy });
    }
    P.push(row);
  }
  const out: Shard[] = [];
  const mk = (a: Pt, b: Pt, c: Pt) => {
    const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    out.push({ id: out.length, pts: [a, b, c], cx: (a.x + b.x + c.x) / 3, cy: (a.y + b.y + c.y) / 3, area });
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = P[j][i], b = P[j][i + 1], c = P[j + 1][i + 1], d = P[j + 1][i];
    if (r() < 0.5) { mk(a, b, c); mk(a, c, d); } else { mk(a, b, d); mk(b, c, d); }
  }
  return out;
}

export interface ShatterParams {
  /** 0..1 how far shards fly */
  spread: number;
  /** impact point in box fractions */
  impact: { x: number; y: number };
  seed: number;
}
export interface ShardPose { tx: number; ty: number; rotate: number; scale: number; opacity: number }

/** Pose of a shard at break progress p (0 = intact, 1 = gone). Shards fly away from the impact point, spin, fall under gravity and fade. */
export function shardPose(s: Shard, p: number, box: { w: number; h: number }, prm: ShatterParams): ShardPose {
  const t = Math.min(1, Math.max(0, p));
  if (t <= 0) return { tx: 0, ty: 0, rotate: 0, scale: 1, opacity: 1 };
  const r = rng(prm.seed * 7919 + s.id * 104729);
  const dx = s.cx - prm.impact.x * box.w, dy = s.cy - prm.impact.y * box.h;
  const len = Math.hypot(dx, dy) || 1;
  const dist = (0.35 + 0.9 * r()) * prm.spread * Math.max(box.w, box.h) * (0.5 + 0.5 * (1 - len / (Math.hypot(box.w, box.h) + 1e-9)));
  const ease = 1 - Math.pow(1 - t, 2.2);
  return {
    tx: (dx / len) * dist * ease,
    ty: (dy / len) * dist * ease + 0.55 * box.h * prm.spread * t * t, // gravity
    rotate: (r() - 0.5) * 220 * prm.spread * ease,
    scale: 1 - 0.35 * t * r(),
    opacity: t < 0.55 ? 1 : 1 - (t - 0.55) / 0.45,
  };
}

/** CSS clip-path polygon (px, relative to the box) of a shard */
export const shardClip = (s: Shard) => `polygon(${s.pts.map((p) => `${p.x.toFixed(2)}px ${p.y.toFixed(2)}px`).join(", ")})`;
export const shardsArea = (shards: Shard[]) => shards.reduce((a, s) => a + s.area, 0);
