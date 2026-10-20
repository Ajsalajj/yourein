"use client";
import { useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, Merge, Scissors, Split, Trash2, Upload, Search, Languages } from "lucide-react";
import { useEditor } from "@/store/editor";
import { useTranscription } from "@/store/transcription";
import * as ops from "@/lib/captions/ops";
import { groupWithRemotionCaptions } from "@/lib/captions/grouping";
import { cuesToCaptions, parseSubtitles, toSRT, toVTT } from "@/lib/captions/subtitles";
import { captionsToOutput } from "@/lib/timeline";
import type { Caption } from "@/lib/project";
import { fmtTime } from "@/lib/client";
import { Badge, Button, Tip } from "@/components/ui";
import { useMeta, useSeek } from "../context";
import { cn } from "@/lib/cn";

export const LANGUAGES: [string, string][] = [["", "Auto-detect"], ["en", "English"], ["ml", "Malayalam"], ["hi", "Hindi"], ["ta", "Tamil"], ["te", "Telugu"], ["kn", "Kannada"], ["bn", "Bengali"], ["mr", "Marathi"], ["ur", "Urdu"], ["ar", "Arabic"], ["es", "Spanish"], ["fr", "French"], ["de", "German"], ["pt", "Portuguese"], ["ja", "Japanese"], ["ko", "Korean"], ["zh", "Chinese"]];

