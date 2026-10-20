"use client";
import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { useEditor } from "@/store/editor";
import { usePrefs } from "@/store/prefs";
import { useUi } from "@/store/ui";
import { uid } from "@/lib/project";
import { uploadFile } from "@/lib/client";
import { validateUpload } from "@/lib/upload";
import { DEFAULT_EMPHASIS, diffStyle, type Gradient, type ShadowLayer, type WordStyle } from "@/lib/wordstyle";
import { BEHAVIORS } from "@/remotion/animations/behaviors";
import { FONT_OPTIONS, primaryFamily, stack } from "@/remotion/fontStacks";
import { getTemplate } from "@/remotion/templates/registry";
import { LOOKS } from "@/remotion/templates/looks";
import { Badge, Button, ColorField, Field, Section, Slider, Switch } from "@/components/ui";
import { cn } from "@/lib/cn";

type Scope = "word" | "all" | "active" | "keywords";
const SCOPES: { id: Scope; label: string; hint: string }[] = [
  { id: "word", label: "Selected word", hint: "Only the clicked word. Survives text corrections and saves." },
  { id: "all", label: "All words", hint: "The base look of every word in every caption." },
  { id: "active", label: "Spoken word", hint: "Extra look for the word being spoken (paint only, so layout never shifts)." },
  { id: "keywords", label: "Keywords", hint: "Look for emphasised keywords (auto-picked or forced per word)." },
];

const DEFAULT_GRADIENT: Gradient = { angle: 180, size: 100, animate: "none", speed: 0, shine: null, stops: [{ color: "#ffffff", pos: 0 }, { color: "#f8d53a", pos: 1 }] };
const BUILT_IN: { name: string; style: WordStyle }[] = [
  { name: "Neon cyan", style: LOOKS.neonCyan },
  { name: "Pink gradient", style: LOOKS.pinkPop },
  { name: "Rainbow shine", style: LOOKS.rainbow },
  { name: "Chrome", style: { ...LOOKS.chrome, fontStyle: "italic" } },
  { name: "Gold 3D", style: LOOKS.gold },
  { name: "Purple 3D", style: LOOKS.purple3d },
  { name: "Green italic keyword", style: LOOKS.greenItalic },
  { name: "Deep red extrusion", style: LOOKS.deepExtrude },
  { name: "Heavy white", style: LOOKS.heavyWhite },
  { name: "Golden headline", style: LOOKS.headlineYellow },
];

