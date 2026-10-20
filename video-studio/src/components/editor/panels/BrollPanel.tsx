"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Search, Sparkles, Trash2, Upload, Wand2 } from "lucide-react";
import { useEditor } from "@/store/editor";
import { api, fmtTime, uploadFile } from "@/lib/client";
import { suggestBroll, clipFromSuggestion, overlappingBroll, type BrollSuggestion } from "@/lib/broll";
import { BROLL_MODES, TRANSITION_TYPES, type BrollClip } from "@/lib/edit-schema";
import { TRANSITIONS } from "@/lib/transitions";
import type { Asset } from "@/lib/project";
import { Badge, Button, Section, Slider } from "@/components/ui";
import { useMeta, useSeek } from "../context";

interface ProviderInfo { id: string; name: string; kind: "stock" | "library" | "generator"; ok: boolean; hint?: string; license: string }
interface Result { provider: string; id: string; title: string; thumbUrl: string; previewUrl: string; downloadUrl: string; durationSec: number; width: number; height: number; author: string; pageUrl: string; license: string }

const MODE_LABEL: Record<BrollClip["mode"], string> = { full: "Full frame", overlay: "Overlay (blend)", "split-top": "Split – clip on top", "split-bottom": "Split – clip below", "split-left": "Split – clip left", "split-right": "Split – clip right", pip: "Picture-in-picture" };