function download(name: string, text: string, mime: string) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function TranscribeControls() {
  const project = useEditor((s) => s.project)!;
  const t = useTranscription();
  const [lang, setLang] = useState("");
  const [engine, setEngine] = useState("auto");
  const running = t.phase === "running";
  const has = !!project.transcript;
  const go = () => {
    if (has && project.captions.length && !window.confirm("Transcribing again replaces all current captions (your text edits will be lost). Footage cuts are kept. Continue?")) return;
    void t.start(project.id, { language: lang || null, engine });
  };
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select aria-label="Spoken language" className="field" value={lang} onChange={(e) => setLang(e.target.value)} disabled={running}>{LANGUAGES.map(([c, n]) => <option key={c} value={c}>{n}</option>)}</select>
        <select aria-label="Speech engine" className="field" value={engine} onChange={(e) => setEngine(e.target.value)} disabled={running}><option value="auto">Engine: auto</option><option value="faster-whisper">Whisper</option><option value="pocketsphinx">Offline English (basic)</option></select>
      </div>
      <Button variant="primary" className="w-full" onClick={go} disabled={running || !project.sourceAssetId}><Languages size={14} /> {running ? "Transcribing…" : has ? "Transcribe again" : "Transcribe video"}</Button>
      {running ? (
        <div role="status" aria-live="polite" className="space-y-1">
          <div className="h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(t.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent transition-[width]" style={{ width: `${t.progress * 100}%` }} /></div>
          <p className="text-[11px] text-mute">{t.stage} · {Math.round(t.progress * 100)}%</p>
        </div>
      ) : null}
      {t.phase === "error" ? <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-2 text-[12px] text-danger">{t.error}</p> : null}
      {project.transcript ? (
        <div className="rounded-md border border-line bg-panel-2 p-2 text-[11px] leading-relaxed text-mute">
          <div className="mb-1 flex flex-wrap items-center gap-1"><Badge tone="accent">{project.transcript.engine}</Badge><Badge>{project.transcript.model}</Badge><Badge>lang: {project.transcript.language}{project.transcript.languageProbability !== null ? ` (${Math.round(project.transcript.languageProbability * 100)}%)` : ""}</Badge></div>
          {project.transcript.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
          <p>ASR output is never perfect. Review the text and word timing below.</p>
        </div>
      ) : null}
    </div>
  );
}

function WordTimingEditor({ cap }: { cap: Caption }) {
  const setCaptions = useEditor((s) => s.setCaptions);
  return (
    <div className="mt-2 space-y-1 rounded-md bg-bg/60 p-2">
      <p className="text-[10px] text-mute">Timing in ms (source video). Edited words are marked <b>manual</b>.</p>
      {cap.words.map((w, i) => (
        <div key={w.id} className="flex items-center gap-1.5 text-[11px]">
          <span className={cn("w-20 truncate", w.confidence < 0.5 && "text-warn")} title={`confidence ${Math.round(w.confidence * 100)}% · timing: ${w.timingSource}`}>{w.text}</span>
          <input aria-label={`Start of ${w.text}`} type="number" step={10} className="field !w-[72px] !py-0.5 tabular-nums" value={Math.round(w.startMs)} onChange={(e) => setCaptions((cs) => ops.setWordTiming(cs, cap.id, w.id, Number(e.target.value), w.endMs), `wt:${w.id}`)} />
          <input aria-label={`End of ${w.text}`} type="number" step={10} className="field !w-[72px] !py-0.5 tabular-nums" value={Math.round(w.endMs)} onChange={(e) => setCaptions((cs) => ops.setWordTiming(cs, cap.id, w.id, w.startMs, Number(e.target.value)), `wt:${w.id}`)} />
          <Badge tone={w.timingSource === "manual" ? "accent" : w.timingSource === "interpolated" ? "warn" : "mute"}>{w.timingSource === "interpolated" ? "est." : w.timingSource}</Badge>
          {i > 0 ? <Tip text="Start a new caption at this word"><Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label={`Split before ${w.text}`} onClick={() => setCaptions((cs) => ops.splitCaption(cs, cap.id, i))}><Split size={12} /></Button></Tip> : <span className="w-6" />}
          <Tip text="Delete this word from the subtitles only (footage is untouched)"><Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label={`Delete word ${w.text}`} onClick={() => setCaptions((cs) => ops.deleteWord(cs, cap.id, w.id))}><Trash2 size={12} /></Button></Tip>
        </div>
      ))}
    </div>
  );
}

function CaptionRow({ cap, selected, hasNext }: { cap: Caption; selected: boolean; hasNext: boolean }) {
  const st = useEditor.getState;
  const seek = useSeek();
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const commit = () => { if (draft !== null && draft !== cap.text) st().setCaptions((cs) => ops.editCaptionText(cs, cap.id, draft)); setDraft(null); };
  const lowConf = cap.confidence < 0.5;
  return (
    <li className={cn("rounded-lg border p-2 transition-colors", selected ? "border-accent bg-accent/10" : "border-line bg-panel-2/60")} onClick={() => st().select({ captionId: cap.id })}>
      <div className="mb-1 flex items-center gap-1.5">
        <button className="rounded bg-bg px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-accent-2 hover:bg-line" onClick={(e) => { e.stopPropagation(); seek.fromSource(cap.startMs); }} aria-label={`Jump to ${fmtTime(cap.startMs)}`}>{fmtTime(cap.startMs)}</button>
        {lowConf ? <Badge tone="warn">check</Badge> : null}
        {cap.styleId || cap.animationId ? <Badge tone="accent">custom style</Badge> : null}
        <div className="ml-auto flex">
          <Tip text="Expand word timing"><Button variant="ghost" size="icon" className="!h-6 !w-6" aria-expanded={open} aria-label="Word timing" onClick={(e) => { e.stopPropagation(); setOpen(!open); }}>{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</Button></Tip>
          <Tip text="Merge with the next caption"><Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label="Merge with next caption" disabled={!hasNext} onClick={(e) => { e.stopPropagation(); st().setCaptions((cs) => ops.mergeWithNext(cs, cap.id)); }}><Merge size={13} /></Button></Tip>
          <Tip text="Delete caption text (the footage stays)"><Button variant="ghost" size="icon" className="!h-6 !w-6" aria-label="Delete caption text only" onClick={(e) => { e.stopPropagation(); st().setCaptions((cs) => ops.deleteCaption(cs, cap.id)); }}><Trash2 size={13} /></Button></Tip>
          <Tip text="REMOVE this spoken segment from the video (adds a cut; undoable)"><Button variant="danger" size="icon" className="!h-6 !w-6" aria-label="Remove this segment from the video" onClick={(e) => { e.stopPropagation(); st().addCut(cap.startMs, cap.endMs, "transcript"); }}><Scissors size={13} /></Button></Tip>
        </div>
      </div>
      <textarea aria-label={`Caption text at ${fmtTime(cap.startMs)}`} dir="auto" rows={Math.min(4, Math.max(1, Math.ceil(cap.text.length / 34)))} className="field resize-none !text-[13px] leading-snug" value={draft ?? cap.text} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); } }} />
      {open ? <WordTimingEditor cap={cap} /> : null}
    </li>
  );
}