export function TypographyPanel() {
  const project = useEditor((s) => s.project)!;
  const sel = useEditor((s) => s.selection);
  const [scope, setScope] = useState<Scope>(sel.wordId ? "word" : "all");
  const tpl = getTemplate(project.captionStyle.templateId);
  const base = { ...tpl.style, ...project.captionStyle.overrides };
  const caption = sel.captionId ? project.captions.find((c) => c.id === sel.captionId) : project.captions.find((c) => c.words.some((w) => w.id === sel.wordId));
  const word = sel.wordId ? project.captions.flatMap((c) => c.words).find((w) => w.id === sel.wordId) : undefined;
  const effScope: Scope = scope === "word" && !word ? "all" : scope;

  const layer = effScope === "all" ? "look" : effScope === "active" ? "activeLook" : effScope === "keywords" ? "emphasisLook" : null;
  const value: WordStyle = effScope === "word" ? project.wordStyles[word!.id] ?? {} : ((base[layer!] as WordStyle | undefined) ?? {});
  const set = (patch: WordStyle) => (effScope === "word" ? useEditor.getState().setWordStyle(word!.id, patch) : useEditor.getState().setLook(layer!, patch));
  const reset = () => (effScope === "word" ? useEditor.getState().replaceWordStyle(word!.id, null) : useEditor.getState().setLook(layer!, null));

  return (
    <div>
      <Section title="What are you styling?">
        <div className="grid grid-cols-2 gap-1.5" role="tablist" aria-label="Style scope">
          {SCOPES.map((s) => (
            <button key={s.id} role="tab" aria-selected={effScope === s.id} disabled={s.id === "word" && !word} onClick={() => setScope(s.id)} className={cn("rounded-md border px-2 py-1.5 text-[12px] transition-colors disabled:opacity-40", effScope === s.id ? "border-accent bg-accent/15 text-accent" : "border-line text-mute hover:text-text")}>{s.label}</button>
          ))}
        </div>
        <p className="text-[11px] leading-snug text-mute">{SCOPES.find((s) => s.id === effScope)!.hint}</p>
        {effScope === "word" && word ? (
          <div className="flex items-center justify-between rounded-md bg-panel-2 p-2 text-[12px]">
            <span>Word: <b className="text-accent-2">{word.text}</b></span>
            <Button size="sm" variant="ghost" onClick={reset}>Clear word style</Button>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line p-2 text-[11px] text-mute">{effScope === "word" ? "" : "Tip: click any word in the preview (or a chip below) to style just that word."}</p>
        )}
        {caption ? (
          <div className="flex flex-wrap gap-1" aria-label="Words of the selected caption">
            {caption.words.map((w) => (
              <button key={w.id} onClick={() => { useEditor.getState().select({ wordId: w.id, captionId: caption.id }); setScope("word"); }} className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", sel.wordId === w.id ? "border-accent-2 bg-accent-2/15 text-accent-2" : "border-line text-mute hover:text-text", project.wordStyles[w.id] && "underline decoration-accent decoration-2 underline-offset-2")}>{w.text}</button>
            ))}
          </div>
        ) : null}
        {effScope === "keywords" ? <KeywordRules /> : null}
      </Section>
      <StyleEditor value={value} onChange={set} onReset={reset} inheritNote={effScope === "word" ? "Unset values inherit from the caption look." : "Unset values inherit from the template."} />
      <Presets value={value} onApply={(st) => set(st)} />
      <FontUpload />
    </div>
  );
}

function KeywordRules() {
  const project = useEditor((s) => s.project)!;
  const tpl = getTemplate(project.captionStyle.templateId);
  const e = { ...DEFAULT_EMPHASIS, ...(tpl.style.emphasis ?? {}), ...(project.captionStyle.overrides.emphasis ?? {}) };
  const setE = (patch: Partial<typeof e>) => useEditor.getState().setStyle({ emphasis: { ...e, ...patch } });
  return (
    <div className="space-y-2 rounded-md bg-panel-2 p-2">
      <Switch label="Auto-pick keywords in every caption" checked={e.mode === "auto"} onChange={(on) => setE({ mode: on ? "auto" : "off" })} />
      {e.mode === "auto" ? (
        <>
          <Slider id="kw-max" label="Keywords per caption" value={e.maxPerGroup} min={1} max={4} onChange={(v) => setE({ maxPerGroup: v })} />
          <Slider id="kw-min" label="Minimum word length" value={e.minLength} min={2} max={12} onChange={(v) => setE({ minLength: v })} />
        </>
      ) : null}
      <p className="text-[10px] leading-snug text-mute">Picks long, non-filler words (numbers and Capitalised words score higher). Force or block any word with “Make keyword” on a selected word.</p>
    </div>
  );
}

function ForceKeyword() {
  const sel = useEditor((s) => s.selection);
  const forced = useEditor((s) => (sel.wordId ? s.project?.wordStyles[sel.wordId]?.emphasize : undefined));
  if (!sel.wordId) return null;
  return (
    <div className="flex gap-1.5">
      <Button size="sm" variant={forced === true ? "primary" : "secondary"} onClick={() => useEditor.getState().setWordStyle(sel.wordId!, { emphasize: forced === true ? undefined : true })}>Make keyword</Button>
      <Button size="sm" variant={forced === false ? "primary" : "secondary"} onClick={() => useEditor.getState().setWordStyle(sel.wordId!, { emphasize: forced === false ? undefined : false })}>Never a keyword</Button>
    </div>
  );
}

