"use client";
import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, Download, Loader2, X, XCircle } from "lucide-react";
import { useEditor } from "@/store/editor";
import { saveNow } from "@/store/autosave";
import { api, fmtBytes, fmtTime } from "@/lib/client";
import { ASPECTS } from "@/lib/project";
import { Button, Field } from "@/components/ui";
import { useMeta } from "./context";

interface Job {
  id: string; status: string; progress: number; error?: string; quality: string; width: number; height: number; fps: number; durationInFrames: number; outputBytes?: number; filename?: string;
  verification?: { ok: boolean; problems: string[]; width: number; height: number; codec: string; durationMs: number; expectedDurationMs: number; hasAudio: boolean; audioCodec: string | null };
}
const LABEL: Record<string, string> = { queued: "Queued", bundling: "Preparing the renderer (first export bundles the project)", preparing: "Preparing composition", rendering: "Rendering frames", verifying: "Verifying the MP4", done: "Done", failed: "Failed", cancelled: "Cancelled" };
const ACTIVE = ["queued", "bundling", "preparing", "rendering", "verifying"];

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const project = useEditor((s) => s.project)!;
  const meta = useMeta();
  const [quality, setQuality] = useState<"standard" | "high">("standard");
  const [job, setJob] = useState<Job | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const running = !!job && ACTIVE.includes(job.status);

  useEffect(() => {
    if (!job || !ACTIVE.includes(job.status)) return;
    timer.current = setTimeout(async () => {
      try { setJob((await api<{ job: Job }>(`/api/projects/${project.id}/export/${job.id}`)).job); } catch (e) { setErr((e as Error).message); }
    }, 700);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [job, project.id]);

  const start = async () => {
    setErr(null); setJob(null);
    try {
      await saveNow(); // the renderer reads the saved project, so flush first
      if (useEditor.getState().saveState === "error") throw new Error("Could not save the project before exporting");
      setJob((await api<{ job: Job }>(`/api/projects/${project.id}/export`, { method: "POST", body: JSON.stringify({ quality }) })).job);
    } catch (e) { setErr((e as Error).message); }
  };
  const cancel = async () => { if (job) setJob((await api<{ job: Job }>(`/api/projects/${project.id}/export/${job.id}`, { method: "DELETE" })).job); };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o && running) return; onOpenChange(o); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content className="panel fixed left-1/2 top-1/2 z-50 w-[480px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl">
          <div className="mb-4 flex items-start justify-between">
            <div><Dialog.Title className="text-lg font-semibold">Export MP4</Dialog.Title><Dialog.Description className="text-[12px] text-mute">H.264 + AAC · no watermark · rendered with the same composition as the preview</Dialog.Description></div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Close" disabled={running}><X size={16} /></Button></Dialog.Close>
          </div>

          <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 rounded-lg bg-panel-2 p-3 text-[12px]">
            <dt className="text-mute">Size</dt><dd>{meta.width}×{meta.height} ({ASPECTS[project.aspect].label})</dd>
            <dt className="text-mute">Frame rate</dt><dd>{meta.fps} fps</dd>
            <dt className="text-mute">Duration</dt><dd>{fmtTime((meta.durationInFrames * 1000) / meta.fps)} ({meta.durationInFrames} frames)</dd>
            <dt className="text-mute">Captions</dt><dd>{project.captionsVisible ? `${project.captions.length} · ${getName(project.captionStyle.templateId)}` : "hidden"}</dd>
          </dl>

          {!job || !ACTIVE.includes(job.status) ? (
            <div className="mb-4 grid grid-cols-2 gap-3">
              <Field label="Quality"><select className="field" value={quality} onChange={(e) => setQuality(e.target.value as "standard" | "high")}><option value="standard">Standard (CRF 20)</option><option value="high">High (CRF 16, larger file)</option></select></Field>
              <Field label="Frame rate"><select className="field" value={project.fps} onChange={(e) => useEditor.getState().setFps(Number(e.target.value))}><option value={30}>30 fps</option><option value={60}>60 fps (slower)</option></select></Field>
            </div>
          ) : null}

          {err ? <p role="alert" className="mb-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-[12px] text-danger">{err}</p> : null}

          {job ? (
            <div className="mb-4 space-y-2" role="status" aria-live="polite">
              <div className="flex items-center gap-2 text-[13px]">
                {running ? <Loader2 size={15} className="animate-spin text-accent" /> : job.status === "done" ? <CheckCircle2 size={16} className="text-ok" /> : <XCircle size={16} className="text-danger" />}
                <span>{LABEL[job.status] ?? job.status}</span>
              </div>
              {running ? <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={Math.round(job.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent transition-[width]" style={{ width: `${Math.max(2, job.progress * 100)}%` }} /></div> : null}
              {running ? <p className="text-[11px] text-mute">{Math.round(job.progress * 100)}%</p> : null}
              {job.error && job.status !== "cancelled" ? <p className="rounded-md border border-danger/30 bg-danger/10 p-2 text-[12px] text-danger">{job.error}</p> : null}
              {job.status === "done" && job.verification ? (
                <ul className="space-y-0.5 rounded-md bg-panel-2 p-2 text-[11px] text-mute">
                  <li>✓ {job.verification.codec} {job.verification.width}×{job.verification.height}, {fmtBytes(job.outputBytes ?? 0)}</li>
                  <li>✓ duration {fmtTime(job.verification.durationMs)} (expected {fmtTime(job.verification.expectedDurationMs)})</li>
                  <li>{job.verification.hasAudio ? `✓ audio track (${job.verification.audioCodec})` : "– no audio track"}</li>
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            {running ? <Button variant="danger" onClick={cancel}>Cancel render</Button> : null}
            {!running ? <Button variant={job?.status === "done" ? "secondary" : "primary"} onClick={start}>{job ? "Render again" : "Start export"}</Button> : null}
            {job?.status === "done" ? <a href={`/api/projects/${project.id}/export/${job.id}/download`} download className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-[13px] font-semibold text-[#0b0c10] hover:bg-[#a094ff]"><Download size={15} /> Download {job.filename ?? "video.mp4"}</a> : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
import { getTemplate } from "@/remotion/templates/registry";
const getName = (id: string) => getTemplate(id).name;
