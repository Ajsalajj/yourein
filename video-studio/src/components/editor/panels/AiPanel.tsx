"use client";
import { useState } from "react";
import { Scissors, Wand2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { api } from "@/lib/client";
import { silencesToCuts, DEFAULT_SILENCE } from "@/lib/silence";
import { normalizeCuts } from "@/lib/timeline";
import { Button, Section, Slider, Status } from "@/components/ui";
import { TranscribeControls } from "./CaptionsPanel";
import { fmtTime } from "@/lib/client";
import { useSourceDuration } from "../context";

export function AiPanel() {
  const project = useEditor((s) => s.project)!;
  const dur = useSourceDuration();
  const [noise, setNoise] = useState(-35);
  const [minSil, setMinSil] = useState(DEFAULT_SILENCE.minSilenceMs);
  const [pad, setPad] = useState(DEFAULT_SILENCE.keepPadMs);
  const [found, setFound] = useState<{ cuts: { startMs: number; endMs: number }[]; raw: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const silenceCuts = project.cuts.filter((c) => c.reason === "silence");

  const analyse = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api<{ silences: { startMs: number; endMs: number }[] }>(`/api/projects/${project.id}/analyze`, { method: "POST", body: JSON.stringify({ kind: "silence", noiseDb: noise, minSilenceMs: minSil }) });
      setFound({ cuts: silencesToCuts(r.silences, dur, { minSilenceMs: minSil, keepPadMs: pad }), raw: r.silences.length });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const removable = found ? found.cuts.reduce((a, c) => a + (c.endMs - c.startMs), 0) : 0;
  return (
    <div>
      <Section title="Transcription"><TranscribeControls /></Section>
      <Section title="Silence removal">
        <p className="text-[11px] leading-relaxed text-mute">Finds quiet stretches by audio level (ffmpeg <code>silencedetect</code> - an energy threshold, not a neural VAD). Removed parts become undoable cuts; a natural pause is kept on both sides so speech does not sound clipped.</p>
        <Slider label="Silence threshold" value={noise} min={-60} max={-20} onChange={setNoise} format={(v) => `${v} dB`} />
        <Slider label="Minimum silence" value={minSil} min={300} max={3000} step={50} onChange={setMinSil} format={(v) => `${v} ms`} />
        <Slider label="Keep around speech" value={pad} min={0} max={500} step={10} onChange={setPad} format={(v) => `${v} ms`} />
        <Button className="w-full" onClick={analyse} disabled={busy || !project.assets[project.sourceAssetId ?? ""]?.hasAudio}>{busy ? "Analysing…" : "Analyse silences"}</Button>
        {err ? <p role="alert" className="text-[12px] text-danger">{err}</p> : null}
        {found ? (
          <div className="space-y-2 rounded-md border border-line bg-panel-2 p-2 text-[12px]" role="status">
            <p>{found.cuts.length} cut{found.cuts.length === 1 ? "" : "s"} would remove {fmtTime(removable)} ({found.raw} silences detected).</p>
            <Button variant="primary" className="w-full" disabled={!found.cuts.length} onClick={() => { useEditor.getState().addCuts(found.cuts, "silence"); setFound(null); }}><Scissors size={14} /> Apply cuts</Button>
          </div>
        ) : null}
        {silenceCuts.length ? <Button size="sm" variant="ghost" onClick={() => useEditor.getState().clearCuts("silence")}>Restore all silence cuts ({silenceCuts.length})</Button> : null}
        <p className="text-[11px] text-mute">Total removed from video: {fmtTime(normalizeCuts(project.cuts, dur).reduce((a, c) => a + c.endMs - c.startMs, 0))}</p>
      </Section>
      <Section title="Smart zoom"><p className="text-[12px] text-mute"><Wand2 size={13} className="mr-1.5 inline" aria-hidden />Open the <b>Effects</b> tab to generate and edit zooms.</p></Section>
      <div className="space-y-3 p-4">
        <Status kind="not-implemented">Face-aware framing, AI B-roll selection and generative features need external services or models that are not part of the local-only core. They are intentionally not faked.</Status>
      </div>
    </div>
  );
}
