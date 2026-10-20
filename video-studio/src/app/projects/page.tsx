"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Film, Pencil, Plus, Trash2 } from "lucide-react";
import { SiteNav } from "@/components/Logo";
import { Button } from "@/components/ui";
import { api, fmtTime } from "@/lib/client";

interface Summary { id: string; name: string; updatedAt: string; aspect: string; durationMs: number; captionCount: number; thumbnail: string | null; hasVideo: boolean }

export default function Projects() {
  const [items, setItems] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(async () => {
    try { setItems((await api<{ projects: Summary[] }>("/api/projects")).projects); setError(null); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const rename = async (id: string, name: string) => {
    const { project } = await api<{ project: { id: string } & Record<string, unknown> }>(`/api/projects/${id}`);
    await api(`/api/projects/${id}`, { method: "PUT", body: JSON.stringify({ ...project, name: name.trim() || "Untitled project" }) });
    setRenaming(null);
    void refresh();
  };

  return (
    <>
      <SiteNav />
      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div><h1 className="text-2xl font-semibold tracking-tight">Projects</h1><p className="text-[13px] text-mute">Most recently edited first.</p></div>
          <Link href="/upload"><Button variant="primary"><Plus size={15} /> New video</Button></Link>
        </div>
        {error ? <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 p-3 text-[13px] text-danger">{error}</p> : null}
        {items === null && !error ? <p className="text-mute">Loading…</p> : null}
        {items?.length === 0 ? (
          <div className="panel rounded-2xl p-12 text-center"><Film className="mx-auto mb-3 text-mute" aria-hidden /><p className="mb-4 text-sm text-mute">No projects yet.</p><Link href="/upload"><Button variant="primary">Upload your first video</Button></Link></div>
        ) : null}
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items?.map((p) => (
            <li key={p.id} className="panel overflow-hidden rounded-xl">
              <Link href={`/editor/${p.id}`} className="block">
                <div className="relative aspect-video bg-panel-2">
                  {p.thumbnail ? <img src={p.thumbnail} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-mute"><Film aria-hidden /></div>}
                  {p.durationMs ? <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] tabular-nums">{fmtTime(p.durationMs)}</span> : null}
                </div>
              </Link>
              <div className="space-y-2 p-3">
                {renaming?.id === p.id ? (
                  <input autoFocus className="field" aria-label="Project name" value={renaming.name} onChange={(e) => setRenaming({ id: p.id, name: e.target.value })} onBlur={() => void rename(p.id, renaming.name)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setRenaming(null); }} />
                ) : (
                  <Link href={`/editor/${p.id}`} className="block truncate text-[14px] font-medium hover:text-accent">{p.name}</Link>
                )}
                <p className="text-[11px] text-mute">{p.aspect} · {p.captionCount} captions · {new Date(p.updatedAt).toLocaleString()}</p>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" aria-label={`Rename ${p.name}`} onClick={() => setRenaming({ id: p.id, name: p.name })}><Pencil size={14} /></Button>
                  <Button variant="ghost" size="icon" aria-label={`Duplicate ${p.name}`} onClick={async () => { await api(`/api/projects/${p.id}/duplicate`, { method: "POST" }); void refresh(); }}><Copy size={14} /></Button>
                  {confirm === p.id ? (
                    <Button variant="danger" size="sm" onClick={async () => { await api(`/api/projects/${p.id}`, { method: "DELETE" }); setConfirm(null); void refresh(); }}>Delete forever?</Button>
                  ) : (
                    <Button variant="ghost" size="icon" aria-label={`Delete ${p.name}`} onClick={() => { setConfirm(p.id); setTimeout(() => setConfirm((c) => (c === p.id ? null : c)), 4000); }}><Trash2 size={14} /></Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
