"use client";
import { Plus, Trash2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { newTextLayer, type TextLayer } from "@/lib/project";
import { TITLE_COMPOSITIONS } from "@/lib/titles";
import { sourceToCanvas } from "@/lib/tracking";
import { canvasToSource, sceneToScreen } from "@/lib/spatial";
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
  const src = useEditor((s) => (s.project?.sourceAssetId ? s.project.assets[s.project.sourceAssetId] : undefined));
  const meta = useMeta();
  const geo = src?.width && src.height ? { srcW: src.width, srcH: src.height, outW: meta.width, outH: meta.height } : null;
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

      <div className="space-y-2 rounded-md border border-line p-2">
        <p className="text-[12px] font-medium">Motion graphics <span className="text-[10px] font-normal text-mute">(2D / 2.5D, not 3D geometry)</span></p>
        <Switch label="Text on a circle" checked={!!t.path} onChange={(on) => upd({ path: on ? { radius: 0.3, startDeg: -90, sweepDeg: 0, direction: "cw", inside: false, spinDegPerSec: 0 } : null })} />
        {t.path ? (
          <>
            <Slider label="Radius" value={Math.round(t.path.radius * 100)} min={8} max={70} onChange={(v) => upd({ path: { ...t.path!, radius: v / 100 } })} format={(v) => `${v}% of short side`} />
            <Slider label="Start angle" value={t.path.startDeg} min={-180} max={180} step={5} onChange={(v) => upd({ path: { ...t.path!, startDeg: v } })} format={(v) => `${v}°`} />
            <Slider label="Spread over" value={t.path.sweepDeg} min={0} max={360} step={5} onChange={(v) => upd({ path: { ...t.path!, sweepDeg: v } })} format={(v) => (v === 0 ? "natural spacing" : `${v}°`)} />
            <Slider label="Spin" value={t.path.spinDegPerSec} min={-180} max={180} step={5} onChange={(v) => upd({ path: { ...t.path!, spinDegPerSec: v } })} format={(v) => `${v}°/s`} />
            <div className="flex gap-3"><Switch label="Counter-clockwise" checked={t.path.direction === "ccw"} onChange={(v) => upd({ path: { ...t.path!, direction: v ? "ccw" : "cw" } })} /><Switch label="Inside" checked={t.path.inside} onChange={(v) => upd({ path: { ...t.path!, inside: v } })} /></div>
          </>
        ) : null}
        <Field label="Shatter">
          <select className="field" value={t.shatter?.mode ?? ""} onChange={(e) => upd({ shatter: e.target.value ? { mode: e.target.value as "in" | "out" | "both", durationMs: t.shatter?.durationMs ?? 800, spread: t.shatter?.spread ?? 0.8, detail: t.shatter?.detail ?? "medium", seed: t.shatter?.seed ?? 1 } : null })}>
            <option value="">Off</option><option value="out">Break apart at the end</option><option value="in">Assemble from shards</option><option value="both">Both</option>
          </select>
        </Field>
        {t.shatter ? (
          <>
            <Slider label="Break time" value={t.shatter.durationMs} min={200} max={2000} step={50} onChange={(v) => upd({ shatter: { ...t.shatter!, durationMs: v } })} format={(v) => `${v} ms`} />
            <Slider label="Spread" value={Math.round(t.shatter.spread * 100)} min={10} max={150} onChange={(v) => upd({ shatter: { ...t.shatter!, spread: v / 100 } })} format={(v) => `${v}%`} />
            <Field label="Shard count"><select className="field" value={t.shatter.detail} onChange={(e) => upd({ shatter: { ...t.shatter!, detail: e.target.value as "low" | "medium" | "high" } })}><option value="low">12 pieces</option><option value="medium">60 pieces</option><option value="high">128 pieces</option></select></Field>
            <Slider label="Pattern" value={t.shatter.seed} min={0} max={50} onChange={(v) => upd({ shatter: { ...t.shatter!, seed: v } })} format={(v) => `#${v}`} />
          </>
        ) : null}
        <Switch label="Pin to the scene (follows camera)" checked={t.anchor === "scene"} onChange={(on) => {
          if (!geo) return upd({ anchor: on ? "scene" : "screen" });
          if (on) { const p = canvasToSource(t.x, t.y, geo); upd({ anchor: "scene", x: p.x, y: p.y }); }
          else { const s = sceneToScreen({ px: t.x, py: t.y, geo, parallax: 1 }); upd({ anchor: "screen", x: Math.min(1, Math.max(0, s.x)), y: Math.min(1, Math.max(0, s.y)) }); }
        }} />
        {t.anchor === "scene" ? <><Slider label="Depth (parallax)" value={Math.round(t.parallax * 100)} min={0} max={100} onChange={(v) => upd({ parallax: v / 100 })} format={(v) => (v === 100 ? "locked to picture" : v === 0 ? "fixed on screen" : `${v}%`)} /><p className="text-[10px] text-mute">Position now refers to the picture, so it follows smart zoom and the face-aware camera. A 2D projection - no true 3D scene.</p></> : null}
      </div>

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
