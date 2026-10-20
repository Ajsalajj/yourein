"use client";
import { useState } from "react";
import { useEditor } from "@/store/editor";
import { TemplateGallery } from "@/components/TemplateGallery";
import { getTemplate } from "@/remotion/templates/registry";
import { FONT_OPTIONS, primaryFamily, stack } from "@/remotion/fontStacks";
import { Button, ColorField, Field, Section, Slider, Switch } from "@/components/ui";

export function TemplatesPanel() {
  const style = useEditor((s) => s.project!.captionStyle);
  const selected = useEditor((s) => s.selection.captionId);
  const apply = useEditor((s) => s.applyTemplate);
  const setStyle = useEditor((s) => s.setStyle);
  const [mine, setMine] = useState(false);
  const tpl = getTemplate(style.templateId);
  const st = { ...tpl.style, ...style.overrides };
  return (
    <div>
      <Section title="Customize the current style">
        <Field label="Font">
          <select className="field" value={primaryFamily(st.fontFamily)} onChange={(e) => { const f = FONT_OPTIONS.find((o) => o.family === e.target.value)!; const w = f.weights.reduce((a, b) => (Math.abs(b - st.fontWeight) < Math.abs(a - st.fontWeight) ? b : a)); setStyle({ fontFamily: stack(f.family), fontWeight: w }); }}>
            {FONT_OPTIONS.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3"><ColorField label="Text" value={st.color} onChange={(v) => setStyle({ color: v })} /><ColorField label="Highlight" value={st.highlightColor} onChange={(v) => setStyle({ highlightColor: v })} /></div>
        <Slider label="Animation intensity" value={st.intensity} min={0} max={2} step={0.05} onChange={(v) => setStyle({ intensity: v })} format={(v) => `${Math.round(v * 100)}%`} />
        <Switch label="Show my font, colours & intensity in the previews" checked={mine} onChange={setMine} />
      </Section>
      <div className="space-y-3 p-4">
        <p className="text-[12px] text-mute">Click a template to apply it to <b>all captions</b> immediately. Current: <b className="text-text">{tpl.name}</b></p>
        {selected ? <p className="rounded-md bg-panel-2 p-2 text-[11px] text-mute">A caption is selected - use “Selected caption” in the right panel to give just that caption its own template.</p> : null}
        <TemplateGallery activeId={style.templateId} onPick={(t) => apply(t.id)} columns="grid-cols-2" previewOverrides={mine ? { fontFamily: st.fontFamily, fontWeight: st.fontWeight, color: st.color, highlightColor: st.highlightColor, intensity: st.intensity } : undefined} />
        <Button size="sm" variant="ghost" onClick={() => apply(style.templateId)}>Reset style overrides</Button>
      </div>
    </div>
  );
}
