/** SRT / WebVTT import & export. */
import { type Caption, type Word, uid } from "../project";
import { distributeWords } from "./ops";
import { captionFromWords } from "./grouping";
import { tokenize } from "./text";

const pad = (n: number, w = 2) => String(Math.floor(n)).padStart(w, "0");

export function formatTimestamp(ms: number, sep: "," | "."): string {
  const t = Math.max(0, Math.round(ms));
  return `${pad(t / 3600000)}:${pad((t % 3600000) / 60000)}:${pad((t % 60000) / 1000)}${sep}${pad(t % 1000, 3)}`;
}

export function parseTimestamp(s: string): number | null {
  const m = s.trim().match(/^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/);
  if (!m) return null;
  const [, h, mi, se, f] = m;
  return Number(h ?? 0) * 3600000 + Number(mi) * 60000 + Number(se) * 1000 + Number(f.padEnd(3, "0"));
}

export interface Cue {
  startMs: number;
  endMs: number;
  text: string;
}

export function parseSubtitles(input: string): Cue[] {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const blocks = text.split(/\n{2,}/);
  const cues: Cue[] = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim() !== "");
    const ti = lines.findIndex((l) => l.includes("-->"));
    if (ti < 0) continue;
    const [a, b] = lines[ti].split("-->");
    const startMs = parseTimestamp(a);
    const endMs = parseTimestamp(b.trim().split(/\s+/)[0] ?? "");
    if (startMs === null || endMs === null || endMs <= startMs) continue;
    const body = lines
      .slice(ti + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .replace(/\{\\[^}]*\}/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();
    if (body) cues.push({ startMs, endMs, text: body });
  }
  return cues;
}

/** Cues carry no word timing, so words are spread by length (timingSource "import"). */
export function cuesToCaptions(cues: Cue[]): Caption[] {
  return cues.map((cue) => {
    const words: Word[] = distributeWords(tokenize(cue.text), cue.startMs, cue.endMs, 0.9).map((w) => ({ ...w, timingSource: "import" as const }));
    return { ...captionFromWords(words), startMs: cue.startMs, endMs: cue.endMs, id: uid("c_") };
  });
}

export function toSRT(captions: Pick<Caption, "text" | "startMs" | "endMs">[]): string {
  return (
    captions
      .filter((c) => c.text.trim())
      .map((c, i) => `${i + 1}\n${formatTimestamp(c.startMs, ",")} --> ${formatTimestamp(c.endMs, ",")}\n${c.text}\n`)
      .join("\n") 
  );
}

export function toVTT(captions: Pick<Caption, "text" | "startMs" | "endMs">[]): string {
  return (
    "WEBVTT\n\n" +
    captions
      .filter((c) => c.text.trim())
      .map((c) => `${formatTimestamp(c.startMs, ".")} --> ${formatTimestamp(c.endMs, ".")}\n${c.text}\n`)
      .join("\n")
  );
}
