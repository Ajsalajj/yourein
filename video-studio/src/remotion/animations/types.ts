import type { CSSProperties, ReactNode } from "react";
import type { StyleProps } from "../../lib/project";
import type { OutWord } from "../../lib/timeline";
import type { WordStyle } from "../../lib/wordstyle";

export type LayoutKind = "flow" | "stack" | "single" | "kinetic" | "free";

export interface BaseCtx {
  frame: number;
  fps: number;
  /** current output time in ms */
  ms: number;
  style: StyleProps;
  /** px multiplier relative to a 1080-short-side canvas */
  scale: number;
  /** animation duration (ms) chosen by the user */
  dur: number;
  /** intensity 0..2 (1 = designed strength) */
  k: number;
  group: { startMs: number; endMs: number; wordCount: number };
  sinceGroup: number;
  untilGroupEnd: number;
  /** 0..1 eased progress of the group entrance */
  enter: number;
  /** 0..1 progress of the group exit (0 until the exit window starts) */
  exit: number;
  /** seconds on the video clock (frame / fps), for continuous (looping) effects */
  tSec: number;
  /** user-selected easing for the preset's "ease-out" moves, t in 0..1 */
  ease: (t: number) => number;
  /** scale-motion multiplier (style.scaleIntensity, default 1) */
  sk: number;
  /** exit duration in ms */
  exitMs: number;
  /** spring value (0..~1.2) started `sinceMs` ago, stretched to `durMs` (defaults to dur). */
  spr: (sinceMs: number, opts?: { damping?: number; stiffness?: number; mass?: number; durMs?: number }) => number;
}

export interface WordCtx extends BaseCtx {
  word: OutWord;
  index: number;
  count: number;
  sinceWord: number;
  untilWordEnd: number;
  /** 0..1 progress through the word's spoken span */
  wordP: number;
  state: "future" | "active" | "past";
  revealed: boolean;
  lineIndex: number;
  indexInLine: number;
  lineCount: number;
  /** 0..1 ramp of the active-word highlight since the word started (style.highlightMs) */
  hlP: number;
  /** geometry of every word relative to the caption block (for behaviours that draw between words) */
  geom: BlockGeometry;
  /** word was the most recently started word (stays "current" through pauses) */
  isCurrent: boolean;
  /** merged look for this word (template -> active -> emphasis -> user) */
  look: WordStyle;
  /** this word is a keyword (auto-picked or forced) */
  emphasized: boolean;
  /** how many words of this group have started so far (0..count) */
  startedCount: number;
  /** start time of the most recently started word */
  currentStartMs: number;
  /** 0..1 relative visual weight of the word within its group (longest word = 1) */
  emphasis: number;
}

export interface WordVisual {
  /** outer span (position, opacity, transform, colors) */
  style?: CSSProperties;
  /** gradient/clip text fill. The renderer draws stroke + shadow on a separate layer beneath it. */
  fill?: CSSProperties;
  /** inner span, for masks / clipping */
  inner?: CSSProperties;
  /** absolutely positioned decoration inside the word box (underline, highlighter, pill) */
  decoration?: ReactNode;
  /** appended inline after the text (e.g. typing caret) */
  suffix?: ReactNode;
  hidden?: boolean;
  /** multipliers on the look's glow / extrusion depth / shadow offsets (animated effects) */
  glowK?: number;
  extrudeK?: number;
  shadowK?: number;
  /** take the word out of the line and place it at an absolute canvas position (fractions, centre anchored) */
  place?: { x: number; y: number };
}

export interface WordRect { x: number; y: number; w: number; h: number }
export interface BlockGeometry { rects: WordRect[]; width: number; height: number }

export interface GroupCtx extends BaseCtx {
  lineCount: number;
  geom: BlockGeometry;
  /** index of the most recently started word and when it started (same clock as word animation) */
  currentIndex: number;
  currentStartMs: number;
}

export interface GroupVisual {
  /** wrapper around the whole text block */
  style?: CSSProperties;
  /** rendered inside the wrapper before/after the lines (rules, accent bars) */
  before?: ReactNode;
  after?: ReactNode;
  /** full-frame overlay behind the text */
  overlay?: ReactNode;
}

export interface Behavior {
  id: string;
  name: string;
  layout?: LayoutKind;
  /** animate per grapheme cluster instead of per word */
  unit?: "word" | "char";
  word?: (c: WordCtx) => WordVisual;
  char?: (c: WordCtx, ch: string, i: number, n: number) => CSSProperties;
  group?: (c: GroupCtx) => GroupVisual;
  /** extra horizontal padding (em) each word reserves for decorations such as pills; used for fit-to-width */
  wordPadEm?: number;
  /** for layout "free": widest size multiplier any word may reach (used for fit-to-width) */
  freeMaxEm?: number;
  /** perspective for 3D transforms on the block */
  perspective?: number;
}
