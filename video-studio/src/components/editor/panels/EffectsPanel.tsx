"use client";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { suggestZooms } from "@/lib/autozoom";
import { uid } from "@/lib/project";
import { Button, Section, Slider, Status } from "@/components/ui";
import { useSeek, useSourceDuration } from "../context";
import { useState } from "react";
import { fmtTime } from "@/lib/client";

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
      <div className="space-y-3 p-4">
        <Status kind="not-implemented">Subject segmentation, text behind the person, spatial/3D text and motion tracking (milestone 4) are not built. They need real person segmentation and tracking, so no placeholder is offered.</Status>
      </div>
    </div>
  );
}
