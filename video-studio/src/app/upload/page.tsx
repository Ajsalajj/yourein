"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, X, AlertTriangle } from "lucide-react";
import { SiteNav } from "@/components/Logo";
import { Button } from "@/components/ui";
import { api, ApiError, fmtBytes, uploadFile } from "@/lib/client";
import { validateUpload } from "@/lib/upload";
import type { Project } from "@/lib/project";

type Phase = { kind: "idle" } | { kind: "uploading"; name: string; loaded: number; total: number } | { kind: "analysing"; name: string } | { kind: "error"; message: string };

export default function UploadPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [over, setOver] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const start = useCallback(async (file: File) => {
    const check = validateUpload({ filename: file.name, size: file.size, kind: "video" });
    if (!check.ok) return setPhase({ kind: "error", message: check.error });
    let projectId: string | null = null;
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      setPhase({ kind: "uploading", name: file.name, loaded: 0, total: file.size });
      const { project } = await api<{ project: Project }>("/api/projects", { method: "POST", body: JSON.stringify({ name: file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Untitled project" }) });
      projectId = project.id;
      await uploadFile(project.id, file, "video", (loaded, total) => {
        setPhase(loaded >= total ? { kind: "analysing", name: file.name } : { kind: "uploading", name: file.name, loaded, total });
      }, ctl.signal);
      router.push(`/editor/${project.id}?transcribe=1`);
    } catch (e) {
      if (projectId) await api(`/api/projects/${projectId}`, { method: "DELETE" }).catch(() => {});
      setPhase({ kind: "error", message: e instanceof ApiError ? e.message : "Upload failed" });
    }
  }, [router]);

  const busy = phase.kind === "uploading" || phase.kind === "analysing";
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-2xl px-5 py-14">
        <h1 className="text-2xl font-semibold tracking-tight">Upload a video</h1>
        <p className="mt-1.5 text-[13px] text-mute">MP4, MOV or WebM — portrait, landscape or square. The file stays on this machine.</p>

        <div
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f && !busy) void start(f); }}
          className={`mt-8 rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${over ? "border-accent bg-accent/10" : "border-line bg-panel"}`}
        >
          {phase.kind === "uploading" || phase.kind === "analysing" ? (
            <div className="space-y-4" role="status" aria-live="polite">
              <p className="truncate text-sm font-medium">{phase.name}</p>
              {phase.kind === "uploading" ? (
                <>
                  <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((phase.loaded / phase.total) * 100)}>
                    <div className="h-full bg-accent transition-[width]" style={{ width: `${(phase.loaded / phase.total) * 100}%` }} />
                  </div>
                  <p className="text-[12px] text-mute">Uploading {fmtBytes(phase.loaded)} of {fmtBytes(phase.total)} ({Math.round((phase.loaded / phase.total) * 100)}%)</p>
                </>
              ) : (
                <p className="text-[12px] text-mute">Upload complete. Reading metadata and making a thumbnail…</p>
              )}
              <Button variant="ghost" size="sm" onClick={() => abort.current?.abort()}><X size={14} /> Cancel</Button>
            </div>
          ) : (
            <>
              <UploadCloud className="mx-auto mb-3 text-accent" size={36} aria-hidden />
              <p className="text-sm font-medium">Drag a video here</p>
              <p className="mb-5 text-[12px] text-mute">or choose a file</p>
              <Button variant="primary" size="lg" onClick={() => input.current?.click()}>Choose video</Button>
              <input ref={input} type="file" className="sr-only" accept=".mp4,.m4v,.mov,.webm,video/mp4,video/quicktime,video/webm" aria-label="Choose a video file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void start(f); e.target.value = ""; }} />
            </>
          )}
        </div>

        {phase.kind === "error" ? (
          <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden /> <span>{phase.message}</span>
          </div>
        ) : null}
      </main>
    </>
  );
}
