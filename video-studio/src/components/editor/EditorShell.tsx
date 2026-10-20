"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { PlayerRef } from "@remotion/player";
import { ArrowLeft, Check, CloudOff, Download, Loader2, Settings } from "lucide-react";
import { useEditor } from "@/store/editor";
import { saveNow } from "@/store/autosave";
import { useTranscription } from "@/store/transcription";
import { api } from "@/lib/client";
import type { Project } from "@/lib/project";
import { Button } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { PlayerContext } from "./context";
import { PlayerPane } from "./PlayerPane";
import { Timeline } from "./Timeline";
import { LeftPanel } from "./LeftPanel";
import { useUi } from "@/store/ui";
import { RightPanel } from "./RightPanel";
import { ExportDialog } from "./ExportDialog";

function SaveBadge() {
  const s = useEditor((x) => x.saveState);
  const err = useEditor((x) => x.saveError);
  const map = { idle: ["", "text-mute"], dirty: ["Unsaved changes", "text-warn"], saving: ["Saving…", "text-mute"], saved: ["All changes saved", "text-ok"], error: [`Save failed: ${err ?? ""}`, "text-danger"] } as const;
  const [label, cls] = map[s];
  return <span className={`flex items-center gap-1 text-[12px] ${cls}`} role="status" aria-live="polite">{s === "saving" ? <Loader2 size={12} className="animate-spin" /> : s === "saved" ? <Check size={12} /> : s === "error" ? <CloudOff size={12} /> : null}{label}</span>;
}

export function EditorShell({ projectId }: { projectId: string }) {
  const playerRef = useRef<PlayerRef | null>(null);
  const project = useEditor((s) => s.project);
  const rev = useEditor((s) => s.rev);
  const saveState = useEditor((s) => s.saveState);
  const busy = useEditor((s) => s.busy);
  const [loadError, setLoadError] = useState<string | null>(null);
  const tab = useUi((s) => s.tab);
  const setTab = useUi((s) => s.setTab);
  const [exporting, setExporting] = useState(false);
  const params = useSearchParams();
  const started = useRef(false);

  useEffect(() => {
    let alive = true;
    api<{ project: Project }>(`/api/projects/${projectId}`).then(({ project: p }) => {
      if (!alive) return;
      useEditor.getState().load(p);
      useTranscription.getState().resume(projectId);
      if (!started.current && params.get("transcribe") === "1" && !p.transcript && p.sourceAssetId && p.assets[p.sourceAssetId]?.hasAudio) {
        started.current = true;
        window.history.replaceState(null, "", `/editor/${projectId}`);
        void useTranscription.getState().start(projectId, { language: null, engine: "auto" });
      }
    }).catch((e) => alive && setLoadError(e.message));
    return () => { alive = false; useEditor.setState({ project: null }); };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // autosave: debounce after every edit
  useEffect(() => {
    if (saveState !== "dirty" || busy) return;
    const t = setTimeout(() => void saveNow(), 1200);
    return () => clearTimeout(t);
  }, [rev, saveState, busy]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { const s = useEditor.getState().saveState; if (s === "dirty" || s === "saving" || s === "error") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  if (loadError) return <div className="grid h-screen place-items-center"><div className="text-center"><p className="mb-3 text-danger" role="alert">{loadError}</p><Link href="/projects" className="text-accent underline">Back to projects</Link></div></div>;
  if (!project) return <div className="grid h-screen place-items-center text-mute">Loading project…</div>;

  return (
    <PlayerContext.Provider value={playerRef}>
      <div className="flex h-screen min-h-[640px] flex-col overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
          <Link href="/projects" aria-label="Back to projects" className="rounded-md p-1.5 text-mute hover:bg-panel-2 hover:text-text"><ArrowLeft size={16} /></Link>
          <Logo size={18} />
          <input aria-label="Project name" className="w-64 rounded-md border border-transparent bg-transparent px-2 py-1 text-[14px] font-medium hover:border-line focus:border-accent focus:outline-none" value={project.name} onChange={(e) => useEditor.getState().rename(e.target.value)} />
          <SaveBadge />
          <div className="ml-auto flex items-center gap-2">
            <Link href="/settings" aria-label="Settings" className="rounded-md p-1.5 text-mute hover:bg-panel-2 hover:text-text"><Settings size={16} /></Link>
            <Button variant="primary" onClick={() => setExporting(true)}><Download size={15} /> Export</Button>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <LeftPanel tab={tab} onTab={setTab} />
          <main className="flex min-w-0 flex-1 flex-col"><PlayerPane /></main>
          <RightPanel />
        </div>
        <Timeline />
        <ExportDialog open={exporting} onOpenChange={setExporting} />
      </div>
    </PlayerContext.Provider>
  );
}
