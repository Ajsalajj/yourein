"use client";
import { useRef, useState } from "react";
import { Plus, Play, Sparkles, Trash2, Upload } from "lucide-react";
import { useEditor } from "@/store/editor";
import { uid } from "@/lib/project";
import { SFX_LIBRARY, sfxLibraryItem, sfxPublicPath, suggestSfx } from "@/lib/sfx";
import type { SfxClip } from "@/lib/edit-schema";
import { Badge, Button, Section, Slider, Switch } from "@/components/ui";
import { fmtTime } from "@/lib/client";
import { useMeta, useSeek } from "../context";
import { useAudioUpload } from "./MediaPanel";

const CATS = ["transition", "emphasis", "ui", "build", "texture"] as const;

export function SfxPanel() {
  const project = useEditor((s) => s.project!);
  const frame = useEditor((s) => s.frame);
  const sel = useEditor((s) => s.selection);
  const meta = useMeta();
  const seek = useSeek();
  const up = useAudioUpload();
  const input = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState<(typeof CATS)[number] | "all">("all");
  const audio = useRef<HTMLAudioElement | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const preview = (url: string) => {
    audio.current?.pause();
    const a = new Audio(url);
    audio.current = a;
    void a.play().catch(() => undefined);
  };
  const add = (c: Partial<SfxClip> & { source: SfxClip["source"] }) => {
    const id = uid("sf_");
    const srcMs = seek.sourceNow(frame);
    useEditor.getState().setSfx((l) => [...l, { id, srcMs, syncWordId: null, syncOffsetMs: 0, offsetMs: 0, durationMs: null, volume: 1, fadeInMs: 0, fadeOutMs: 0, duckMusic: true, label: "", auto: false, ...c }]);
    useEditor.getState().select({ sfxId: id });
  };
  const suggest = () => {
    const found = suggestSfx(project, meta.segments);
    const st = useEditor.getState();
    st.setSfx((l) => [...l.filter((x) => !x.auto), ...found]);
    setNote(found.length ? `Added ${found.length} suggested sounds (rules: keywords, numbers, zooms, cuts). Review them in the list - they are ordinary clips you can edit or delete.` : "Nothing to suggest: no matching words, zooms or cuts yet.");
  };
  const clips = [...project.sfx].sort((a, b) => a.srcMs - b.srcMs);
  const selected = project.sfx.find((c) => c.id === sel.sfxId);
  const patch = (id: string, p: Partial<SfxClip>) => useEditor.getState().setSfx((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)), `sfx:${id}:${Object.keys(p).join(",")}`);
  const nameOf = (c: SfxClip) => (c.source.kind === "library" ? sfxLibraryItem(c.source.id)?.name ?? c.source.id : project.assets[c.source.assetId]?.filename ?? "missing file");

  return (
    <div>
      <Section title="Sound effects track" right={<Badge tone="ok">{project.sfx.length} clips</Badge>}>
        <Switch label="Sound effects on" checked={project.sfxSettings.enabled} onChange={(v) => useEditor.getState().setSfxSettings({ enabled: v })} />
        <Slider label="Track volume" value={Math.round(project.sfxSettings.volume * 100)} min={0} max={200} onChange={(v) => useEditor.getState().setSfxSettings({ volume: v / 100 })} format={(v) => `${v}%`} />
        <Slider label="Duck under speech" value={Math.round(project.sfxSettings.duckUnderSpeech * 100)} min={0} max={100} onChange={(v) => useEditor.getState().setSfxSettings({ duckUnderSpeech: v / 100 })} format={(v) => (v === 0 ? "off" : `-${v}% while speaking`)} />
        <p className="text-[11px] leading-relaxed text-mute">Speech is taken from the caption timing. Music ducks under every sound marked &ldquo;duck music&rdquo; (set the music level in the Audio tab).</p>
        <Button size="sm" variant="secondary" onClick={suggest}><Sparkles size={13} /> Suggest sounds</Button>
        {project.sfx.some((c) => c.auto) ? <Button size="sm" variant="ghost" onClick={() => useEditor.getState().setSfx((l) => l.filter((c) => !c.auto))}>Remove suggested</Button> : null}
        {note ? <p role="status" className="text-[11px] text-mute">{note}</p> : null}
      </Section>

      <Section title="Library (original, CC0)">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sound category">
          {(["all", ...CATS] as const).map((c) => <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={`rounded-full px-2 py-0.5 text-[11px] ${cat === c ? "bg-accent text-white" : "bg-panel-2 text-mute hover:text-text"}`}>{c}</button>)}
        </div>
        <ul className="space-y-1">
          {SFX_LIBRARY.filter((s) => cat === "all" || s.category === cat).map((s) => (
            <li key={s.id} className="flex items-center gap-1 rounded-lg bg-panel-2 px-2 py-1.5">
              <Button variant="ghost" size="icon" aria-label={`Preview ${s.name}`} onClick={() => preview(sfxPublicPath(s.id))}><Play size={13} /></Button>
              <span className="min-w-0 flex-1 truncate text-[12px]">{s.name} <span className="text-mute">{(s.durationMs / 1000).toFixed(2)}s</span></span>
              <Button variant="ghost" size="icon" aria-label={`Add ${s.name} at playhead`} title="Add at the playhead" onClick={() => add({ source: { kind: "library", id: s.id }, label: s.name })}><Plus size={13} /></Button>
              {sel.wordId ? <Button variant="ghost" size="sm" title="Add synced to the selected word" onClick={() => { const w = project.captions.flatMap((c) => c.words).find((x) => x.id === sel.wordId); if (w) add({ source: { kind: "library", id: s.id }, srcMs: w.startMs, syncWordId: w.id, label: `${s.name} @ "${w.text}"` }); }}>word</Button> : null}
            </li>
          ))}
        </ul>
        <Button size="sm" onClick={() => input.current?.click()}><Upload size={13} /> Add your own sound</Button>
        <input ref={input} type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*" className="sr-only" aria-label="Upload sound effect" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const a = await up.run(f); if (a) add({ source: { kind: "asset", assetId: a.id }, label: a.filename }); }} />
        {up.error ? <p role="alert" className="text-[12px] text-danger">{up.error}</p> : null}
        <p className="text-[11px] text-mute">Your own files stay on this machine and are your responsibility to licence.</p>
      </Section>

      <Section title="Clips on the track">
        {clips.length === 0 ? <p className="text-[12px] text-mute">No sounds yet. Add one from the library, or use &ldquo;Suggest sounds&rdquo;.</p> : null}
        <ul className="space-y-1">
          {clips.map((c) => (
            <li key={c.id}>
              <button onClick={() => { useEditor.getState().select({ sfxId: c.id }); seek.fromSource(c.srcMs); }} aria-pressed={sel.sfxId === c.id} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${sel.sfxId === c.id ? "bg-accent/20 ring-1 ring-accent" : "bg-panel-2 hover:bg-panel-2/70"}`}>
                <span className="w-12 tabular-nums text-mute">{fmtTime(c.srcMs)}</span>
                <span className="min-w-0 flex-1 truncate">{nameOf(c)}{c.syncWordId ? " · synced" : ""}</span>
                {c.auto ? <Badge tone="accent">auto</Badge> : null}
              </button>
            </li>
          ))}
        </ul>
        {selected ? (
          <div className="space-y-2 rounded-lg border border-line p-2">
            <div className="flex items-center justify-between"><span className="text-[12px] font-medium">{nameOf(selected)}</span><Button variant="ghost" size="icon" aria-label="Delete sound" onClick={() => { useEditor.getState().setSfx((l) => l.filter((c) => c.id !== selected.id)); useEditor.getState().select({ sfxId: null }); }}><Trash2 size={13} /></Button></div>
            <Slider label="Volume" value={Math.round(selected.volume * 100)} min={0} max={200} onChange={(v) => patch(selected.id, { volume: v / 100 })} format={(v) => `${v}%`} />
            <Slider label="Fade in" value={selected.fadeInMs} min={0} max={2000} step={10} onChange={(v) => patch(selected.id, { fadeInMs: v })} format={(v) => `${v} ms`} />
            <Slider label="Fade out" value={selected.fadeOutMs} min={0} max={2000} step={10} onChange={(v) => patch(selected.id, { fadeOutMs: v })} format={(v) => `${v} ms`} />
            <Slider label="Start (source time)" value={Math.round(selected.srcMs)} min={0} max={Math.round(project.assets[project.sourceAssetId ?? ""]?.durationMs ?? 60000)} step={10} onChange={(v) => patch(selected.id, { srcMs: v, syncWordId: null })} format={(v) => fmtTime(v)} />
            {selected.syncWordId ? <Slider label="Offset from word" value={selected.syncOffsetMs} min={-500} max={500} step={10} onChange={(v) => patch(selected.id, { syncOffsetMs: v })} format={(v) => `${v} ms`} /> : null}
            <Switch label="Duck music while it plays" checked={selected.duckMusic} onChange={(v) => patch(selected.id, { duckMusic: v })} />
            {selected.syncWordId ? <Button size="sm" variant="ghost" onClick={() => patch(selected.id, { syncWordId: null })}>Unlink from word</Button> : null}
          </div>
        ) : null}
      </Section>
    </div>
  );
}
