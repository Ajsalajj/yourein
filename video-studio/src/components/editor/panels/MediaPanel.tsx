"use client";
import { useRef, useState } from "react";
import { Film, Music, Upload } from "lucide-react";
import { useEditor } from "@/store/editor";
import { fmtBytes, fmtTime, mediaUrl, uploadFile } from "@/lib/client";
import { Button } from "@/components/ui";
import { validateUpload } from "@/lib/upload";

export function useAudioUpload() {
  const [state, setState] = useState<{ loaded: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (file: File) => {
    const id = useEditor.getState().project!.id;
    const v = validateUpload({ filename: file.name, size: file.size, kind: "audio" });
    if (!v.ok) return setError(v.error);
    setError(null);
    try {
      setState({ loaded: 0, total: file.size });
      const { asset } = await uploadFile(id, file, "audio", (loaded, total) => setState({ loaded, total }));
      useEditor.getState().commit((p) => ({ ...p, assets: { ...p.assets, [asset.id]: asset } }));
      return asset;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState(null);
    }
  };
  return { run, state, error };
}

export function MediaPanel() {
  const project = useEditor((s) => s.project)!;
  const up = useAudioUpload();
  const input = useRef<HTMLInputElement>(null);
  const assets = Object.values(project.assets);
  return (
    <div className="space-y-4 p-4">
      <ul className="space-y-2">
        {assets.map((a) => (
          <li key={a.id} className="flex gap-3 rounded-lg border border-line bg-panel-2/60 p-2">
            <div className="grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded bg-bg">
              {a.thumbnailKey ? <img src={`${mediaUrl(project.id, a.id)}?thumb=1`} alt="" className="h-full w-full object-cover" /> : a.kind === "audio" ? <Music size={18} className="text-mute" aria-hidden /> : <Film size={18} className="text-mute" aria-hidden />}
            </div>
            <div className="min-w-0 text-[12px]">
              <p className="truncate font-medium">{a.filename}{a.id === project.sourceAssetId ? <span className="ml-1.5 text-[10px] text-accent">source</span> : null}</p>
              <p className="text-mute">{fmtTime(a.durationMs)} · {fmtBytes(a.sizeBytes)}</p>
              {a.kind === "video" ? <p className="text-mute">{a.width}×{a.height} · {a.fps ? `${a.fps} fps` : "fps ?"} · {a.hasAudio ? "audio" : "no audio"}</p> : null}
            </div>
          </li>
        ))}
      </ul>
      <Button className="w-full" onClick={() => input.current?.click()}><Upload size={14} /> Add audio (music / effects)</Button>
      <input ref={input} type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*" className="sr-only" aria-label="Add an audio file" onChange={(e) => { const f = e.target.files?.[0]; if (f) void up.run(f); e.target.value = ""; }} />
      {up.state ? <p role="status" className="text-[12px] text-mute">Uploading {Math.round((up.state.loaded / up.state.total) * 100)}%…</p> : null}
      {up.error ? <p role="alert" className="text-[12px] text-danger">{up.error}</p> : null}
      <p className="text-[11px] leading-relaxed text-mute">To edit a different video, start a new project from the dashboard. Only royalty-free or properly licensed audio should be used.</p>
    </div>
  );
}
