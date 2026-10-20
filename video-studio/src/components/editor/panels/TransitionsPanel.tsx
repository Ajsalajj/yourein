"use client";
import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { uid } from "@/lib/project";
import { fmtTime } from "@/lib/client";
import { TRANSITIONS } from "@/lib/transitions";
import { SFX_LIBRARY, joinsOf, nearestJoin } from "@/lib/sfx";
import type { TransitionSpec, TransitionType } from "@/lib/edit-schema";
import { Badge, Button, Section, Slider } from "@/components/ui";
import { useMeta, useSeek } from "../context";

export function TransitionsPanel() {
  const project = useEditor((s) => s.project!);
  const sel = useEditor((s) => s.selection);
  const meta = useMeta();
  const seek = useSeek();
  const joins = useMemo(() => joinsOf(meta.segments), [meta.segments]);
  const byJoin = (j: { srcMs: number }) => project.transitions.find((t) => nearestJoin([j], t.joinSrcMs) !== null);
  const set = (id: string, patch: Partial<TransitionSpec>) => useEditor.getState().setTransitions((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)), `tr:${id}:${Object.keys(patch).join(",")}`);
  const create = (j: { srcMs: number }, type: TransitionType) => {
    const id = uid("tr_");
    useEditor.getState().setTransitions((l) => [...l.filter((t) => nearestJoin([j], t.joinSrcMs) === null), { id, type, joinSrcMs: j.srcMs, durationMs: 500, direction: "left", intensity: 0.7, soundId: null }]);
    useEditor.getState().select({ transitionId: id });
    seek.fromSource(j.srcMs);
  };
  const orphans = project.transitions.filter((t) => !joins.some((j) => nearestJoin([j], t.joinSrcMs)));
  const whooshes = SFX_LIBRARY.filter((s) => s.category === "transition");

  return (
    <div>
      <Section title="Cut transitions" right={<Badge tone="ok">{joins.length} joins</Badge>}>
        <p className="text-[11px] leading-relaxed text-mute">A transition sits on a join between two kept clips of the edit (made by cuts, silence removal or deleted ranges). Both shots are real decoded footage: the outgoing shot continues into the removed footage and the incoming one starts from before the cut, so the output length does not change and the speaker&rsquo;s audio is untouched.</p>
        {joins.length === 0 ? <p className="text-[12px] text-mute">No joins yet. Cut a range on the timeline (or run silence removal) to create one.</p> : null}
      </Section>
      {joins.map((j, i) => {
        const t = byJoin(j);
        return (
          <Section key={j.srcMs} title={`Join ${i + 1} · ${fmtTime(j.srcMs)}`} right={t ? <Button variant="ghost" size="icon" aria-label="Remove transition" onClick={() => useEditor.getState().setTransitions((l) => l.filter((x) => x.id !== t.id))}><Trash2 size={13} /></Button> : null}>
            <select aria-label={`Transition for join ${i + 1}`} className="field" value={t?.type ?? ""} onChange={(e) => { const v = e.target.value as TransitionType | ""; if (!v) { if (t) useEditor.getState().setTransitions((l) => l.filter((x) => x.id !== t.id)); } else if (t) set(t.id, { type: v }); else create(j, v); }}>
              <option value="">Hard cut</option>
              {TRANSITIONS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            {t ? (
              <div className="space-y-2" onFocus={() => useEditor.getState().select({ transitionId: t.id })}>
                <p className="text-[11px] text-mute">{TRANSITIONS.find((x) => x.id === t.type)?.description}</p>
                <Slider label="Length" value={t.durationMs} min={120} max={1500} step={20} onChange={(v) => set(t.id, { durationMs: v })} format={(v) => `${v} ms`} />
                <Slider label="Intensity" value={Math.round(t.intensity * 100)} min={0} max={100} onChange={(v) => set(t.id, { intensity: v / 100 })} format={(v) => `${v}%`} />
                <div className="flex gap-1" role="group" aria-label="Direction">
                  {(["left", "right", "up", "down"] as const).map((d) => <button key={d} aria-pressed={t.direction === d} onClick={() => set(t.id, { direction: d })} className={`flex-1 rounded px-1 py-1 text-[11px] ${t.direction === d ? "bg-accent text-white" : "bg-panel-2 text-mute"}`}>{d}</button>)}
                </div>
                <select aria-label="Transition sound" className="field" value={t.soundId ?? ""} onChange={(e) => set(t.id, { soundId: e.target.value || null })}>
                  <option value="">No sound</option>
                  {whooshes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <Button size="sm" variant="secondary" onClick={() => seek.fromSource(Math.max(0, j.srcMs - 400))}>Preview (jump before join)</Button>
              </div>
            ) : null}
          </Section>
        );
      })}
      {orphans.length ? <Section title="Not attached"><p className="text-[11px] text-warn">{orphans.length} transition(s) no longer match a join (the cut they belonged to was removed) and are ignored. <button className="underline" onClick={() => useEditor.getState().setTransitions((l) => l.filter((t) => !orphans.includes(t)))}>Delete them</button></p></Section> : null}
      <span className="sr-only">{sel.transitionId}</span>
    </div>
  );
}
