"use client";
import { useEditor } from "@/store/editor";
import { BEHAVIORS } from "@/remotion/animations/behaviors";
import { TEMPLATES, getTemplate } from "@/remotion/templates/registry";
import { FONT_OPTIONS, primaryFamily, stack } from "@/remotion/fontStacks";
import type { StyleProps } from "@/lib/project";
import { Button, ColorField, Field, Section, Slider, Switch } from "@/components/ui";
import { fmtTime } from "@/lib/client";

export function RightPanel() {
  const project = useEditor((s) => s.project)!;
  const sel = useEditor((s) => s.selection);
  const setStyle = useEditor((s) => s.setStyle);
  const tpl = getTemplate(project.captionStyle.templateId);
  const st: StyleProps = { ...tpl.style, ...project.captionStyle.overrides };
  const cap = sel.captionId ? project.captions.find((c) => c.id === sel.captionId) : null;
  const zoom = sel.zoomId ? project.zooms.find((z) => z.id === sel.zoomId) : null;
  const family = FONT_OPTIONS.find((f) => f.family === primaryFamily(st.fontFamily));
  const pos = cap?.position ?? project.captionStyle.position;
  const setPos = (p: Partial<{ x: number; y: number }>) => (cap ? useEditor.getState().patchCaption(cap.id, { position: { ...pos, ...p } }) : useEditor.getState().setPosition({ ...pos, ...p }));

  return (
    <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-line bg-panel" aria-label="Properties">
      {cap ? (
        <Section title="Selected caption" right={<span className="text-[10px] tabular-nums text-mute">{fmtTime(cap.startMs)}–{fmtTime(cap.endMs)}</span>}>
          <Field label="Template for this caption only">
            <select className="field" value={cap.styleId ?? ""} onChange={(e) => useEditor.getState().patchCaption(cap.id, { styleId: e.target.value || null })}>
              <option value="">Project default ({tpl.name})</option>
              {TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          <Field label="Animation for this caption only">
            <select className="field" value={cap.animationId ?? ""} onChange={(e) => useEditor.getState().patchCaption(cap.id, { animationId: e.target.value || null })}>
              <option value="">Template’s own animation</option>
              {BEHAVIORS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          {cap.position ? <Button size="sm" variant="ghost" onClick={() => useEditor.getState().patchCaption(cap.id, { position: null })}>Use project position</Button> : null}
        </Section>
      ) : null}

      {zoom ? (
        <Section title="Selected zoom">
          <Slider label="Zoom" value={zoom.scale} min={1} max={2.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(v) => useEditor.getState().setZooms((z) => z.map((q) => (q.id === zoom.id ? { ...q, scale: v } : q)), "zoomprop")} />
          <Slider label="Focus X" value={Math.round(zoom.focusX * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => useEditor.getState().setZooms((z) => z.map((q) => (q.id === zoom.id ? { ...q, focusX: v / 100 } : q)), "zoomprop")} />
          <Slider label="Focus Y" value={Math.round(zoom.focusY * 100)} min={0} max={100} format={(v) => `${v}%`} onChange={(v) => useEditor.getState().setZooms((z) => z.map((q) => (q.id === zoom.id ? { ...q, focusY: v / 100 } : q)), "zoomprop")} />
          <Slider label="Ease in/out" value={zoom.rampMs} min={0} max={1500} step={50} format={(v) => `${v} ms`} onChange={(v) => useEditor.getState().setZooms((z) => z.map((q) => (q.id === zoom.id ? { ...q, rampMs: v } : q)), "zoomprop")} />
        </Section>
      ) : null}

      <Section title={`Typography · ${tpl.name}`}>
        <Field label="Font">
          <select className="field" value={primaryFamily(st.fontFamily)} onChange={(e) => { const f = FONT_OPTIONS.find((o) => o.family === e.target.value)!; const w = f.weights.reduce((a, b) => (Math.abs(b - st.fontWeight) < Math.abs(a - st.fontWeight) ? b : a)); setStyle({ fontFamily: stack(f.family), fontWeight: w }); }}>
            {FONT_OPTIONS.map((f) => <option key={f.family} value={f.family}>{f.label}{f.scripts.includes("malayalam") ? " · Malayalam" : f.scripts.includes("devanagari") ? " · Hindi" : f.scripts.includes("tamil") ? " · Tamil" : ""}</option>)}
          </select>
        </Field>
        <Field label="Weight"><select className="field" value={st.fontWeight} onChange={(e) => setStyle({ fontWeight: Number(e.target.value) })}>{(family?.weights ?? [400, 700]).map((w) => <option key={w} value={w}>{w}</option>)}</select></Field>
        <Slider label="Size" value={st.fontSize} min={24} max={200} onChange={(v) => setStyle({ fontSize: v })} format={(v) => `${v}px`} />
        <Slider label="Letter spacing" value={st.letterSpacing} min={-0.05} max={0.4} step={0.01} onChange={(v) => setStyle({ letterSpacing: v })} format={(v) => `${v.toFixed(2)} em`} />
        <Slider label="Line height" value={st.lineHeight} min={0.8} max={1.8} step={0.05} onChange={(v) => setStyle({ lineHeight: v })} format={(v) => v.toFixed(2)} />
        <Field label="Text case"><select className="field" value={st.textTransform ?? (st.uppercase ? "uppercase" : "none")} onChange={(e) => setStyle({ textTransform: e.target.value as NonNullable<StyleProps["textTransform"]> })}><option value="none">As spoken</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Capitalize Each Word</option></select></Field>
        <Switch label="Italic" checked={st.italic} onChange={(v) => setStyle({ italic: v })} />
        <Field label="Alignment"><select className="field" value={st.align} onChange={(e) => setStyle({ align: e.target.value as StyleProps["align"] })}><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></Field>
        <p className="text-[10px] leading-snug text-mute">Letter spacing and text case are skipped automatically for Malayalam, Hindi and Tamil, where they would break joined letters.</p>
      </Section>

      <Section title="Colours & outline">
        <div className="grid grid-cols-2 gap-3"><ColorField label="Text" value={st.color} onChange={(v) => setStyle({ color: v })} /><ColorField label="Highlight" value={st.highlightColor} onChange={(v) => setStyle({ highlightColor: v })} /></div>
        <ColorField label="Background (box styles)" value={st.backgroundColor} onChange={(v) => setStyle({ backgroundColor: v })} />
        <div className="grid grid-cols-2 gap-3 items-end"><ColorField label="Stroke" value={st.strokeColor} onChange={(v) => setStyle({ strokeColor: v })} /><Slider label="Stroke width" value={st.strokeWidth} min={0} max={20} step={0.5} onChange={(v) => setStyle({ strokeWidth: v })} /></div>
        <Switch label="Shadow" checked={!!st.shadow} onChange={(on) => setStyle({ shadow: on ? { color: "rgba(0,0,0,0.6)", blur: 14, offsetX: 0, offsetY: 4 } : null })} />
        {st.shadow ? (
          <>
            <ColorField label="Shadow colour" value={st.shadow.color} onChange={(v) => setStyle({ shadow: { ...st.shadow!, color: v } })} />
            <Slider label="Blur" value={st.shadow.blur} min={0} max={50} onChange={(v) => setStyle({ shadow: { ...st.shadow!, blur: v } })} />
            <Slider label="Offset Y" value={st.shadow.offsetY} min={-20} max={30} onChange={(v) => setStyle({ shadow: { ...st.shadow!, offsetY: v } })} />
          </>
        ) : null}
      </Section>

      <Section title="Animation">
        <Slider label="Enter duration" value={st.animationDurationMs} min={80} max={1500} step={20} onChange={(v) => setStyle({ animationDurationMs: v })} format={(v) => `${v} ms`} />
        <Slider label="Exit duration" value={st.exitMs ?? 200} min={0} max={1000} step={20} onChange={(v) => setStyle({ exitMs: v })} format={(v) => `${v} ms${st.exitMs === undefined ? " (auto)" : ""}`} />
        <Slider label="Overall intensity" value={st.intensity} min={0} max={2} step={0.05} onChange={(v) => setStyle({ intensity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Scale intensity" value={st.scaleIntensity ?? 1} min={0} max={2} step={0.05} onChange={(v) => setStyle({ scaleIntensity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Animation offset" value={st.offsetMs ?? 0} min={-300} max={300} step={10} onChange={(v) => setStyle({ offsetMs: v })} format={(v) => `${v > 0 ? "+" : ""}${v} ms${v < 0 ? " (leads speech)" : ""}`} />
        <Slider label="Highlight duration" value={st.highlightMs ?? 200} min={0} max={800} step={20} onChange={(v) => setStyle({ highlightMs: v })} format={(v) => `${v} ms`} />
        <Field label="Transition easing"><select className="field" value={st.easing ?? "cubic"} onChange={(e) => setStyle({ easing: e.target.value as NonNullable<StyleProps["easing"]> })}><option value="cubic">Ease-out cubic</option><option value="expo">Ease-out expo (snappy)</option><option value="sine">Ease-out sine (gentle)</option><option value="back">Ease-out back (overshoot)</option><option value="linear">Linear</option></select></Field>
        <Switch label="Custom spring" checked={st.springStiffness !== undefined} onChange={(on) => setStyle(on ? { springStiffness: 140, springDamping: 12 } : { springStiffness: undefined, springDamping: undefined })} />
        {st.springStiffness !== undefined ? (
          <>
            <Slider label="Spring stiffness" value={st.springStiffness} min={20} max={600} step={10} onChange={(v) => setStyle({ springStiffness: v })} />
            <Slider label="Spring damping" value={st.springDamping ?? 12} min={2} max={60} step={1} onChange={(v) => setStyle({ springDamping: v })} />
          </>
        ) : <p className="text-[10px] text-mute">Springs use each preset’s designed stiffness/damping. Turn on to override all of them.</p>}
        <Button size="sm" variant="ghost" onClick={() => setStyle({ exitMs: undefined, scaleIntensity: undefined, offsetMs: undefined, highlightMs: undefined, easing: undefined, springStiffness: undefined, springDamping: undefined })}>Reset motion to preset</Button>
      </Section>

      <Section title="Layout">
        <Slider label="Max words per line" value={st.maxWordsPerLine} min={1} max={8} onChange={(v) => setStyle({ maxWordsPerLine: v })} />
        <Slider label="Max visible lines" value={st.maxLines} min={1} max={4} onChange={(v) => setStyle({ maxLines: v })} />
        <Slider label="Words per caption group" value={st.wordsPerGroup} min={1} max={12} onChange={(v) => setStyle({ wordsPerGroup: v })} />
        <Button size="sm" onClick={() => useEditor.getState().regroup()} disabled={!project.captions.length}>Apply grouping to captions</Button>
      </Section>

      <Section title={cap ? "Position (this caption)" : "Position (all captions)"}>
        <Slider label="Horizontal" value={Math.round(pos.x * 100)} min={5} max={95} onChange={(v) => setPos({ x: v / 100 })} format={(v) => `${v}%`} />
        <Slider label="Vertical" value={Math.round(pos.y * 100)} min={5} max={95} onChange={(v) => setPos({ y: v / 100 })} format={(v) => `${v}%`} />
        <Button size="sm" variant="ghost" onClick={() => { useEditor.getState().setPosition(tpl.position); if (cap) useEditor.getState().patchCaption(cap.id, { position: null }); }}>Reset position</Button>
      </Section>
    </aside>
  );
}
