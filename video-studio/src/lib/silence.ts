export interface Silence { startMs: number; endMs: number }
import { normalizeCuts } from "./timeline";

export interface SilenceOptions {
  /** Only silences at least this long are considered. */
  minSilenceMs: number;
  /** Natural pause kept on each side of a removed silence, so breaths and phrasing survive. */
  keepPadMs: number;
  /** Cuts shorter than this are not worth making. */
  minCutMs: number;
}
export const DEFAULT_SILENCE: SilenceOptions = { minSilenceMs: 700, keepPadMs: 180, minCutMs: 250 };

/** Convert detected silences into conservative cuts: each silence is trimmed by `keepPadMs` on both ends. */
export function silencesToCuts(silences: Pick<Silence, "startMs" | "endMs">[], durationMs: number, opts: Partial<SilenceOptions> = {}) {
  const o = { ...DEFAULT_SILENCE, ...opts };
  const cuts = silences
    .filter((s) => s.endMs - s.startMs >= o.minSilenceMs)
    .map((s) => ({ startMs: Math.max(0, s.startMs + o.keepPadMs), endMs: Math.min(durationMs, s.endMs - o.keepPadMs) }))
    .filter((c) => c.endMs - c.startMs >= o.minCutMs);
  return normalizeCuts(cuts, durationMs);
}
