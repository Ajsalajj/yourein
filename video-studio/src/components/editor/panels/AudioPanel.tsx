"use client";
import { useRef } from "react";
import { Upload } from "lucide-react";
import { useEditor } from "@/store/editor";
import { Button, Section, Slider, Status, Switch } from "@/components/ui";
import { useAudioUpload } from "./MediaPanel";

export function AudioPanel() {
  const audio = useEditor((s) => s.project!.audio);
  const assets = useEditor((s) => s.project!.assets);
  const setAudio = useEditor((s) => s.setAudio);
  const up = useAudioUpload();
  const input = useRef<HTMLInputElement>(null);
  const audioAssets = Object.values(assets).filter((a) => a.kind === "audio");
  const music = audio.music;
  const setMusic = (patch: Partial<NonNullable<typeof music>>) => music && setAudio({ music: { ...music, ...patch } });
  return (
    <div>
      <Section title="Original audio">
        <Slider label="Volume" value={Math.round(audio.originalVolume * 100)} min={0} max={200} onChange={(v) => setAudio({ originalVolume: v / 100 })} format={(v) => `${v}%`} />
        <Slider label="Fade in" value={audio.fadeInMs} min={0} max={5000} step={100} onChange={(v) => setAudio({ fadeInMs: v })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
        <Slider label="Fade out" value={audio.fadeOutMs} min={0} max={5000} step={100} onChange={(v) => setAudio({ fadeOutMs: v })} format={(v) => `${(v / 1000).toFixed(1)} s`} />
        <p className="text-[11px] text-mute">Fades also apply to the music track.</p>
      </Section>
      <Section title="Music track">
        <select aria-label="Music track" className="field" value={music?.assetId ?? ""} onChange={(e) => setAudio({ music: e.target.value ? { assetId: e.target.value, volume: music?.volume ?? 0.25, ducking: music?.ducking ?? true, duckLevel: music?.duckLevel ?? 0.35, loop: music?.loop ?? true } : null })}>
          <option value="">No music</option>
          {audioAssets.map((a) => <option key={a.id} value={a.id}>{a.filename}</option>)}
        </select>
        <Button size="sm" onClick={() => input.current?.click()}><Upload size={13} /> Upload audio</Button>
        <input ref={input} type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,audio/*" className="sr-only" aria-label="Upload music" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const a = await up.run(f); if (a) useEditor.getState().setAudio({ music: { assetId: a.id, volume: 0.25, ducking: true, duckLevel: 0.35, loop: true } }); }} />
        {up.state ? <p role="status" className="text-[12px] text-mute">Uploading {Math.round((up.state.loaded / up.state.total) * 100)}%…</p> : null}
        {up.error ? <p role="alert" className="text-[12px] text-danger">{up.error}</p> : null}
        {music ? (
          <>
            <Slider label="Music volume" value={Math.round(music.volume * 100)} min={0} max={100} onChange={(v) => setMusic({ volume: v / 100 })} format={(v) => `${v}%`} />
            <Switch label="Duck music under speech" checked={music.ducking} onChange={(v) => setMusic({ ducking: v })} />
            {music.ducking ? <Slider label="Level while speaking" value={Math.round(music.duckLevel * 100)} min={0} max={100} onChange={(v) => setMusic({ duckLevel: v / 100 })} format={(v) => `${v}% of music volume`} /> : null}
            <Switch label="Loop to video length" checked={music.loop} onChange={(v) => setMusic({ loop: v })} />
          </>
        ) : null}
      </Section>
      <div className="space-y-3 p-4">
        <Status kind="not-implemented">Sound effects have their own tab (SFX). Noise reduction is not built. Music, volume, fades and ducking above work in preview and export; ducking follows the caption timing and any sound effect marked &ldquo;duck music&rdquo;.</Status>
      </div>
    </div>
  );
}
