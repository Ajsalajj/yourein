"use client";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { SiteNav } from "@/components/Logo";
import { Badge } from "@/components/ui";
import { api } from "@/lib/client";

interface Health {
  ffmpeg: { ok: boolean; detail: string }; ffprobe: { ok: boolean; detail: string }; browser: { ok: boolean; detail: string };
  ai: { ok: boolean; detail: string; engines?: { id: string; available: boolean; modelReady?: boolean; languages: string[] | "auto"; note: string }[] };
  dataDir: string; maxUploadMb: number; authRequired: boolean;
}

const Row = ({ label, ok, detail }: { label: string; ok: boolean; detail: string }) => (
  <div className="flex items-start gap-3 border-b border-line py-3 last:border-0">
    {ok ? <CheckCircle2 size={18} className="mt-0.5 text-ok" aria-label="OK" /> : <XCircle size={18} className="mt-0.5 text-danger" aria-label="Problem" />}
    <div><div className="text-[13px] font-medium">{label}</div><div className="break-all text-[12px] text-mute">{detail}</div></div>
  </div>
);

export default function Settings() {
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { api<Health>("/api/health").then(setH).catch((e) => setErr(e.message)); }, []);
  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Settings & system status</h1>
        <p className="mb-6 mt-1 text-[13px] text-mute">Live checks of everything the editor depends on. Configuration lives in <code className="rounded bg-panel-2 px-1">.env.local</code> (see <code className="rounded bg-panel-2 px-1">.env.example</code>).</p>
        {err ? <p role="alert" className="text-danger">{err}</p> : null}
        {h ? (
          <>
            <section className="panel rounded-xl px-4"><Row label="FFmpeg" {...h.ffmpeg} /><Row label="ffprobe" {...h.ffprobe} /><Row label="Render browser (Remotion)" {...h.browser} /><Row label="AI service (transcription)" ok={h.ai.ok} detail={h.ai.detail} /></section>
            {h.ai.engines ? (
              <section className="mt-6"><h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-mute">Speech engines</h2>
                <div className="space-y-2">{h.ai.engines.map((e) => (
                  <div key={e.id} className="panel rounded-xl p-4">
                    <div className="mb-1 flex items-center gap-2 text-[13px] font-medium">{e.id}{e.available ? <Badge tone={e.modelReady ? "ok" : "warn"}>{e.modelReady ? "ready" : "model not downloaded"}</Badge> : <Badge tone="danger">not installed</Badge>}</div>
                    <p className="text-[12px] text-mute">{e.note}</p>
                    <p className="mt-1 text-[11px] text-mute">Languages: {e.languages === "auto" ? "all languages the model supports (auto-detect)" : e.languages.join(", ")}</p>
                  </div>))}</div>
              </section>
            ) : null}
            <section className="panel mt-6 rounded-xl px-4 py-3 text-[12px] text-mute">
              <p>Data directory: <code>{h.dataDir}</code></p><p>Max upload: {h.maxUploadMb} MB · Access token required: {h.authRequired ? "yes" : "no (local use)"}</p>
            </section>
          </>
        ) : !err ? <p className="text-mute">Checking…</p> : null}
        <section className="mt-8 text-[12px] leading-relaxed text-mute">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider">Licences</h2>
          <p>Remotion is free for individuals, non-profits and for-profit companies with up to 3 people; larger companies need a Remotion company licence. Fonts are SIL OFL 1.1 (Permanent Marker: Apache-2.0); the person-segmentation model is Apache-2.0. FFmpeg and Chromium are used as external tools. See docs/ARCHITECTURE.md.</p>
        </section>
      </main>
    </>
  );
}