/* ─────────────────────────── the editor ─────────────────────────── */
function StyleEditor({ value: v, onChange, onReset, inheritNote }: { value: WordStyle; onChange: (p: WordStyle) => void; onReset: () => void; inheritNote: string }) {
  const project = useEditor((s) => s.project)!;
  const fontOptions = useMemo(() => [...FONT_OPTIONS.map((f) => ({ family: f.family, label: f.label, weights: f.weights })), ...project.fonts.map((f) => ({ family: f.family, label: `${f.family} (uploaded)`, weights: [f.weight] }))], [project.fonts]);
  const fam = v.fontFamily ? primaryFamily(v.fontFamily) : "";
  const weights = fontOptions.find((f) => f.family === fam)?.weights ?? [400, 500, 600, 700, 800, 900];
  const g = v.gradient;
  const setG = (patch: Partial<Gradient>) => onChange({ gradient: { ...(g ?? DEFAULT_GRADIENT), ...patch } });
  const shadows = v.shadows ?? [];
  const setShadow = (i: number, patch: Partial<ShadowLayer>) => onChange({ shadows: shadows.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const glow = v.glow;
  const ext = v.extrude;
  const bg = v.background;
  const stroke = v.stroke;
  const place = v.position;
  const spring = v.springStiffness !== undefined;

  return (
    <>
      <Section title="Typography" right={<Button size="sm" variant="ghost" onClick={onReset}>Reset</Button>}>
        <p className="text-[10px] text-mute">{inheritNote}</p>
        <Field label="Font">
          <select className="field" value={fam} onChange={(e) => { const f = fontOptions.find((o) => o.family === e.target.value); onChange(f ? { fontFamily: stack(f.family), fontWeight: f.weights.reduce((a, b) => (Math.abs(b - (v.fontWeight ?? 700)) < Math.abs(a - (v.fontWeight ?? 700)) ? b : a)) } : { fontFamily: undefined, fontWeight: undefined }); }}>
            <option value="">(inherit)</option>
            {fontOptions.map((f) => <option key={f.family} value={f.family}>{f.label}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Weight"><select className="field" value={v.fontWeight ?? ""} onChange={(e) => onChange({ fontWeight: e.target.value ? Number(e.target.value) : undefined })}><option value="">(inherit)</option>{weights.map((w) => <option key={w} value={w}>{w}</option>)}</select></Field>
          <Field label="Style"><select className="field" value={v.fontStyle ?? ""} onChange={(e) => onChange({ fontStyle: (e.target.value || undefined) as WordStyle["fontStyle"] })}><option value="">(inherit)</option><option value="normal">Normal</option><option value="italic">Italic</option></select></Field>
        </div>
        <Slider id="ty-size" label="Size" value={v.sizeScale ?? 1} min={0.4} max={3} step={0.05} onChange={(x) => onChange({ sizeScale: x })} format={(x) => `${x.toFixed(2)}×`} />
        <Slider id="ty-skew" label="Italic angle (slant)" value={v.skewX ?? 0} min={-30} max={30} onChange={(x) => onChange({ skewX: x || undefined })} format={(x) => `${x}°`} />
        <Slider id="ty-ls" label="Letter spacing" value={v.letterSpacing ?? 0} min={-0.1} max={0.6} step={0.01} onChange={(x) => onChange({ letterSpacing: x })} format={(x) => `${x.toFixed(2)} em`} />
        <Field label="Text case"><select className="field" value={v.textTransform ?? ""} onChange={(e) => onChange({ textTransform: (e.target.value || undefined) as WordStyle["textTransform"] })}><option value="">(inherit)</option><option value="none">As spoken</option><option value="uppercase">UPPERCASE</option><option value="lowercase">lowercase</option><option value="capitalize">Capitalize</option></select></Field>
        <ForceKeyword />
      </Section>

      <Section title="Fill & gradient">
        <ColorField label="Colour" value={v.color ?? "#ffffff"} onChange={(c) => onChange({ color: c })} />
        <Switch label="Gradient fill" checked={!!g} onChange={(on) => onChange({ gradient: on ? DEFAULT_GRADIENT : undefined })} />
        {g ? (
          <div className="space-y-3 rounded-md bg-panel-2 p-2">
            <div className="h-5 rounded border border-line" style={{ background: `linear-gradient(90deg, ${[...g.stops].sort((a, b) => a.pos - b.pos).map((s) => `${s.color} ${s.pos * 100}%`).join(", ")})` }} aria-label="Gradient preview" />
            {g.stops.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="color" aria-label={`Stop ${i + 1} colour`} value={/^#[0-9a-f]{6}$/i.test(s.color) ? s.color : "#ffffff"} onChange={(e) => setG({ stops: g.stops.map((x, j) => (j === i ? { ...x, color: e.target.value } : x)) })} />
                <input type="range" aria-label={`Stop ${i + 1} position`} min={0} max={100} value={Math.round(s.pos * 100)} onChange={(e) => setG({ stops: g.stops.map((x, j) => (j === i ? { ...x, pos: Number(e.target.value) / 100 } : x)) })} className="flex-1 accent-[#8b7bff]" />
                <Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label={`Remove stop ${i + 1}`} disabled={g.stops.length <= 2} onClick={() => setG({ stops: g.stops.filter((_, j) => j !== i) })}><Trash2 size={12} /></Button>
              </div>
            ))}
            <Button size="sm" disabled={g.stops.length >= 8} onClick={() => setG({ stops: [...g.stops, { color: "#ffffff", pos: 0.5 }] })}><Plus size={12} /> Add stop</Button>
            <Slider id="gr-angle" label="Angle" value={g.angle} min={0} max={360} onChange={(x) => setG({ angle: x })} format={(x) => `${x}°`} />
            <Slider id="gr-size" label="Gradient size" value={g.size} min={100} max={600} step={10} onChange={(x) => setG({ size: x })} format={(x) => `${x}%`} />
            <Field label="Animation"><select className="field" value={g.animate} onChange={(e) => setG({ animate: e.target.value as Gradient["animate"], speed: g.speed || (e.target.value === "slide" ? 120 : 60) })}><option value="none">None</option><option value="slide">Slide through the text</option><option value="rotate">Rotate angle</option><option value="hue">Hue cycle</option></select></Field>
            {g.animate !== "none" ? <Slider id="gr-speed" label="Speed" value={g.speed} min={-400} max={400} step={5} onChange={(x) => setG({ speed: x })} format={(x) => (g.animate === "slide" ? `${x} %/s` : `${x} °/s`)} /> : null}
            <Switch label="Shine sweep" checked={!!g.shine} onChange={(on) => setG({ shine: on ? { color: "#ffffff", width: 22, speed: 90, angle: 20, intensity: 0.85 } : null })} />
            {g.shine ? (
              <>
                <Slider id="sh-w" label="Shine width" value={g.shine.width} min={5} max={60} onChange={(x) => setG({ shine: { ...g.shine!, width: x } })} format={(x) => `${x}%`} />
                <Slider id="sh-s" label="Shine speed" value={g.shine.speed} min={-300} max={300} step={5} onChange={(x) => setG({ shine: { ...g.shine!, speed: x } })} />
                <Slider id="sh-a" label="Shine angle" value={g.shine.angle} min={-60} max={60} onChange={(x) => setG({ shine: { ...g.shine!, angle: x } })} format={(x) => `${x}°`} />
              </>
            ) : null}
          </div>
        ) : null}
      </Section>

      <Section title="Outline & shadows">
        <Switch label="Outline" checked={!!stroke && stroke.width > 0} onChange={(on) => onChange({ stroke: on ? { color: stroke?.color ?? "#000000", width: stroke?.width || 6 } : { color: stroke?.color ?? "#000000", width: 0 } })} />
        {stroke && stroke.width > 0 ? (
          <div className="grid grid-cols-2 items-end gap-2"><ColorField label="Outline colour" value={stroke.color} onChange={(c) => onChange({ stroke: { ...stroke, color: c } })} /><Slider id="st-w" label="Thickness" value={stroke.width} min={0.5} max={30} step={0.5} onChange={(x) => onChange({ stroke: { ...stroke, width: x } })} /></div>
        ) : null}
        <div className="flex items-center justify-between"><span className="text-[12px] text-mute">Shadows ({shadows.length})</span><Button size="sm" disabled={shadows.length >= 6} onClick={() => onChange({ shadows: [...shadows, { color: "rgba(0,0,0,0.5)", blur: 16, x: 0, y: 6 }] })}><Plus size={12} /> Add</Button></div>
        {shadows.map((s, i) => (
          <div key={i} className="space-y-2 rounded-md bg-panel-2 p-2">
            <div className="flex items-end gap-2"><div className="flex-1"><ColorField label={`Shadow ${i + 1} colour`} value={s.color} onChange={(c) => setShadow(i, { color: c })} /></div><Button variant="ghost" size="icon" aria-label={`Remove shadow ${i + 1}`} onClick={() => onChange({ shadows: shadows.filter((_, j) => j !== i) })}><Trash2 size={13} /></Button></div>
            <Slider id={`sd-b-${i}`} label="Blur" value={s.blur} min={0} max={80} onChange={(x) => setShadow(i, { blur: x })} />
            <div className="grid grid-cols-2 gap-2"><Slider id={`sd-x-${i}`} label="X" value={s.x} min={-60} max={60} onChange={(x) => setShadow(i, { x })} /><Slider id={`sd-y-${i}`} label="Y" value={s.y} min={-60} max={60} onChange={(x) => setShadow(i, { y: x })} /></div>
          </div>
        ))}
        {v.shadows !== undefined && shadows.length === 0 ? <p className="text-[10px] text-warn">No shadows: this removes the template shadow for these words.</p> : null}
      </Section>

      <Section title="Glow">
        <Switch label="Glow" checked={!!glow && glow.strength > 0} onChange={(on) => onChange({ glow: on ? { color: glow?.color ?? "#00cfff", blur: glow?.blur || 24, strength: glow?.strength || 2, pulse: glow?.pulse ?? 0, hz: glow?.hz ?? 1.2 } : { color: glow?.color ?? "#00cfff", blur: 0, strength: 0, pulse: 0, hz: 1 } })} />
        {glow && glow.strength > 0 ? (
          <>
            <ColorField label="Glow colour" value={glow.color} onChange={(c) => onChange({ glow: { ...glow, color: c } })} />
            <Slider id="gl-b" label="Radius" value={glow.blur} min={2} max={80} onChange={(x) => onChange({ glow: { ...glow, blur: x } })} />
            <Slider id="gl-s" label="Intensity (halos)" value={glow.strength} min={0.5} max={3} step={0.5} onChange={(x) => onChange({ glow: { ...glow, strength: x } })} />
            <Slider id="gl-p" label="Pulse amount" value={glow.pulse} min={0} max={1} step={0.05} onChange={(x) => onChange({ glow: { ...glow, pulse: x } })} format={(x) => `${Math.round(x * 100)}%`} />
            {glow.pulse > 0 ? <Slider id="gl-h" label="Pulse speed" value={glow.hz} min={0.2} max={4} step={0.1} onChange={(x) => onChange({ glow: { ...glow, hz: x } })} format={(x) => `${x.toFixed(1)} Hz`} /> : null}
          </>
        ) : null}
      </Section>

      <Section title="Depth (extrusion)">
        <Switch label="3D extrusion" checked={!!ext && ext.depth > 0} onChange={(on) => onChange({ extrude: on ? { depth: ext?.depth || 16, color: ext?.color ?? "#2a0a8c", angle: ext?.angle ?? 55, fade: ext?.fade ?? true } : { depth: 0, color: ext?.color ?? "#2a0a8c", angle: 55, fade: true } })} />
        {ext && ext.depth > 0 ? (
          <>
            <ColorField label="Side colour" value={ext.color} onChange={(c) => onChange({ extrude: { ...ext, color: c } })} />
            <Slider id="ex-d" label="Depth" value={ext.depth} min={1} max={60} onChange={(x) => onChange({ extrude: { ...ext, depth: x } })} format={(x) => `${x}px`} />
            <Slider id="ex-a" label="Direction" value={ext.angle} min={0} max={360} onChange={(x) => onChange({ extrude: { ...ext, angle: x } })} format={(x) => `${x}°`} />
            <Switch label="Darken with distance" checked={ext.fade} onChange={(on) => onChange({ extrude: { ...ext, fade: on } })} />
          </>
        ) : null}
      </Section>

      <Section title="Background">
        <Switch label="Box behind the word" checked={!!bg} onChange={(on) => onChange({ background: on ? { color: "#ffd60a", radius: 0.2, padX: 0.25, padY: 0.05 } : undefined })} />
        {bg ? (
          <>
            <ColorField label="Box colour" value={bg.color} onChange={(c) => onChange({ background: { ...bg, color: c } })} />
            <Slider id="bg-r" label="Corner radius" value={bg.radius} min={0} max={1.5} step={0.05} onChange={(x) => onChange({ background: { ...bg, radius: x } })} format={(x) => `${x.toFixed(2)} em`} />
            <div className="grid grid-cols-2 gap-2"><Slider id="bg-x" label="Pad X" value={bg.padX} min={0} max={1} step={0.05} onChange={(x) => onChange({ background: { ...bg, padX: x } })} /><Slider id="bg-y" label="Pad Y" value={bg.padY} min={0} max={0.6} step={0.05} onChange={(x) => onChange({ background: { ...bg, padY: x } })} /></div>
          </>
        ) : null}
      </Section>

      <Section title="Transform & position">
        <Slider id="tf-rot" label="Rotation" value={v.rotate ?? 0} min={-90} max={90} onChange={(x) => onChange({ rotate: x || undefined })} format={(x) => `${x}°`} />
        <Slider id="tf-skx" label="Skew X" value={v.skewX ?? 0} min={-40} max={40} onChange={(x) => onChange({ skewX: x || undefined })} format={(x) => `${x}°`} />
        <Slider id="tf-sky" label="Skew Y" value={v.skewY ?? 0} min={-40} max={40} onChange={(x) => onChange({ skewY: x || undefined })} format={(x) => `${x}°`} />
        <Slider id="tf-rx" label="Perspective tilt (X)" value={v.rotateX ?? 0} min={-70} max={70} onChange={(x) => onChange({ rotateX: x || undefined, perspective: v.perspective ?? 900 })} format={(x) => `${x}°`} />
        <Slider id="tf-ry" label="Perspective turn (Y)" value={v.rotateY ?? 0} min={-70} max={70} onChange={(x) => onChange({ rotateY: x || undefined, perspective: v.perspective ?? 900 })} format={(x) => `${x}°`} />
        {v.rotateX || v.rotateY ? <Slider id="tf-p" label="Perspective depth (lower = stronger)" value={v.perspective ?? 900} min={300} max={3000} step={50} onChange={(x) => onChange({ perspective: x })} /> : null}
        <div className="grid grid-cols-2 gap-2"><Slider id="tf-dx" label="Offset X" value={Math.round((v.dx ?? 0) * 100)} min={-100} max={100} onChange={(x) => onChange({ dx: x / 100 || undefined })} format={(x) => `${x}%`} /><Slider id="tf-dy" label="Offset Y" value={Math.round((v.dy ?? 0) * 100)} min={-100} max={100} onChange={(x) => onChange({ dy: x / 100 || undefined })} format={(x) => `${x}%`} /></div>
        <Switch label="Free position on the frame" checked={!!place} onChange={(on) => onChange({ position: on ? { x: 0.5, y: 0.4 } : null })} />
        {place ? (
          <div className="grid grid-cols-2 gap-2"><Slider id="po-x" label="X" value={Math.round(place.x * 100)} min={0} max={100} onChange={(x) => onChange({ position: { ...place, x: x / 100 } })} format={(x) => `${x}%`} /><Slider id="po-y" label="Y" value={Math.round(place.y * 100)} min={0} max={100} onChange={(x) => onChange({ position: { ...place, y: x / 100 } })} format={(x) => `${x}%`} /></div>
        ) : null}
        <Slider id="tf-op" label="Opacity" value={Math.round((v.opacity ?? 1) * 100)} min={0} max={100} onChange={(x) => onChange({ opacity: x / 100 })} format={(x) => `${x}%`} />
      </Section>

      <Section title="Motion">
        <Field label="Animation">
          <select className="field" value={v.animationId ?? ""} onChange={(e) => onChange({ animationId: e.target.value || undefined })}>
            <option value="">(caption’s own)</option>
            {BEHAVIORS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </Field>
        <Slider id="mo-d" label="Duration" value={v.enterMs ?? 420} min={80} max={2000} step={20} onChange={(x) => onChange({ enterMs: x })} format={(x) => `${x} ms`} />
        <Slider id="mo-delay" label="Delay" value={v.delayMs ?? 0} min={-400} max={1500} step={10} onChange={(x) => onChange({ delayMs: x || undefined })} format={(x) => `${x > 0 ? "+" : ""}${x} ms`} />
        <Field label="Motion curve"><select className="field" value={v.easing ?? ""} onChange={(e) => onChange({ easing: (e.target.value || undefined) as WordStyle["easing"] })}><option value="">(inherit)</option><option value="cubic">Ease-out cubic</option><option value="expo">Ease-out expo</option><option value="sine">Ease-out sine</option><option value="back">Ease-out back</option><option value="linear">Linear</option></select></Field>
        <Switch label="Custom spring" checked={spring} onChange={(on) => onChange(on ? { springStiffness: 160, springDamping: 12 } : { springStiffness: undefined, springDamping: undefined })} />
        {spring ? (
          <>
            <Slider id="mo-st" label="Spring stiffness" value={v.springStiffness!} min={20} max={600} step={10} onChange={(x) => onChange({ springStiffness: x })} />
            <Slider id="mo-dp" label="Spring damping (low = bouncier)" value={v.springDamping ?? 12} min={2} max={60} onChange={(x) => onChange({ springDamping: x })} />
          </>
        ) : null}
        <Slider id="mo-bl" label="Entry blur (motion-blur look)" value={v.blurInPx ?? 0} min={0} max={40} onChange={(x) => onChange({ blurInPx: x || undefined })} format={(x) => `${x}px`} />
        <p className="text-[10px] leading-snug text-mute">Entry blur is a per-word approximation. True sub-frame motion blur for the whole caption layer is in the right panel (“Motion blur”).</p>
      </Section>
    </>
  );
}

/* ─────────────────────────── presets & fonts ─────────────────────────── */
function Presets({ value, onApply }: { value: WordStyle; onApply: (s: WordStyle) => void }) {
  const my = usePrefs((s) => s.myStyles);
  const hydrate = usePrefs((s) => s.hydrate);
  const [name, setName] = useState("");
  useState(() => hydrate());
  const hasStyle = Object.keys(diffStyle(value)).length > 0;
  return (
    <Section title="Style presets">
      <div className="flex gap-2">
        <input className="field" aria-label="Preset name" placeholder="Name this style…" value={name} onChange={(e) => setName(e.target.value)} />
        <Button disabled={!hasStyle} onClick={() => { usePrefs.getState().saveStyle(name || "My style", value); setName(""); }}>Save</Button>
      </div>
      {!hasStyle ? <p className="text-[10px] text-mute">Customise something above first, then save it for reuse in any project (stored in this browser).</p> : null}
      {my.length ? <ul className="space-y-1">{my.map((p) => (
        <li key={p.id} className="flex items-center gap-1.5 rounded-md border border-line px-2 py-1 text-[12px]"><span className="flex-1 truncate">{p.name}</span><Button size="sm" variant="secondary" onClick={() => onApply(p.style)}>Apply</Button><Button size="icon" variant="ghost" className="!h-6 !w-6" aria-label={`Delete preset ${p.name}`} onClick={() => usePrefs.getState().deleteStyle(p.id)}><Trash2 size={12} /></Button></li>
      ))}</ul> : null}
      <div className="text-[11px] text-mute">Built-in looks</div>
      <div className="flex flex-wrap gap-1.5">{BUILT_IN.map((b) => <Button key={b.name} size="sm" onClick={() => onApply(b.style)}>{b.name}</Button>)}</div>
    </Section>
  );
}

function FontUpload() {
  const project = useEditor((s) => s.project)!;
  const input = useRef<HTMLInputElement>(null);
  const [family, setFamily] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const go = async () => {
    if (!file) return;
    setErr(null);
    const check = validateUpload({ filename: file.name, size: file.size, kind: "font" });
    if (!check.ok) return setErr(check.error);
    setBusy(true);
    try {
      const { asset } = await uploadFile(project.id, file, "font", () => {});
      useEditor.getState().addFont({ id: uid("f").toLowerCase(), family: family.trim(), assetId: asset.id, weight: 400, style: /italic|oblique/i.test(file.name) ? "italic" : "normal", licenseConfirmed: true }, asset);
      setFile(null); setFamily(""); setOk(false);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const valid = !!file && /^[A-Za-z0-9][A-Za-z0-9 \-]{0,40}$/.test(family.trim()) && ok;
  return (
    <Section title="Your fonts">
      <p className="text-[11px] leading-relaxed text-mute">Upload a .ttf, .otf, .woff or .woff2 you have the right to embed in videos. It is stored with the project and used by both the preview and the exported MP4.</p>
      <Button size="sm" onClick={() => input.current?.click()}><Upload size={13} /> {file ? file.name : "Choose font file"}</Button>
      <input ref={input} type="file" accept=".ttf,.otf,.woff,.woff2" className="sr-only" aria-label="Font file" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!family) setFamily(f.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9 \-]+/g, " ").trim().slice(0, 40)); } e.target.value = ""; }} />
      <input className="field" aria-label="Font family name" placeholder="Family name (letters, digits, spaces)" value={family} onChange={(e) => setFamily(e.target.value)} />
      <label className="flex items-start gap-2 text-[11px] text-mute"><input type="checkbox" className="mt-0.5" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I confirm I have a licence that allows embedding this font in videos I publish.</label>
      <Button variant="primary" disabled={!valid || busy} onClick={go}>{busy ? "Uploading…" : "Add font"}</Button>
      {err ? <p role="alert" className="text-[12px] text-danger">{err}</p> : null}
      <ul className="space-y-1">{project.fonts.map((f) => <li key={f.id} className="flex items-center gap-2 text-[12px]"><span className="flex-1 truncate" style={{ fontFamily: `"${f.family}"` }}>{f.family}</span><Badge>{f.style}</Badge><Button size="icon" variant="ghost" className="!h-6 !w-6" aria-label={`Remove font ${f.family}`} onClick={() => useEditor.getState().removeFont(f.id)}><Trash2 size={12} /></Button></li>)}</ul>
    </Section>
  );
}

export { useUi };
