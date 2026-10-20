import type { CSSProperties, ReactNode } from "react";
import type { StyleProps } from "../../lib/project";
import type { OutWord } from "../../lib/timeline";

export type LayoutKind = "flow" | "stack" | "single" | "kinetic";

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
  /** word was the most recently started word (stays "current" through pauses) */
  isCurrent: boolean;
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
}

export interface GroupCtx extends BaseCtx {
  lineCount: number;
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
  /** perspective for 3D transforms on the block */
  perspective?: number;
}