export function BrollPanel() {
  const project = useEditor((s) => s.project!);
  const frame = useEditor((s) => s.frame);
  const sel = useEditor((s) => s.selection);
  const meta = useMeta();
  const seek = useSeek();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [providerId, setProviderId] = useState("library");
  const [sugs, setSugs] = useState<BrollSuggestion[] | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [queries, setQueries] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, Result[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "info" | "error"; text: string } | null>(null);
  const [defMode, setDefMode] = useState<BrollClip["mode"]>("full");
  const [prompt, setPrompt] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => { api<{ providers: ProviderInfo[] }>("/api/broll/providers").then((r) => { setProviders(r.providers); const first = r.providers.find((p) => p.ok && p.kind !== "generator"); if (first) setProviderId(first.id); }).catch(() => undefined); }, []);

  const provider = providers.find((p) => p.id === providerId);
  const orientation = project.aspect === "9:16" ? "portrait" : project.aspect === "16:9" ? "landscape" : "square";
  const analyze = () => {
    const s = suggestBroll(project, meta.segments);
    setSugs(s);
    setQueries(Object.fromEntries(s.map((x) => [x.id, x.query])));
    setMsg({ kind: "info", text: s.length ? `${s.length} places found where the speech mentions something filmable. Nothing is inserted until you pick a clip.` : "No filmable subjects found in the captions (or the captions are empty)." });
  };
  const search = async (sug: BrollSuggestion) => {
    setBusy(`search:${sug.id}`); setActive(sug.id);
    try {
      const r = await api<{ results: Result[] }>(`/api/broll/search?provider=${providerId}&q=${encodeURIComponent(queries[sug.id] ?? sug.query)}&orientation=${orientation}&minDuration=1`);
      setResults((x) => ({ ...x, [sug.id]: r.results }));
      if (!r.results.length) setMsg({ kind: "info", text: `No results for “${queries[sug.id] ?? sug.query}” in ${provider?.name ?? providerId}. Try other words.` });
    } catch (e) { setMsg({ kind: "error", text: (e as Error).message }); } finally { setBusy(null); }
  };
  const importResult = async (r: Result): Promise<Asset> => {
    const res = await api<{ asset: Asset }>(`/api/projects/${project.id}/broll/import`, { method: "POST", body: JSON.stringify({ provider: r.provider, id: r.id, downloadUrl: r.downloadUrl, title: r.title }) });
    useEditor.getState().commit((p) => ({ ...p, assets: { ...p.assets, [res.asset.id]: res.asset } }));
    return res.asset;
  };
  const place = (sug: Pick<BrollSuggestion, "startMs" | "endMs" | "keywords" | "sentence">, asset: Asset, r?: Result, replaceId?: string) => {
    const credit = r && r.provider !== "library" ? { provider: r.provider, id: r.id, author: r.author, url: r.pageUrl, license: r.license } : null;
    const clip = clipFromSuggestion(sug, asset.id, asset.durationMs, { mode: defMode, credit, auto: false });
    useEditor.getState().setBroll((l) => [...l.filter((c) => c.id !== replaceId), replaceId ? { ...clip, id: replaceId } : clip]);
    useEditor.getState().select({ brollId: replaceId ?? clip.id });
    seek.fromSource(sug.startMs);
  };
  const use = async (sug: BrollSuggestion, r: Result) => {
    setBusy(`use:${r.id}`);
    try { const asset = await importResult(r); place(sug, asset, r); setMsg({ kind: "info", text: `Placed “${r.title}” at ${fmtTime(sug.startMs)} (${(Math.min(asset.durationMs, sug.endMs - sug.startMs) / 1000).toFixed(1)} s). Your speaker audio keeps playing.` }); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); } finally { setBusy(null); }
  };
  const autoFill = async () => {
    if (!sugs) return;
    setBusy("auto");
    let placed = 0;
    for (const s of sugs) {
      try {
        const r = await api<{ results: Result[] }>(`/api/broll/search?provider=${providerId}&q=${encodeURIComponent(queries[s.id] ?? s.query)}&orientation=${orientation}&minDuration=1`);
        const best = r.results.find((x) => x.durationSec >= (s.endMs - s.startMs) / 1000) ?? r.results[0];
        if (!best) continue;
        const asset = await importResult(best);
        place(s, asset, best);
        placed++;
      } catch (e) { setMsg({ kind: "error", text: (e as Error).message }); break; }
    }
    setBusy(null);
    setMsg((m) => (m?.kind === "error" ? m : { kind: "info", text: `Auto-fill placed ${placed} of ${sugs.length} clips. Review each one: you can replace or delete any of them.` }));
  };
  const uploadOwn = async (f: File) => {
    setBusy("upload");
    try { const { asset } = await uploadFile(project.id, f, "video", () => undefined); useEditor.getState().commit((p) => ({ ...p, assets: { ...p.assets, [asset.id]: asset } })); setMsg({ kind: "info", text: `${asset.filename} added. Use “Place at playhead” below.` }); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); } finally { setBusy(null); }
  };
  const generate = async () => {
    setBusy("gen");
    try { const r = await api<{ asset: Asset }>(`/api/projects/${project.id}/broll/generate`, { method: "POST", body: JSON.stringify({ prompt, durationSec: 4, aspect: project.aspect }) }); useEditor.getState().commit((p) => ({ ...p, assets: { ...p.assets, [r.asset.id]: r.asset } })); setMsg({ kind: "info", text: "Generated clip added to your clips below." }); }
    catch (e) { setMsg({ kind: "error", text: (e as Error).message }); } finally { setBusy(null); }
  };

  const clips = useMemo(() => [...project.broll].sort((a, b) => a.startMs - b.startMs), [project.broll]);
  const selected = project.broll.find((c) => c.id === sel.brollId);
  const patch = (id: string, p: Partial<BrollClip>) => useEditor.getState().setBroll((l) => l.map((c) => (c.id === id ? { ...c, ...p } : c)), `br:${id}:${Object.keys(p).join(",")}`);
  const overlaps = new Set(overlappingBroll(project.broll));
  const ownClips = Object.values(project.assets).filter((a) => a.kind === "video" && a.id !== project.sourceAssetId);
  const gen = providers.find((p) => p.kind === "generator");

  return (
    <div>
      <Section title="Sources" right={<Badge tone="ok">{providers.filter((p) => p.ok).length} ready</Badge>}>
        <div className="space-y-1">
          {providers.filter((p) => p.kind !== "generator").map((p) => (
            <label key={p.id} className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] ${providerId === p.id ? "bg-accent/15 ring-1 ring-accent" : "bg-panel-2"} ${p.ok ? "" : "opacity-60"}`}>
              <input type="radio" name="broll-provider" className="mt-0.5" checked={providerId === p.id} disabled={!p.ok} onChange={() => setProviderId(p.id)} />
              <span><span className="font-medium">{p.name}</span> <span className="text-mute">· {p.license}</span><br /><span className="text-[11px] text-mute">{p.ok ? p.hint ?? "ready" : p.hint}</span></span>
            </label>
          ))}
        </div>
        <label className="block text-[11px] text-mute">Default layout for new clips
          <select aria-label="Default B-roll layout" className="field mt-1" value={defMode} onChange={(e) => setDefMode(e.target.value as BrollClip["mode"])}>{BROLL_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select>
        </label>
      </Section>

      <Section title="Find places for B-roll">
        <p className="text-[11px] leading-relaxed text-mute">Reads your captions, finds sentences that mention something filmable (people, places, objects), and proposes a slot and a search query for each.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={analyze}><Sparkles size={13} /> Analyze transcript</Button>
          {sugs?.length ? <Button size="sm" disabled={!provider?.ok || busy !== null} onClick={autoFill}>{busy === "auto" ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />} Auto-fill all</Button> : null}
        </div>
        {msg ? <p role={msg.kind === "error" ? "alert" : "status"} className={`text-[11px] ${msg.kind === "error" ? "text-danger" : "text-mute"}`}>{msg.text}</p> : null}
        <ul className="space-y-2">
          {sugs?.map((s) => (
            <li key={s.id} className="rounded-lg border border-line p-2">
              <button className="w-full text-left" onClick={() => { setActive(s.id); seek.fromSource(s.startMs); }}>
                <span className="text-[11px] tabular-nums text-mute">{fmtTime(s.startMs)}–{fmtTime(s.endMs)}</span>
                <span className="mt-0.5 block text-[12px] leading-snug">{s.sentence}</span>
                <span className="mt-0.5 block text-[11px] text-mute">{s.reason}</span>
              </button>
              <div className="mt-1.5 flex gap-1">
                <input aria-label="Search words" className="field flex-1" value={queries[s.id] ?? s.query} onChange={(e) => setQueries((q) => ({ ...q, [s.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") void search(s); }} />
                <Button size="sm" variant="secondary" disabled={!provider?.ok || busy !== null} onClick={() => search(s)}>{busy === `search:${s.id}` ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}</Button>
              </div>
              {active === s.id && results[s.id]?.length ? (
                <ul className="mt-2 grid grid-cols-2 gap-1.5">
                  {results[s.id].map((r) => (
                    <li key={`${r.provider}:${r.id}`} className="overflow-hidden rounded-md bg-panel-2">
                      <button aria-label={`Preview ${r.title}`} className="block w-full" onClick={() => setPreviewUrl(r.previewUrl)}>{r.thumbUrl ? <img src={r.thumbUrl} alt="" className="aspect-video w-full object-cover" /> : <div className="aspect-video bg-bg" />}</button>
                      <div className="p-1.5 text-[10px] leading-tight text-mute"><span className="block truncate text-text">{r.title}</span>{r.durationSec.toFixed(1)}s · {r.width}×{r.height}{r.author ? ` · ${r.author}` : ""}</div>
                      <Button size="sm" className="m-1.5 mt-0" disabled={busy !== null} onClick={() => use(s, r)}>{busy === `use:${r.id}` ? "Importing…" : "Use"}</Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
        {previewUrl ? <div className="space-y-1"><video src={previewUrl} controls autoPlay muted loop className="max-h-48 w-full rounded-md bg-black" /><Button size="sm" variant="ghost" onClick={() => setPreviewUrl(null)}>Close preview</Button></div> : null}
      </Section>

      <Section title="Your clips & generation">
        <Button size="sm" onClick={() => file.current?.click()} disabled={busy === "upload"}><Upload size={13} /> Upload a clip</Button>
        <input ref={file} type="file" accept=".mp4,.mov,.webm,.m4v,video/*" className="sr-only" aria-label="Upload B-roll clip" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadOwn(f); }} />
        {ownClips.length ? (
          <ul className="space-y-1">
            {ownClips.map((a) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg bg-panel-2 px-2 py-1.5 text-[12px]">
                <span className="min-w-0 flex-1 truncate">{a.filename} <span className="text-mute">{(a.durationMs / 1000).toFixed(1)}s</span></span>
                <Button size="sm" variant="ghost" onClick={() => { const at = seek.sourceNow(frame); place({ startMs: at, endMs: at + 2600, keywords: [], sentence: a.filename }, a); }}>Place at playhead</Button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-1 rounded-lg border border-line p-2">
          <span className="text-[12px] font-medium">AI generation <Badge tone={gen?.ok ? "ok" : "mute"}>{gen?.ok ? "configured" : "not configured"}</Badge></span>
          <input aria-label="Generation prompt" className="field" placeholder="Describe the shot…" value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={!gen?.ok} />
          <Button size="sm" variant="secondary" disabled={!gen?.ok || prompt.trim().length < 3 || busy !== null} onClick={generate}>{busy === "gen" ? "Generating…" : "Generate clip"}</Button>
          {!gen?.ok ? <p className="text-[11px] text-mute">{gen?.hint}</p> : null}
        </div>
      </Section>

      <Section title="B-roll on the timeline" right={<Badge tone="accent">{clips.length}</Badge>}>
        {clips.length === 0 ? <p className="text-[12px] text-mute">Nothing placed yet.</p> : null}
        <ul className="space-y-1">
          {clips.map((c) => (
            <li key={c.id}><button onClick={() => { useEditor.getState().select({ brollId: c.id }); seek.fromSource(c.startMs); }} aria-pressed={sel.brollId === c.id} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] ${sel.brollId === c.id ? "bg-accent/20 ring-1 ring-accent" : "bg-panel-2"}`}>
              <span className="w-12 tabular-nums text-mute">{fmtTime(c.startMs)}</span>
              <span className="min-w-0 flex-1 truncate">{project.assets[c.assetId]?.filename ?? "missing clip"}</span>
              {overlaps.has(c.id) ? <Badge tone="warn">overlaps</Badge> : null}<Badge>{c.mode}</Badge>
            </button></li>
          ))}
        </ul>
        {selected ? (
          <div className="space-y-2 rounded-lg border border-line p-2">
            <div className="flex items-center justify-between"><span className="text-[12px] font-medium">{project.assets[selected.assetId]?.filename}</span><Button variant="ghost" size="icon" aria-label="Delete B-roll" onClick={() => { useEditor.getState().setBroll((l) => l.filter((c) => c.id !== selected.id)); useEditor.getState().select({ brollId: null }); }}><Trash2 size={13} /></Button></div>
            <select aria-label="B-roll layout" className="field" value={selected.mode} onChange={(e) => patch(selected.id, { mode: e.target.value as BrollClip["mode"] })}>{BROLL_MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}</select>
            <Slider label="Start" value={Math.round(selected.startMs)} min={0} max={Math.round(project.assets[project.sourceAssetId ?? ""]?.durationMs ?? 60000)} step={50} onChange={(v) => patch(selected.id, { startMs: v, endMs: v + (selected.endMs - selected.startMs) })} format={(v) => fmtTime(v)} />
            <Slider label="Length" value={Math.round(selected.endMs - selected.startMs)} min={500} max={Math.max(1000, Math.round((project.assets[selected.assetId]?.durationMs ?? 8000) - selected.clipInMs))} step={50} onChange={(v) => patch(selected.id, { endMs: selected.startMs + v })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
            <Slider label="Start inside clip" value={selected.clipInMs} min={0} max={Math.max(0, Math.round((project.assets[selected.assetId]?.durationMs ?? 0) - 500))} step={50} onChange={(v) => patch(selected.id, { clipInMs: v })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
            {selected.mode === "overlay" ? <Slider label="Opacity" value={Math.round(selected.opacity * 100)} min={10} max={100} onChange={(v) => patch(selected.id, { opacity: v / 100 })} format={(v) => `${v}%`} /> : null}
            {selected.mode === "full" ? (
              <div className="grid grid-cols-2 gap-1">
                {(["transitionIn", "transitionOut"] as const).map((k) => (
                  <label key={k} className="text-[11px] text-mute">{k === "transitionIn" ? "In" : "Out"}
                    <select aria-label={`B-roll ${k}`} className="field mt-0.5" value={selected[k] ?? ""} onChange={(e) => patch(selected.id, { [k]: e.target.value || null } as Partial<BrollClip>)}><option value="">Cut</option>{TRANSITION_TYPES.map((t) => <option key={t} value={t}>{TRANSITIONS.find((x) => x.id === t)?.name}</option>)}</select>
                  </label>
                ))}
              </div>
            ) : <Slider label="Slide-in time" value={selected.transitionMs} min={120} max={1500} step={20} onChange={(v) => patch(selected.id, { transitionMs: v })} format={(v) => `${v} ms`} />}
            <p className="text-[11px] text-mute">Speaker audio is never muted by B-roll; the clip itself is silent.</p>
            {selected.credit ? <p className="text-[11px] text-mute">Credit: {selected.credit.provider}{selected.credit.author ? ` · ${selected.credit.author}` : ""} — {selected.credit.license}</p> : null}
            {selected.keywords.length ? <Button size="sm" variant="secondary" onClick={() => { const sug: BrollSuggestion = { id: selected.id, startMs: selected.startMs, endMs: selected.endMs, query: selected.keywords.join(" "), keywords: selected.keywords, score: 1, sentence: selected.note, reason: "replace" }; setSugs((l) => [sug, ...(l ?? []).filter((x) => x.id !== sug.id)]); setQueries((q) => ({ ...q, [sug.id]: sug.query })); setActive(sug.id); void search(sug); }}>Replace with another clip…</Button> : null}
          </div>
        ) : null}
      </Section>
    </div>
  );
}
