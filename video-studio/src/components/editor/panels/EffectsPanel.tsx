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
import { DEFAULT_MATTE } from "@/lib/matte-opts";

function FaceFraming() {
  const project = useEditor((s) => s.project)!;
  const vision = useVision();
  const frame = useEditor((s) => s.frame);
  const seek = useSeek();
  const duration = useSourceDuration();
  const faces = project.analysis.faces;
  const r = project.reframe;
  const set = useEditor.getState().setReframe;
  const cover = faces ? Math.round((faces.detected / Math.max(1, faces.total)) * 100) : 0;
  return (
    <Section title="Face-aware framing">
      <p className="text-[11px] leading-relaxed text-mute">Detects the main face (neural detector, 10 samples per second), follows it with a smoothed virtual camera and reframes the video - including 16:9 → 9:16. Without detections the normal centre crop is used.</p>
      <Button className="w-full" variant={faces ? "secondary" : "primary"} disabled={vision.faces.phase === "running" || !project.sourceAssetId} onClick={() => void vision.analyseFaces(project.id)}>{vision.faces.phase === "running" ? "Detecting…" : faces ? "Detect again" : "Detect faces"}</Button>
      {vision.faces.phase === "running" ? <div role="status" className="space-y-1"><div className="h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-accent transition-[width]" style={{ width: `${vision.faces.progress * 100}%` }} /></div><p className="text-[11px] text-mute">{vision.faces.stage}</p></div> : null}
      {vision.faces.phase === "error" ? <p role="alert" className="text-[12px] text-danger">{vision.faces.error}</p> : null}
      {faces ? <div role="status" className={`rounded-md border p-2 text-[11px] ${cover >= 50 ? "border-ok/30 bg-ok/10 text-ok" : "border-warn/30 bg-warn/10 text-warn"}`}>Face found in {faces.detected} of {faces.total} samples ({cover} %). {cover < 50 ? "Low coverage: the camera falls back to the centre crop where no face is found." : "Gaps are bridged or held, then the camera eases back to centre."}</div> : null}
      <Switch label="Follow the face" checked={r.mode === "face"} onChange={(v) => set({ mode: v ? "face" : "off" })} />
      {r.mode === "face" ? (
        <>
          <Slider label="Framing tightness" value={Math.round(r.tightness * 100)} min={15} max={60} onChange={(v) => set({ tightness: v / 100 })} format={(v) => `face = ${v}% of frame height`} />
          <Slider label="Camera smoothness" value={r.smoothMs} min={150} max={2500} step={50} onChange={(v) => set({ smoothMs: v })} format={(v) => `${(v / 1000).toFixed(2)} s`} />
          <div className="space-y-1.5">
            <p className="text-[12px] font-medium">Manual overrides</p>
            <Button size="sm" variant="secondary" onClick={() => { const at = Math.round(seek.sourceNow(frame)); set({ overrides: [...r.overrides, { id: uid("ov_"), startMs: at, endMs: Math.min(duration, at + 2500), x: 0.5, y: 0.45, scale: 1.4 }] }); }}><Plus size={13} /> Add at playhead</Button>
            {r.overrides.map((o) => (
              <div key={o.id} className="space-y-1 rounded-md border border-line p-2">
                <div className="flex items-center justify-between text-[11px]"><span className="tabular-nums">{fmtTime(o.startMs)}–{fmtTime(o.endMs)}</span><Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label="Delete override" onClick={() => set({ overrides: r.overrides.filter((x) => x.id !== o.id) })}><Trash2 size={12} /></Button></div>
                <Slider label="Focus X" value={Math.round(o.x * 100)} min={0} max={100} onChange={(v) => set({ overrides: r.overrides.map((x) => (x.id === o.id ? { ...x, x: v / 100 } : x)) })} format={(v) => `${v}%`} />
                <Slider label="Focus Y" value={Math.round(o.y * 100)} min={0} max={100} onChange={(v) => set({ overrides: r.overrides.map((x) => (x.id === o.id ? { ...x, y: v / 100 } : x)) })} format={(v) => `${v}%`} />
                <Slider label="Zoom" value={Math.round(o.scale * 100)} min={100} max={300} onChange={(v) => set({ overrides: r.overrides.map((x) => (x.id === o.id ? { ...x, scale: v / 100 } : x)) })} format={(v) => `${(v / 100).toFixed(2)}×`} />
                <Slider label="Length" value={o.endMs - o.startMs} min={500} max={10000} step={100} onChange={(v) => set({ overrides: r.overrides.map((x) => (x.id === o.id ? { ...x, endMs: Math.min(duration, x.startMs + v) } : x)) })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
              </div>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-mute">Smart-zoom ranges zoom around the face when this is on. The behind-the-speaker cut-out follows the same camera. Split-screen B-roll uses a plain crop for the speaker, and text that follows a motion track assumes the default crop (use it with this switch off).</p>
        </>
      ) : null}
      {faces ? <Button size="sm" variant="ghost" onClick={() => void vision.removeFaces(project.id)}>Remove face data</Button> : null}
    </Section>
  );
}

function SubjectAndTracking() {
  const project = useEditor((s) => s.project)!;
  const vision = useVision();
  const seg = project.analysis.segmentation;
  const tracks = Object.values(project.analysis.tracks);
  const frame = useEditor((s) => s.frame);
  const seek = useSeek();
  const startMs = Math.round(seek.sourceNow(frame));
  const [label, setLabel] = useState("Tracked region");
  const [mo, setMo] = useState({ ...DEFAULT_MATTE });
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
        {seg ? (
          <div className="space-y-2 rounded-md border border-line p-2">
            <p className="text-[12px] font-medium">Matte edges</p>
            <Switch label="Snap edges to the video (guided filter)" checked={mo.guided} onChange={(v) => setMo({ ...mo, guided: v })} />
            <Slider label="Feather" value={mo.feather} min={0} max={8} step={0.5} onChange={(v) => setMo({ ...mo, feather: v })} format={(v) => `${v} px`} />
            <Slider label="Grow / shrink" value={mo.grow} min={-6} max={6} step={1} onChange={(v) => setMo({ ...mo, grow: v })} format={(v) => (v === 0 ? "off" : v > 0 ? `+${v} px` : `${v} px`)} />
            <Slider label="Temporal smoothing" value={Math.round(mo.temporal * 100)} min={0} max={90} onChange={(v) => setMo({ ...mo, temporal: v / 100 })} format={(v) => `${v}%`} />
            <Button size="sm" variant="secondary" disabled={vision.seg.phase === "running"} onClick={() => void vision.refineMatte(project.id, mo)}>Apply to matte (a few seconds)</Button>
            {seg.params ? <p className="text-[10px] text-mute">Current: feather {seg.params.feather}px · grow {seg.params.grow}px · temporal {Math.round(seg.params.temporal * 100)}% · guided {seg.params.guided ? "on" : "off"}</p> : <p className="text-[10px] text-mute">Older matte: press Analyse again once to enable these controls.</p>}
          </div>
        ) : null}
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
      <FaceFraming />
      <SubjectAndTracking />
      <div className="space-y-3 p-4">
        <Status kind="partial">Not built: face-aware zoom framing, multi-person separation, per-object (non-person) segmentation, 3D object anchoring on tracked planes (tracking is 2D position + scale).</Status>
      </div>
    </div>
  );
}