export function CaptionsPanel() {
  const project = useEditor((s) => s.project)!;
  const sel = useEditor((s) => s.selection);
  const meta = useMeta();
  const seek = useSeek();
  const [q, setQ] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const sorted = useMemo(() => [...project.captions].sort((a, b) => a.startMs - b.startMs), [project.captions]);
  const matches = useMemo(() => (q.trim() ? new Set(ops.searchCaptions(sorted, q).map((c) => c.id)) : null), [q, sorted]);
  const shown = matches ? sorted.filter((c) => matches.has(c.id)) : sorted;

  const exportAs = (kind: "srt" | "vtt") => {
    const out = captionsToOutput(project.captions, meta.segments).map((c) => ({ text: c.words.map((w) => w.text).join(" "), startMs: c.startMs, endMs: c.endMs }));
    download(`${project.name}.${kind}`, kind === "srt" ? toSRT(out) : toVTT(out), "text/plain");
  };
  const onImport = async (f: File) => {
    const cues = parseSubtitles(await f.text());
    if (!cues.length) return window.alert("No cues were found in that file. Is it a valid SRT or WebVTT file?");
    if (project.captions.length && !window.confirm(`Replace the ${project.captions.length} current captions with ${cues.length} imported cues?`)) return;
    useEditor.getState().setCaptions(() => cuesToCaptions(cues));
  };

  return (
    <div className="space-y-4 p-4">
      <TranscribeControls />
      <div className="flex flex-wrap items-center gap-1.5">
        <Button size="sm" onClick={() => file.current?.click()}><Upload size={13} /> Import SRT/VTT</Button>
        <input ref={file} type="file" accept=".srt,.vtt,text/vtt,application/x-subrip" className="sr-only" aria-label="Import subtitle file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onImport(f); e.target.value = ""; }} />
        <Tip text="Exports caption timing as it appears in the final video (cuts applied)"><Button size="sm" disabled={!project.captions.length} onClick={() => exportAs("srt")}><Download size={13} /> SRT</Button></Tip>
        <Button size="sm" disabled={!project.captions.length} onClick={() => exportAs("vtt")}><Download size={13} /> VTT</Button>
        <Tip text="Re-split all words into groups using the template's 'words per group'"><Button size="sm" disabled={!project.captions.length} onClick={() => useEditor.getState().regroup()}>Regroup by words</Button></Tip>
        <Tip text="Group by time window using @remotion/captions (TikTok-style pages)"><Button size="sm" disabled={!project.captions.length} onClick={() => useEditor.getState().setCaptions((cs) => groupWithRemotionCaptions([...cs].sort((a, b) => a.startMs - b.startMs).flatMap((c) => c.words), 1200))}>Regroup by time</Button></Tip>
      </div>
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
        <input className="field !pl-8" placeholder="Search spoken text…" aria-label="Search transcript" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && shown[0]) { seek.fromSource(shown[0].startMs); useEditor.getState().select({ captionId: shown[0].id }); } }} />
      </div>
      {q ? <p className="text-[11px] text-mute">{shown.length} match{shown.length === 1 ? "" : "es"} · Enter jumps to the first</p> : null}
      {sorted.length === 0 ? <p className="rounded-lg border border-dashed border-line p-4 text-center text-[12px] text-mute">No captions yet. Transcribe the video or import an SRT/VTT file.</p> : null}
      <p className="text-[10px] leading-snug text-mute">Pencil edits change <b>subtitle text</b>. The red scissors <Scissors size={10} className="inline" aria-hidden /> removes that spoken segment from the <b>video</b>.</p>
      <ul className="space-y-2">
        {shown.map((c) => <CaptionRow key={c.id} cap={c} selected={sel.captionId === c.id} hasNext={sorted[sorted.length - 1].id !== c.id} />)}
      </ul>
    </div>
  );
}
