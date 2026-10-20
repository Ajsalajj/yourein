"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Player } from "@remotion/player";
import { Captions, Crosshair, Maximize2, Pause, Play, Shield, SkipBack, SkipForward, Move } from "lucide-react";
import { Studio } from "@/remotion/Studio";
import { ASPECTS, type AspectId } from "@/lib/project";
import { useEditor } from "@/store/editor";
import { useVision } from "@/store/vision";
import { sourceToCanvas } from "@/lib/tracking";
import { mediaUrl, fmtTime } from "@/lib/client";
import { Button, Tip } from "@/components/ui";
import { usePlayerRef, useMeta } from "./context";
import { cn } from "@/lib/cn";

const QUALITY = [{ v: 1, l: "Full" }, { v: 0.5, l: "Half" }, { v: 0.25, l: "Draft" }];

export function PlayerPane() {
  const ref = usePlayerRef();
  const project = useEditor((s) => s.project)!;
  const frame = useEditor((s) => s.frame);
  const setFrame = useEditor((s) => s.setFrame);
  const sel = useEditor((s) => s.selection);
  const meta = useMeta();
  const [playing, setPlaying] = useState(false);
  const [quality, setQuality] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [guides, setGuides] = useState(false);
  const [dragMode, setDragMode] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const mediaUrls = useMemo(() => Object.fromEntries(Object.values(project.assets).map((a) => [a.id, mediaUrl(project.id, a.id)])), [project.assets, project.id]);
  const seg = project.analysis.segmentation;
  const mask = useMemo(() => (seg ? { base: `/api/projects/${project.id}/masks/${seg.id}`, query: "", fps: seg.fps, frames: seg.frames } : null), [seg, project.id]);
  const inputProps = useMemo(() => ({ project, mediaUrls, mask }), [project, mediaUrls, mask]);
  const vision = useVision();
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const srcAsset = project.sourceAssetId ? project.assets[project.sourceAssetId] : undefined;
  const norm = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  /** canvas-normalised box -> source-frame-normalised ROI (inverse of object-fit: cover) */
  const toSourceRoi = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (!srcAsset?.width || !srcAsset.height) return null;
    const cw = meta.width, ch = meta.height, k = Math.max(cw / srcAsset.width, ch / srcAsset.height);
    const inv = (p: { x: number; y: number }) => ({ x: (p.x * cw + (srcAsset.width! * k - cw) / 2) / (srcAsset.width! * k), y: (p.y * ch + (srcAsset.height! * k - ch) / 2) / (srcAsset.height! * k) });
    const p0 = inv({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y) }), p1 = inv({ x: Math.max(a.x, b.x), y: Math.max(a.y, b.y) });
    return { x: Math.max(0, p0.x), y: Math.max(0, p0.y), w: Math.min(1, p1.x) - Math.max(0, p0.x), h: Math.min(1, p1.y) - Math.max(0, p0.y) };
  };
  void sourceToCanvas;

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onPause);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onPause);
    };
  }, [ref, setFrame, meta.durationInFrames]);

  const toggle = useCallback(() => (ref.current?.isPlaying() ? ref.current.pause() : ref.current?.play()), [ref]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.code === "Space") { e.preventDefault(); toggle(); }
      if (e.code === "ArrowLeft") { e.preventDefault(); ref.current?.seekTo(Math.max(0, (ref.current.getCurrentFrame() ?? 0) - (e.shiftKey ? 10 : 1))); }
      if (e.code === "ArrowRight") { e.preventDefault(); ref.current?.seekTo(Math.min(meta.durationInFrames - 1, (ref.current.getCurrentFrame() ?? 0) + (e.shiftKey ? 10 : 1))); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, ref, meta.durationInFrames]);

  const onDragPos = (e: React.PointerEvent) => {
    if (!dragMode || !box.current || e.buttons !== 1) return;
    const r = box.current.getBoundingClientRect();
    const x = Math.min(0.95, Math.max(0.05, (e.clientX - r.left) / r.width));
    const y = Math.min(0.97, Math.max(0.03, (e.clientY - r.top) / r.height));
    const s = useEditor.getState();
    if (sel.captionId) s.patchCaption(sel.captionId, { position: { x, y } });
    else s.setPosition({ x, y });
  };

  const hasVideo = !!project.sourceAssetId;
  const totalMs = (meta.durationInFrames * 1000) / meta.fps;
  const aspect = ASPECTS[project.aspect];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5 text-[12px]">
        <div className="flex items-center gap-1">
          <select aria-label="Aspect ratio" className="field !w-[150px] !py-1" value={project.aspect} onChange={(e) => useEditor.getState().setAspect(e.target.value as AspectId)}>
            {Object.entries(ASPECTS).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.width}×{v.height})</option>)}
          </select>
          <select aria-label="Preview quality" className="field !w-[88px] !py-1" value={quality} onChange={(e) => setQuality(Number(e.target.value))}>
            {QUALITY.map((q) => <option key={q.v} value={q.v}>{q.l}</option>)}
          </select>
          <select aria-label="Preview zoom" className="field !w-[88px] !py-1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {[[1, "Fit"], [1.5, "150%"], [2, "200%"]].map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Tip text="Captions on/off"><Button variant={project.captionsVisible ? "secondary" : "ghost"} size="icon" aria-pressed={project.captionsVisible} aria-label="Toggle captions" onClick={() => useEditor.getState().commit((p) => ({ ...p, captionsVisible: !p.captionsVisible }))}><Captions size={15} /></Button></Tip>
          <Tip text="Drag captions on the preview to reposition"><Button variant={dragMode ? "primary" : "ghost"} size="icon" aria-pressed={dragMode} aria-label="Drag to position captions" onClick={() => setDragMode((v) => !v)}><Move size={15} /></Button></Tip>
          <Tip text="Safe-zone guides (approximate platform UI areas)"><Button variant={guides ? "secondary" : "ghost"} size="icon" aria-pressed={guides} aria-label="Toggle safe-zone guides" onClick={() => setGuides((v) => !v)}><Shield size={15} /></Button></Tip>
          <Tip text="Fullscreen preview"><Button variant="ghost" size="icon" aria-label="Fullscreen" onClick={() => ref.current?.requestFullscreen()}><Maximize2 size={15} /></Button></Tip>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#07080b] p-3">
        {hasVideo ? (
          <div ref={box} onPointerMove={onDragPos} onPointerDown={onDragPos} className="relative shrink-0 overflow-hidden rounded-md shadow-2xl ring-1 ring-line" style={{ aspectRatio: `${aspect.width} / ${aspect.height}`, height: `${zoom * 100}%`, maxWidth: zoom === 1 ? "100%" : undefined, cursor: dragMode ? "crosshair" : undefined }}>
            <Player ref={ref} component={Studio} inputProps={inputProps} durationInFrames={meta.durationInFrames} compositionWidth={Math.round(meta.width * quality)} compositionHeight={Math.round(meta.height * quality)} fps={meta.fps} controls={false} clickToPlay={!dragMode} doubleClickToFullscreen={false} acknowledgeRemotionLicense style={{ width: "100%", height: "100%" }} initiallyShowControls={false} />
            {guides ? <Guides aspect={project.aspect} /> : null}
            {vision.picking ? (
              <div className="absolute inset-0 z-20 cursor-crosshair bg-black/10" aria-label="Drag to select the region to track"
                onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const p = norm(e); setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
                onPointerMove={(e) => { if (drag) { const p = norm(e); setDrag({ ...drag, x1: p.x, y1: p.y }); } }}
                onPointerUp={() => { if (drag) { const roi = toSourceRoi({ x: drag.x0, y: drag.y0 }, { x: drag.x1, y: drag.y1 }); if (roi && roi.w > 0.02 && roi.h > 0.02) { vision.setRoi(roi); vision.setPicking(false); } setDrag(null); } }}>
                {drag ? <div className="absolute border-2 border-accent-2 bg-accent-2/15" style={{ left: `${Math.min(drag.x0, drag.x1) * 100}%`, top: `${Math.min(drag.y0, drag.y1) * 100}%`, width: `${Math.abs(drag.x1 - drag.x0) * 100}%`, height: `${Math.abs(drag.y1 - drag.y0) * 100}%` }} /> : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-mute">This project has no video.</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <Button variant="ghost" size="icon" aria-label="Previous frame" onClick={() => ref.current?.seekTo(Math.max(0, frame - 1))}><SkipBack size={15} /></Button>
        <Button variant="primary" size="icon" aria-label={playing ? "Pause" : "Play"} onClick={toggle}>{playing ? <Pause size={15} /> : <Play size={15} />}</Button>
        <Button variant="ghost" size="icon" aria-label="Next frame" onClick={() => ref.current?.seekTo(Math.min(meta.durationInFrames - 1, frame + 1))}><SkipForward size={15} /></Button>
        <span className="tabular-nums text-[12px] text-mute" aria-live="off">{fmtTime((frame * 1000) / meta.fps)} / {fmtTime(totalMs)} <span className="text-mute/60">· f{frame}</span></span>
        {dragMode ? <span className="ml-auto flex items-center gap-1 text-[11px] text-accent"><Crosshair size={12} /> drag on the video to move {sel.captionId ? "the selected caption" : "all captions"}</span> : null}
      </div>
    </div>
  );
}

function Guides({ aspect }: { aspect: AspectId }) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div className="absolute inset-[5%] rounded border border-dashed border-white/50" />
      <div className="absolute inset-[10%] rounded border border-dashed border-white/25" />
      {aspect === "9:16" ? <div className={cn("absolute bottom-0 left-0 right-0 h-[22%] bg-danger/15 text-[10px] text-danger/80")}><span className="m-2 inline-block">caption / UI overlap zone (approx.)</span></div> : null}
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/20" /><div className="absolute left-0 top-1/2 h-px w-full bg-white/20" />
    </div>
  );
}
