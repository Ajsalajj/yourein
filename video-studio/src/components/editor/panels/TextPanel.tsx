"use client";
import { Plus, Trash2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { uid } from "@/lib/project";
import { Button, ColorField, Field, Slider, Status } from "@/components/ui";
import { useMeta } from "../context";
import { FONT_OPTIONS } from "@/remotion/fontStacks";

export function TextPanel() {
  const layers = useEditor((s) => s.project!.textLayers);
  const frame = useEditor((s) => s.frame);
  const meta = useMeta();
  const set = useEditor((s) => s.setTextLayers);
  const total = (meta.durationInFrames * 1000) / meta.fps;
  const add = () => {
    const start = Math.round((frame * 1000) / meta.fps);
    set((l) => [...l, { id: uid("t_"), text: "Your title", startMs: start, endMs: Math.min(total, start + 3000), x: 0.5, y: 0.2, fontSize: 90, color: "#ffffff", fontFamily: "Poppins", fontWeight: 700, backgroundColor: "transparent" }]);
  };
  return (
    <div className="space-y-4 p-4">
      <Button className="w-full" variant="primary" onClick={add}><Plus size={14} /> Add text at playhead</Button>
      {layers.map((t) => {
        const upd = (patch: Partial<typeof t>) => set((l) => l.map((x) => (x.id === t.id ? { ...x, ...patch } : x)), `tl:${t.id}`);
        return (
          <div key={t.id} className="space-y-3 rounded-lg border border-line bg-panel-2/60 p-3">
            <div className="flex gap-2">
              <textarea aria-label="Text" dir="auto" rows={2} className="field resize-none" value={t.text} onChange={(e) => upd({ text: e.target.value })} />
              <Button variant="ghost" size="icon" aria-label="Delete text layer" onClick={() => set((l) => l.filter((x) => x.id !== t.id))}><Trash2 size={14} /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start (ms)"><input type="number" step={100} className="field" value={Math.round(t.startMs)} onChange={(e) => upd({ startMs: Math.max(0, Number(e.target.value)) })} /></Field>
              <Field label="End (ms)"><input type="number" step={100} className="field" value={Math.round(t.endMs)} onChange={(e) => upd({ endMs: Math.max(t.startMs + 100, Number(e.target.value)) })} /></Field>
            </div>
            <Field label="Font"><select className="field" value={t.fontFamily} onChange={(e) => upd({ fontFamily: e.target.value })}>{FONT_OPTIONS.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}</select></Field>
            <Slider label="Size" value={t.fontSize} min={24} max={240} onChange={(v) => upd({ fontSize: v })} />
            <Slider label="Horizontal" value={Math.round(t.x * 100)} min={0} max={100} onChange={(v) => upd({ x: v / 100 })} format={(v) => `${v}%`} />
            <Slider label="Vertical" value={Math.round(t.y * 100)} min={0} max={100} onChange={(v) => upd({ y: v / 100 })} format={(v) => `${v}%`} />
            <div className="grid grid-cols-2 gap-2"><ColorField label="Colour" value={t.color} onChange={(v) => upd({ color: v })} /><ColorField label="Background" value={t.backgroundColor} onChange={(v) => upd({ backgroundColor: v })} /></div>
          </div>
        );
      })}
      <p className="text-[11px] text-mute">Times are on the final (output) timeline.</p>
      <Status kind="not-implemented">Image layers are not built yet. Text layers are plain, non-animated titles; animated text uses the caption engine.</Status>
    </div>
  );
}
