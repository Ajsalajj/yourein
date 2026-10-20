"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Redo2, Scissors, SplitSquareHorizontal, Undo2, ZoomIn, Search as ZoomFit, X, ZoomIn as PunchIn } from "lucide-react";
import { useEditor } from "@/store/editor";
import { api, fmtTime } from "@/lib/client";
import * as ops from "@/lib/captions/ops";
import { frameToMs } from "@/lib/timeline";
import { uid } from "@/lib/project";
import { Button, Tip } from "@/components/ui";
import { useMeta, useSeek, useSourceDuration } from "./context";
import { cn } from "@/lib/cn";

const GUTTER = 84;
const H = { ruler: 24, video: 42, audio: 40, cap: 34, fx: 28, music: 24 };

type Drag =
  | { kind: "scrub" }
  | { kind: "range"; anchor: number }
  | { kind: "cap-move" | "cap-l" | "cap-r"; id: string; x0: number; orig: import("@/lib/project").Caption }
  | { kind: "zoom-move" | "zoom-l" | "zoom-r"; id: string; x0: number; orig: import("@/lib/project").Zoom };

export function Timeline() {
  const project = useEditor((s) => s.project)!;
  const frame = useEditor((s) => s.frame);
  const sel = useEditor((s) => s.selection);
  const canUndo = useEditor((s) => s.past.length > 0);
  const canRedo = useEditor((s) => s.future.length > 0);
  const duration = useSourceDuration();
  const meta = useMeta();
  const seek = useSeek();
  const scroller = useRef<HTMLDivElement>(null);
  const [pps, setPps] = useState(0); // px per second
  const [drag, setDrag] = useState<Drag | null>(null);
  const [range, setRange] = useState<{ a: number; b: number } | null>(null);
  const [peaks, setPeaks] = useState<number[] | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const playMs = seek.sourceNow(frame);

  const fit = useCallback(() => {
    const w = (scroller.current?.clientWidth ?? 800) - 24;
    setPps(Math.max(4, w / Math.max(1, duration / 1000)));
  }, [duration]);
  useEffect(() => { if (duration && !pps) fit(); }, [duration, pps, fit]);

  const width = Math.max(100, (duration / 1000) * pps);
  const x = (ms: number) => (ms / 1000) * pps;
  const toMs = (px: number) => Math.max(0, Math.min(duration, (px / pps) * 1000));
  const localX = (e: { clientX: number }) => e.clientX - (scroller.current!.getBoundingClientRect().left + 0) + scroller.current!.scrollLeft;

  // waveform
  useEffect(() => {
    if (!project.sourceAssetId || !project.assets[project.sourceAssetId]?.hasAudio) return;
    let alive = true;
    api<{ peaks: number[] }>(`/api/projects/${project.id}/analyze`, { method: "POST", body: JSON.stringify({ kind: "waveform", buckets: 1600 }) }).then((r) => alive && setPeaks(r.peaks)).catch(() => {});
    return () => { alive = false; };
  }, [project.id, project.sourceAssetId, project.assets]);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !peaks) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(width * dpr);
    c.height = H.audio * dpr;
    const g = c.getContext("2d")!;
    g.scale(dpr, dpr);
    g.clearRect(0, 0, width, H.audio);
    g.fillStyle = "#5ee1c4";
    const bw = width / peaks.length;
    peaks.forEach((p, i) => {
      const h = Math.max(1, Math.pow(p, 0.6) * (H.audio - 6));
      g.fillRect(i * bw, (H.audio - h) / 2, Math.max(1, bw - 0.5), h);
    });
  }, [peaks, width]);

  // scrubbing / drag handling on window so the pointer can leave the lane
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const px = localX(e);
      const st = useEditor.getState();
      if (drag.kind === "scrub") seek.fromSource(toMs(px));
      else if (drag.kind === "range") setRange({ a: Math.min(drag.anchor, toMs(px)), b: Math.max(drag.anchor, toMs(px)) });
      else if (drag.kind === "cap-move" || drag.kind === "cap-l" || drag.kind === "cap-r") {
        const delta = ((px - drag.x0) / pps) * 1000;
        st.setCaptions((cs) => cs.map((c) => {
          if (c.id !== drag.id) return c;
          if (drag.kind === "cap-move") return ops.shiftCaption([drag.orig], c.id, delta)[0];
          return ops.resizeCaption([drag.orig], c.id, drag.kind === "cap-l" ? "start" : "end", (drag.kind === "cap-l" ? drag.orig.startMs : drag.orig.endMs) + delta)[0];
        }), `drag:${drag.id}`);
      } else if (drag.kind === "zoom-move" || drag.kind === "zoom-l" || drag.kind === "zoom-r") {
        const delta = ((px - drag.x0) / pps) * 1000;
        st.setZooms((zs) => zs.map((z) => {
          if (z.id !== drag.id) return z;
          const o = drag.orig;
          if (drag.kind === "zoom-move") { const d = Math.max(-o.startMs, Math.min(duration - o.endMs, delta)); return { ...o, startMs: o.startMs + d, endMs: o.endMs + d }; }
          if (drag.kind === "zoom-l") return { ...o, startMs: Math.max(0, Math.min(o.endMs - 300, o.startMs + delta)) };
          return { ...o, endMs: Math.min(duration, Math.max(o.startMs + 300, o.endMs + delta)) };
        }), `drag:${drag.id}`);
      }
    };
    const up = () => { setDrag(null); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }); // intentionally re-bound each render: closes over latest pps/duration

  // keep the playhead in view
  useEffect(() => {
    const s = scroller.current;
    if (!s || drag) return;
    const px = x(playMs);
    if (px < s.scrollLeft + 20 || px > s.scrollLeft + s.clientWidth - 40) s.scrollLeft = Math.max(0, px - s.clientWidth / 3);
  }, [playMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // keyboard: split, delete, undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      const st = useEditor.getState();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? st.redo() : st.undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") { e.preventDefault(); st.redo(); return; }
      if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); splitAtPlayhead(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (st.selection.cutId) { st.removeCut(st.selection.cutId); st.select({ cutId: null }); }
        else if (st.selection.zoomId) { const id = st.selection.zoomId; st.setZooms((z) => z.filter((q) => q.id !== id)); st.select({ zoomId: null }); }
        else if (st.selection.captionId) { const id = st.selection.captionId; st.setCaptions((c) => ops.deleteCaption(c, id)); st.select({ captionId: null }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const splitAtPlayhead = () => useEditor.getState().setCaptions((c) => ops.splitCaptionAtTime(c, playMs));

  const ticks = useMemo(() => {
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300];
    const step = steps.find((s) => s * pps >= 70) ?? 600;
    const out: number[] = [];
    for (let t = 0; t <= duration / 1000; t += step) out.push(t);
    return { out, step };
  }, [pps, duration]);

  const st = useEditor.getState;
  const rowTop = { ruler: 0, video: H.ruler, audio: H.ruler + H.video, cap: H.ruler + H.video + H.audio, fx: H.ruler + H.video + H.audio + H.cap, music: H.ruler + H.video + H.audio + H.cap + H.fx };
  const hasMusic = !!project.audio.music;
  const total = rowTop.music + (hasMusic ? H.music : 0);
  const labels: [string, number, number][] = [["Ruler", rowTop.ruler, H.ruler], ["Video", rowTop.video, H.video], ["Audio", rowTop.audio, H.audio], ["Captions", rowTop.cap, H.cap], ["Effects", rowTop.fx, H.fx], ...(hasMusic ? [["Music", rowTop.music, H.music] as [string, number, number]] : [])];

  if (!duration) return null;
  return (
    <div className="flex h-[272px] shrink-0 flex-col border-t border-line bg-panel" aria-label="Timeline">
      <div className="flex items-center gap-1 border-b border-line px-2 py-1">
        <Tip text="Undo (Ctrl+Z)"><Button variant="ghost" size="icon" aria-label="Undo" disabled={!canUndo} onClick={() => st().undo()}><Undo2 size={15} /></Button></Tip>
        <Tip text="Redo (Ctrl+Shift+Z)"><Button variant="ghost" size="icon" aria-label="Redo" disabled={!canRedo} onClick={() => st().redo()}><Redo2 size={15} /></Button></Tip>
        <span className="mx-1 h-5 w-px bg-line" />
        <Tip text="Split the caption under the playhead (S)"><Button variant="secondary" size="sm" onClick={splitAtPlayhead}><SplitSquareHorizontal size={14} /> Split caption</Button></Tip>
        <Tip text="Remove the selected range from the video (stored as a cut)"><Button variant="secondary" size="sm" disabled={!range || range.b - range.a < 100} onClick={() => { if (range) { st().addCut(range.a, range.b, "manual"); setRange(null); } }}><Scissors size={14} /> Cut range</Button></Tip>
        <Tip text="Add a punch-in zoom over the selected range"><Button variant="secondary" size="sm" disabled={!range || range.b - range.a < 300} onClick={() => { if (range) { const id = uid("z_"); st().setZooms((z) => [...z, { id, startMs: range.a, endMs: range.b, scale: 1.25, focusX: 0.5, focusY: 0.45, rampMs: 350, source: "manual" }]); st().select({ zoomId: id }); setRange(null); } }}><PunchIn size={14} /> Zoom range</Button></Tip>
        {range ? <><span className="text-[11px] tabular-nums text-mute">{fmtTime(range.a)}–{fmtTime(range.b)}</span><Button variant="ghost" size="icon" aria-label="Clear range" onClick={() => setRange(null)}><X size={13} /></Button></> : <span className="text-[11px] text-mute">Drag on the video lane to select a range</span>}
        <div className="ml-auto flex items-center gap-2 text-[11px] text-mute">
          <span>Source {fmtTime(duration)} → output {fmtTime((meta.durationInFrames * 1000) / meta.fps)}</span>
          <ZoomIn size={14} aria-hidden />
          <input aria-label="Timeline zoom" type="range" min={4} max={400} value={Math.round(pps)} onChange={(e) => setPps(Number(e.target.value))} className="w-28 accent-[#8b7bff]" />
          <Button variant="ghost" size="icon" aria-label="Fit timeline" onClick={fit}><ZoomFit size={14} /></Button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="shrink-0 border-r border-line bg-panel" style={{ width: GUTTER }}>
          {labels.map(([l, top, h]) => <div key={l} className="absolute flex items-center px-3 text-[11px] text-mute" style={{ top, height: h, width: GUTTER }}>{l === "Ruler" ? "" : l}</div>)}
        </div>
        <div ref={scroller} className="relative min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
          <div className="relative select-none" style={{ width, height: total }}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("[data-block]")) return;
              const px = localX(e); const ms = toMs(px);
              const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
              st().select({ captionId: null, zoomId: null, cutId: null });
              if (y >= rowTop.video && y < rowTop.audio) { setRange(null); setDrag({ kind: "range", anchor: ms }); }
              else { setDrag({ kind: "scrub" }); seek.fromSource(ms); }
            }}>
            {/* ruler */}
            <div className="absolute inset-x-0 top-0 border-b border-line bg-panel-2" style={{ height: H.ruler }}>
              {ticks.out.map((t) => <div key={t} className="absolute top-0 h-full border-l border-line pl-1 text-[10px] text-mute" style={{ left: x(t * 1000) }}>{t < 60 ? `${t}s` : `${Math.floor(t / 60)}:${String(Math.round(t % 60)).padStart(2, "0")}`}</div>)}
            </div>
            {/* lanes */}
            {[rowTop.video, rowTop.audio, rowTop.cap, rowTop.fx].map((t, i) => <div key={i} className="absolute inset-x-0 border-b border-line/60" style={{ top: t, height: [H.video, H.audio, H.cap, H.fx][i] }} />)}

            {/* video lane: kept footage + removed regions */}
            <div className="absolute rounded bg-accent/25 ring-1 ring-accent/40" style={{ left: 0, width, top: rowTop.video + 4, height: H.video - 8 }} />
            {project.cuts.map((c) => (
              <button key={c.id} data-block title={`Removed ${fmtTime(c.startMs)}–${fmtTime(c.endMs)} (${c.reason}). Select and press Delete to restore.`} aria-label={`Removed footage ${fmtTime(c.startMs)} to ${fmtTime(c.endMs)}`}
                onPointerDown={(e) => { e.stopPropagation(); st().select({ cutId: c.id, captionId: null, zoomId: null }); }}
                className={cn("hatch absolute rounded border border-danger/50 bg-bg/80", sel.cutId === c.id && "ring-2 ring-danger")} style={{ left: x(c.startMs), width: Math.max(3, x(c.endMs - c.startMs)), top: rowTop.video + 4, height: H.video - 8 }} />
            ))}
            {range ? <div className="pointer-events-none absolute rounded border border-accent-2 bg-accent-2/20" style={{ left: x(range.a), width: x(range.b - range.a), top: rowTop.video + 2, height: H.video - 4 }} /> : null}

            {/* audio lane */}
            <canvas ref={canvas} className="absolute left-0" style={{ top: rowTop.audio, width, height: H.audio }} aria-hidden />
            {project.cuts.map((c) => <div key={c.id} className="pointer-events-none absolute bg-bg/70" style={{ left: x(c.startMs), width: x(c.endMs - c.startMs), top: rowTop.audio, height: H.audio }} />)}
            {!peaks ? <div className="absolute px-2 text-[10px] text-mute" style={{ top: rowTop.audio + 12 }}>{project.assets[project.sourceAssetId ?? ""]?.hasAudio ? "reading waveform…" : "no audio track"}</div> : null}

            {/* captions lane */}
            {project.captions.map((c) => {
              const active = sel.captionId === c.id;
              const w = Math.max(6, x(c.endMs - c.startMs));
              return (
                <div key={c.id} data-block role="button" tabIndex={0} aria-label={`Caption: ${c.text}`} aria-pressed={active}
                  onPointerDown={(e) => { e.stopPropagation(); st().select({ captionId: c.id, cutId: null, zoomId: null }); setDrag({ kind: "cap-move", id: c.id, x0: localX(e), orig: c }); }}
                  onDoubleClick={() => seek.fromSource(c.startMs)}
                  onKeyDown={(e) => { if (e.key === "Enter") seek.fromSource(c.startMs); }}
                  className={cn("absolute cursor-grab overflow-hidden rounded border px-1.5 text-[11px] leading-[26px] text-white active:cursor-grabbing", active ? "border-white bg-accent" : "border-accent/50 bg-accent/55 hover:bg-accent/70")}
                  style={{ left: x(c.startMs), width: w, top: rowTop.cap + 3, height: H.cap - 6 }} title={c.text}>
                  <span className="pointer-events-none block truncate">{c.text}</span>
                  <span data-block className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" onPointerDown={(e) => { e.stopPropagation(); st().select({ captionId: c.id }); setDrag({ kind: "cap-l", id: c.id, x0: localX(e), orig: c }); }} />
                  <span data-block className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" onPointerDown={(e) => { e.stopPropagation(); st().select({ captionId: c.id }); setDrag({ kind: "cap-r", id: c.id, x0: localX(e), orig: c }); }} />
                </div>
              );
            })}

            {/* effects lane (zooms) */}
            {project.zooms.map((z) => {
              const active = sel.zoomId === z.id;
              return (
                <div key={z.id} data-block role="button" tabIndex={0} aria-label={`Zoom ${z.scale.toFixed(2)}×`}
                  onPointerDown={(e) => { e.stopPropagation(); st().select({ zoomId: z.id, captionId: null, cutId: null }); setDrag({ kind: "zoom-move", id: z.id, x0: localX(e), orig: z }); }}
                  className={cn("absolute cursor-grab overflow-hidden rounded border px-1.5 text-[10px] leading-[20px] text-[#0b0c10]", active ? "border-white bg-accent-2" : "border-accent-2/60 bg-accent-2/75")}
                  style={{ left: x(z.startMs), width: Math.max(8, x(z.endMs - z.startMs)), top: rowTop.fx + 3, height: H.fx - 6 }}>
                  <span className="pointer-events-none">{z.scale.toFixed(2)}× {z.source === "auto" ? "auto" : ""}</span>
                  <span data-block className="absolute inset-y-0 left-0 w-2 cursor-ew-resize" onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: "zoom-l", id: z.id, x0: localX(e), orig: z }); st().select({ zoomId: z.id }); }} />
                  <span data-block className="absolute inset-y-0 right-0 w-2 cursor-ew-resize" onPointerDown={(e) => { e.stopPropagation(); setDrag({ kind: "zoom-r", id: z.id, x0: localX(e), orig: z }); st().select({ zoomId: z.id }); }} />
                </div>
              );
            })}

            {hasMusic ? <div className="absolute rounded bg-warn/30 px-2 text-[10px] leading-[18px] text-warn" style={{ left: 0, width, top: rowTop.music + 3, height: H.music - 6 }}>♪ {project.assets[project.audio.music!.assetId]?.filename ?? "music"} {project.audio.music!.ducking ? "(ducks under speech)" : ""}</div> : null}

            {/* playhead */}
            <div className="pointer-events-none absolute top-0 z-10 w-px bg-white" style={{ left: x(playMs), height: total }}>
              <div className="absolute -left-[5px] top-0 h-3 w-[11px] rounded-b bg-white" />
            </div>
          </div>
        </div>
      </div>
      <span className="sr-only" aria-live="polite">Playhead {fmtTime(frameToMs(frame, meta.fps))}</span>
    </div>
  );
}
