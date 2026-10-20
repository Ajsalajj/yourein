"use client";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { suggestZooms } from "@/lib/autozoom";
import { uid } from "@/lib/project";
import { Button, Section, Slider, Status, Switch } from "@/components/ui";
import { useVision } from "@/store/vision";
import { useSeek, useSourceDuration } from "../context";
import { useState } from "react";
import { fmtTime } from "@/lib/client";

function SubjectAndTracking() {
  const project = useEditor((s) => s.project)!;
  const vision = useVision();
  const seg = project.analysis.segmentation;
  const tracks = Object.values(project.analysis.tracks);
  const frame = useEditor((s) => s.frame);
  const seek = useSeek();
  const startMs = Math.round(seek.sourceNow(frame));
  const [label, setLabel] = useState("Tracked region");
  return (
    <>
      <Section title="Subject masking (behind the speaker)">
        <p className="text-[11px] leading-relaxed text-mute">Runs a neural person-segmentation model on every frame and stores an alpha matte. Text marked <b>behind the speaker</b> is drawn between the video and a cut-out copy of the person.</p>
        {seg ? (
          <div className="rounded-md border border-ok/30 bg-ok/10 p-2 text-[11px] text-ok" role="status">Matte ready: {seg.frames} frames at {seg.width}×{seg.height}<br /><span className="text-mute">{seg.method}</span></div>
        ) : null}
        <Button className="w-full" variant={seg ? "secondary" : "primary"} disabled={vision.seg.phase === "running" || !project.sourceAssetId} onClick={() => void vision.segment(project.id)}>{vision.seg.phase === "running" ? "Analysing…" : seg ? "Analyse again" : "Analyse subject"}</Button>
        {vision.seg.phase === "running" ? <div role="status" className="space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent transition-[width]" style={{ width: `${vision.seg.progress * 100}%` }} /></div><p className="text-[11px] text-mute">{vision.seg.stage}</p></div> : null}
        {vision.seg.phase === "error" ? <p role="alert" className="text-[12px] text-danger">{vision.seg.error}</p> : null}
        <Switch label="Captions behind the speaker" checked={project.captionsBehindSubject && !!seg} onChange={(v) => useEditor.getState().commit((p) => ({ ...p, captionsBehindSubject: v && !!p.analysis.segmentation }))} />
        {!seg ? <p className="text-[10px] text-mute">Enable after analysis. Per-layer “Behind the speaker” is in the Text tab.</p> : <Button size="sm" variant="ghost" onClick={() => void vision.removeSegmentation(project.id)}>Remove matte</Button>}
        <p className="text-[10px] leading-snug text-mute">Quality note: the model is small (256×256) and works best for a single, clearly visible person; hair and hands can be soft and props held in front may be partly missed.</p>
      </Section>
      <Section title="Motion tracking">
        <p className="text-[11px] leading-relaxed text-mute">Drag a box on the preview around something with visible detail. Lucas-Kanade optical flow follows it (position and scale) from the playhead to the end of the video.</p>
        <Button className="w-full" variant={vision.picking ? "primary" : "secondary"} onClick={() => vision.setPicking(!vision.picking)}>{vision.picking ? "Drag a box on the preview…" : "Pick region on preview"}</Button>
        {vision.roi ? (
          <div className="space-y-2 rounded-md border border-line bg-panel-2 p-2 text-[11px]">
            <p>Region {Math.round(vision.roi.w * 100)}% × {Math.round(vision.roi.h * 100)}% of the frame, tracked from {fmtTime(startMs)}.</p>
            <input className="field" aria-label="Track name" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Button className="w-full" variant="primary" disabled={vision.track.phase === "running"} onClick={() => void vision.trackRegion(project.id, vision.roi!, startMs, label)}>{vision.track.phase === "running" ? "Tracking…" : "Track from here"}</Button>
          </div>
        ) : null}
        {vision.track.phase === "running" ? <p role="status" className="text-[11px] text-mute">{vision.track.stage}</p> : null}
        {vision.track.phase === "error" ? <p role="alert" className="text-[12px] text-danger">{vision.track.error}</p> : null}
        <ul className="space-y-1.5">
          {tracks.map((k) => (
            <li key={k.id} className="flex items-center gap-2 rounded-md border border-line px-2 py-1.5 text-[12px]"><span className="flex-1 truncate">{k.label} <span className="text-mute">· {k.points.length} frames</span></span><Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label={`Delete track ${k.label}`} onClick={() => void vision.removeTrack(project.id, k.id)}><Trash2 size={12} /></Button></li>
          ))}
        </ul>
        {tracks.length ? <p className="text-[10px] text-mute">Attach a text layer to a track in the Text tab (“Follow motion track”) or use the “Motion-tracked callout” composition.</p> : null}
      </Section>
    </>
  );
}

