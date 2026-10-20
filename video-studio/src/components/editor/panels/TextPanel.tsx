"use client";
import { Plus, Trash2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { newTextLayer, type TextLayer } from "@/lib/project";
import { TITLE_COMPOSITIONS } from "@/lib/titles";
import { sourceToCanvas } from "@/lib/tracking";
import { Button, ColorField, Field, Section, Slider, Status, Switch } from "@/components/ui";
import { useMeta } from "../context";
import { FONT_OPTIONS } from "@/remotion/fontStacks";

export function TextPanel() {
  const project = useEditor((s) => s.project)!;
  const layers = project.textLayers;
  const frame = useEditor((s) => s.frame);
  const meta = useMeta();
  const set = useEditor((s) => s.setTextLayers);
  const total = (meta.durationInFrames * 1000) / meta.fps;
  const hasMask = !!project.analysis.segmentation;
  const tracks = Object.values(project.analysis.tracks);
  const startMs = Math.round((frame * 1000) / meta.fps);
  const endMs = Math.min(total, startMs + 3500);
  const src = project.sourceAssetId ? project.assets[project.sourceAssetId] : undefined;

  const add = () => set((l) => [...l, newTextLayer({ text: "Your title", startMs, endMs })]);
  const addComposition = (id: string) => {
    const c = TITLE_COMPOSITIONS.find((x) => x.id === id)!;
    const track = tracks[tracks.length - 1];
    let made = c.make({ startMs, endMs, text: c.needs === "track" ? "Look here" : "Your title", trackId: track?.id });
    if (c.needs === "track" && track && src?.width && src.height) {
      const p0 = sourceToCanvas(track.points[0][0], track.points[0][1], src.width, src.height, meta.width, meta.height);
      made = made.map((l) => ({ ...l, x: p0.x, y: Math.max(0.05, p0.y - 0.09) }));
    }
    set((l) => [...l, ...made]);
  };

  return (
    <div>
      <Section title="Cinematic title compositions">
        <p className="text-[11px] leading-relaxed text-mute">Ready-made setups combining depth, perspective and motion. They insert normal text layers you can edit below, at the playhead.</p>
        <div className="space-y-2">
          {TITLE_COMPOSITIONS.map((c) => {
            const blocked = (c.needs === "mask" && !hasMask) || (c.needs === "track" && tracks.length === 0);
            return (
              <button key={c.id} disabled={blocked} onClick={() => addComposition(c.id)} className="w-full rounded-lg border border-line bg-panel-2/60 p-2.5 text-left transition-colors hover:border-accent/60 disabled:opacity-45 disabled:hover:border-line">
                <div className="text-[13px] font-medium">{c.name}</div>
                <div className="text-[11px] text-mute">{c.description}</div>
                {blocked ? <div className="mt-1 text-[10px] text-warn">{c.needs === "mask" ? "Needs subject masking: Effects tab → Analyse subject" : "Needs a motion track: Effects tab → Track a region"}</div> : null}
              </button>
            );
          })}
        </div>
      </Section>
      <div className="space-y-4 p-4">
        <Button className="w-full" variant="primary" onClick={add}><Plus size={14} /> Add plain text at playhead</Button>
        {layers.map((t) => <LayerEditor key={t.id} t={t} hasMask={hasMask} tracks={tracks} />)}
        <p className="text-[11px] text-mute">Times are on the final (output) timeline.</p>
        <Status kind="not-implemented">Image layers are not built yet.</Status>
      </div>
    </div>
  );
}

function LayerEditor({ t, hasMask, tracks }: { t: TextLayer; hasMask: boolean; tracks: { id: string; label: string }[] }) {
  const set = useEditor((s) => s.setTextLayers);
  const upd = (patch: Partial<TextLayer>) => set((l) => l.map((x) => (x.id === t.id ? { ...x, ...patch } : x)), `tl:${t.id}`);
  const persp = t.perspective ?? { rotateX: 0, rotateY: 0, rotateZ: 0, depth: 1200 };
  return (
    <div className="space-y-3 rounded-lg border border-line bg-panel-2/60 p-3">
      <div className="flex gap-2">
        <textarea aria-label="Text" dir="auto" rows={2} className="field resize-none" value={t.text} onChange={(e) => upd({ text: e.target.value })} />
        <Button variant="ghost" size="icon" aria-label="Delete text layer" onClick={() => set((l) => l.filter((x) => x.id !== t.id))}><Trash2 size={14} /></Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Start (ms)"><input type="number" step={100} className="field" value={Math.round(t.startMs)} onChange={(e) => upd({ startMs: Math.max(0, Number(e.target.value)) })} /></Field>
        <Field label="End (ms)"><input type="number" step={100} className="field" value={Math.round(t.endMs)} onChange={(e) => upd({ endMs: Math.max(t.startMs + 100, Number(e.target.value)) })} /></Field>
      </div>
      <Field label="Font"><select className="field" value={t.fontFamily} onChange={(e) => upd({ fontFamily: e.target.value })}>{FONT_OPTIONS.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}</select></Field>
      <Slider label="Size" value={t.fontSize} min={24} max={400} onChange={(v) => upd({ fontSize: v })} />
      <Slider label="Letter spacing" value={t.letterSpacing} min={-0.05} max={0.6} step={0.01} onChange={(v) => upd({ letterSpacing: v })} format={(v) => `${v.toFixed(2)} em`} />
      <Field label="Text case"><select className="field" value={t.textTransform} onChange={(e) => upd({ textTransform: e.target.value as TextLayer["textTransform"] })}><option value="none">As typed</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Capitalize</option></select></Field>
      <Slider label="Horizontal" value={Math.round(t.x * 100)} min={0} max={100} onChange={(v) => upd({ x: v / 100 })} format={(v) => `${v}%`} />
      <Slider label="Vertical" value={Math.round(t.y * 100)} min={0} max={100} onChange={(v) => upd({ y: v / 100 })} format={(v) => `${v}%`} />
      <div className="grid grid-cols-2 gap-2"><ColorField label="Colour" value={t.color} onChange={(v) => upd({ color: v })} /><ColorField label="Background" value={t.backgroundColor} onChange={(v) => upd({ backgroundColor: v })} /></div>
      <div className="grid grid-cols-2 items-end gap-2"><ColorField label="Stroke" value={t.strokeColor} onChange={(v) => upd({ strokeColor: v })} /><Slider label="Stroke width" value={t.strokeWidth} min={0} max={30} step={0.5} onChange={(v) => upd({ strokeWidth: v })} /></div>
      <Field label="Entrance animation">
        <select className="field" value={t.animation} onChange={(e) => upd({ animation: e.target.value as TextLayer["animation"] })}><option value="none">None</option><option value="fade-up">Fade up</option><option value="tracking-in">Tracking in</option><option value="scale-in">Spring scale-in</option><option value="mask-reveal">Mask reveal</option></select>
      </Field>
      {t.animation !== "none" ? <Slider label="Animation duration" value={t.animMs} min={150} max={2500} step={50} onChange={(v) => upd({ animMs: v })} format={(v) => `${v} ms`} /> : null}

      <Switch label="Perspective (3D)" checked={!!t.perspective} onChange={(on) => upd({ perspective: on ? { rotateX: 45, rotateY: 0, rotateZ: 0, depth: 1000 } : null })} />
      {t.perspective ? (
        <>
          <Slider label="Tilt (X)" value={persp.rotateX} min={-80} max={80} onChange={(v) => upd({ perspective: { ...persp, rotateX: v } })} format={(v) => `${v}°`} />
          <Slider label="Turn (Y)" value={persp.rotateY} min={-80} max={80} onChange={(v) => upd({ perspective: { ...persp, rotateY: v } })} format={(v) => `${v}°`} />
          <Slider label="Roll (Z)" value={persp.rotateZ} min={-180} max={180} onChange={(v) => upd({ perspective: { ...persp, rotateZ: v } })} format={(v) => `${v}°`} />
          <Slider label="Depth (lower = stronger)" value={persp.depth} min={300} max={3000} step={50} onChange={(v) => upd({ perspective: { ...persp, depth: v } })} />
        </>
      ) : null}

      <Switch label="Behind the speaker" checked={t.behind && hasMask} onChange={(v) => upd({ behind: v })} />
      {!hasMask ? <p className="text-[10px] text-warn">Needs subject masking - Effects tab → “Analyse subject”.</p> : null}
      <Field label="Follow motion track">
        <select className="field" value={t.trackId ?? ""} onChange={(e) => upd({ trackId: e.target.value || null })}>
          <option value="">Fixed position</option>
          {tracks.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
      </Field>
      {t.trackId ? <Switch label="Scale with the tracked region" checked={t.trackScale} onChange={(v) => upd({ trackScale: v })} /> : null}
    </div>
  );
}