export function EffectsPanel() {
  const zooms = useEditor((s) => s.project!.zooms);
  const captions = useEditor((s) => s.project!.captions);
  const frame = useEditor((s) => s.frame);
  const sel = useEditor((s) => s.selection.zoomId);
  const setZooms = useEditor((s) => s.setZooms);
  const dur = useSourceDuration();
  const seek = useSeek();
  const [intensity, setIntensity] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const now = seek.sourceNow(frame);

  const suggest = () => {
    const found = suggestZooms(captions, dur, { intensity });
    setZooms((z) => [...z.filter((q) => q.source === "manual"), ...found]);
    setMsg(found.length ? `Added ${found.length} suggested zooms (replacing earlier automatic ones). Drag, resize or delete any of them.` : "No good zoom moments found - captions are needed first.");
  };
  return (
    <div>
      <Section title="Smart zoom (auto)">
        <p className="text-[11px] leading-relaxed text-mute">Suggests punch-ins at new sentences, after pauses and on slowly-spoken emphasised words, using the transcript. Face tracking is not available, so the zoom centres on the frame (adjust focus per zoom).</p>
        <Slider label="Intensity" value={intensity} min={0.3} max={2} step={0.1} onChange={setIntensity} format={(v) => `${v.toFixed(1)}×`} />
        <Button className="w-full" variant="primary" disabled={!captions.length} onClick={suggest}><Wand2 size={14} /> Suggest zooms</Button>
        {msg ? <p role="status" className="text-[11px] text-mute">{msg}</p> : null}
      </Section>
      <Section title="Zooms" right={<Button size="sm" onClick={() => { const id = uid("z_"); setZooms((z) => [...z, { id, startMs: now, endMs: Math.min(dur, now + 2000), scale: 1.25, focusX: 0.5, focusY: 0.45, rampMs: 350, source: "manual" }]); useEditor.getState().select({ zoomId: id }); }}><Plus size={13} /> At playhead</Button>}>
        {zooms.length === 0 ? <p className="text-[12px] text-mute">No zooms. Add one, or drag a range on the timeline’s video lane and choose “Zoom range”.</p> : null}
        <ul className="space-y-1.5">
          {[...zooms].sort((a, b) => a.startMs - b.startMs).map((z) => (
            <li key={z.id} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[12px] ${sel === z.id ? "border-accent-2 bg-accent-2/10" : "border-line"}`}>
              <button className="flex-1 text-left" onClick={() => { useEditor.getState().select({ zoomId: z.id, captionId: null }); seek.fromSource(z.startMs); }}>{fmtTime(z.startMs)} · {z.scale.toFixed(2)}× {z.source === "auto" ? <span className="text-accent-2">auto</span> : null}</button>
              <Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label="Delete zoom" onClick={() => setZooms((q) => q.filter((x) => x.id !== z.id))}><Trash2 size={12} /></Button>
            </li>
          ))}
        </ul>
        {zooms.length ? <Button size="sm" variant="ghost" onClick={() => setZooms(() => [])}>Remove all zooms</Button> : null}
      </Section>
      <SubjectAndTracking />
      <div className="space-y-3 p-4">
        <Status kind="partial">Not built: face-aware zoom framing, multi-person separation, per-object (non-person) segmentation, 3D object anchoring on tracked planes (tracking is 2D position + scale).</Status>
      </div>
    </div>
  );
}
